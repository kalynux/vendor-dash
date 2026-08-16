import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { docToHtml, htmlToDoc, isAllowedHref, type RichDoc } from '@/lib/richtext';

/**
 * The `contenteditable` controller.
 *
 * Editing verbs go through `document.execCommand`. It is a deprecated API, and
 * choosing it was deliberate: it is implemented everywhere, it covers exactly
 * the eight verbs this editor exposes, and — the part no replacement gives you
 * for free — every edit it makes lands on the browser's native undo stack, keeps
 * the caret where the user put it, and composes correctly with IME input and
 * Android soft-keyboard autocorrect.
 *
 * Its real defect is that different engines produce different markup for the
 * same command. That defect is neutralised one layer down: `htmlToDoc` accepts
 * the union of those shapes and always returns the canonical document, so no
 * browser difference escapes this component.
 */

export type ActiveMarks = {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  bulletList: boolean;
  orderedList: boolean;
  link: boolean;
};

const NO_MARKS: ActiveMarks = {
  bold: false,
  italic: false,
  strike: false,
  bulletList: false,
  orderedList: false,
  link: false,
};

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Walk up from the caret looking for an anchor, so the toolbar can show link state. */
function anchorAtSelection(root: HTMLElement | null): HTMLAnchorElement | null {
  if (!root) return null;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;

  let node: Node | null = selection.anchorNode;
  while (node && node !== root) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'A') {
      return node as HTMLAnchorElement;
    }
    node = node.parentNode;
  }
  return null;
}

function selectionInside(root: HTMLElement | null): boolean {
  if (!root) return false;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;
  return root.contains(selection.anchorNode);
}

export type UseRichTextEditor = {
  /**
   * A callback ref, not a ref object.
   *
   * Handing the component a `RefObject` would mean reading `editor.ref` during
   * render, which is exactly what the `react-hooks/refs` rule forbids — a ref is
   * not a rendering input. A callback is an ordinary function, so the editable
   * element is still captured with nothing observed during render.
   */
  attachRef: (node: HTMLDivElement | null) => void;
  marks: ActiveMarks;
  /** Text currently selected, used to prefill the link dialog's label. */
  selectedText: string;
  /** The anchor the caret sits in, if any. */
  activeLink: { href: string; text: string } | null;
  toggleMark: (mark: 'bold' | 'italic' | 'strike') => void;
  toggleList: (ordered: boolean) => void;
  applyLink: (href: string, label: string) => void;
  removeLink: () => void;
  insertText: (text: string) => void;
  undo: () => void;
  redo: () => void;
  onInput: () => void;
  onPaste: (event: React.ClipboardEvent<HTMLDivElement>) => void;
  focus: () => void;
};

export function useRichTextEditor(
  value: RichDoc,
  onChange: (doc: RichDoc) => void,
  disabled?: boolean,
): UseRichTextEditor {
  const ref = useRef<HTMLDivElement | null>(null);
  const attachRef = useCallback((node: HTMLDivElement | null) => {
    ref.current = node;
  }, []);
  const [marks, setMarks] = useState<ActiveMarks>(NO_MARKS);
  const [selectedText, setSelectedText] = useState('');
  const [activeLink, setActiveLink] = useState<{ href: string; text: string } | null>(null);

  /**
   * The document we last emitted. Comparing against it is what stops the surface
   * from being re-rendered on every keystroke: re-writing `innerHTML` while the
   * user is typing destroys the caret, and doing it on every change would make
   * the editor unusable while looking perfectly correct in a screenshot.
   */
  const emittedRef = useRef<string>('');

  const serialize = useCallback(() => {
    if (!ref.current) return;
    const doc = htmlToDoc(ref.current);
    const json = JSON.stringify(doc);
    if (json === emittedRef.current) return;
    emittedRef.current = json;
    onChange(doc);
  }, [onChange]);

  // Adopt an externally-set document (mount, form reset, product finished
  // loading). Guarded by the emitted-JSON check so our own changes never bounce
  // back and reset the caret.
  useEffect(() => {
    const incoming = JSON.stringify(value);
    if (incoming === emittedRef.current) return;
    emittedRef.current = incoming;
    if (ref.current) ref.current.innerHTML = docToHtml(value);
  }, [value]);

  const refreshMarks = useCallback(() => {
    if (!selectionInside(ref.current)) return;
    const selection = window.getSelection();
    const anchor = anchorAtSelection(ref.current);

    setSelectedText(selection?.toString() ?? '');
    setActiveLink(anchor ? { href: anchor.getAttribute('href') ?? '', text: anchor.textContent ?? '' } : null);
    setMarks({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      strike: document.queryCommandState('strikeThrough'),
      bulletList: document.queryCommandState('insertUnorderedList'),
      orderedList: document.queryCommandState('insertOrderedList'),
      link: !!anchor,
    });
  }, []);

  useEffect(() => {
    document.addEventListener('selectionchange', refreshMarks);
    return () => document.removeEventListener('selectionchange', refreshMarks);
  }, [refreshMarks]);

  const focus = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (!selectionInside(el)) {
      el.focus();
      // Put the caret at the end rather than the start: a vendor clicking a
      // toolbar button with no caret means "carry on from where I was".
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    } else {
      el.focus();
    }
  }, []);

  const exec = useCallback(
    (command: string, argument?: string) => {
      if (disabled) return;
      focus();
      try {
        // Off by default in some engines, and a document-wide flag another
        // component could have flipped. With it on, browsers emit
        // `<span style="font-weight:bold">` instead of `<b>` — which `htmlToDoc`
        // reads anyway, but tags keep the surface's own markup clean.
        document.execCommand('styleWithCSS', false, 'false');
        document.execCommand('defaultParagraphSeparator', false, 'p');
        document.execCommand(command, false, argument);
      } catch {
        // An engine that refuses a command should not take the form down with
        // it; the vendor simply sees the button do nothing.
      }
      serialize();
      refreshMarks();
    },
    [disabled, focus, refreshMarks, serialize],
  );

  const toggleMark = useCallback(
    (mark: 'bold' | 'italic' | 'strike') => {
      exec(mark === 'strike' ? 'strikeThrough' : mark);
    },
    [exec],
  );

  const toggleList = useCallback(
    (ordered: boolean) => exec(ordered ? 'insertOrderedList' : 'insertUnorderedList'),
    [exec],
  );

  const applyLink = useCallback(
    (href: string, label: string) => {
      if (!isAllowedHref(href)) return;
      const text = label.trim() || href;
      // `insertHTML` rather than `createLink`, because the label may differ from
      // whatever was selected — and unlike a manual DOM edit it stays on the
      // native undo stack.
      exec('insertHTML', `<a href="${escapeAttribute(href)}">${escapeText(text)}</a>`);
    },
    [exec],
  );

  const removeLink = useCallback(() => exec('unlink'), [exec]);
  const insertText = useCallback((text: string) => exec('insertText', text), [exec]);
  const undo = useCallback(() => exec('undo'), [exec]);
  const redo = useCallback(() => exec('redo'), [exec]);

  const onInput = useCallback(() => {
    serialize();
    refreshMarks();
  }, [refreshMarks, serialize]);

  /**
   * Paste is intercepted and re-inserted as plain text.
   *
   * A description is very often pasted from another storefront, a Word document
   * or a WhatsApp message, and the markup that rides along carries fonts,
   * colours, tables and inline styles this model has no home for. Letting it
   * into the surface would mean `htmlToDoc` silently discarding most of it on
   * the next keystroke — the vendor would watch their paste change shape.
   * Stripping it up front is the honest version of the same outcome.
   */
  const onPaste = useCallback(
    (event: React.ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      const text = event.clipboardData.getData('text/plain');
      if (text) insertText(text);
    },
    [insertText],
  );

  return useMemo(
    () => ({
      attachRef,
      marks,
      selectedText,
      activeLink,
      toggleMark,
      toggleList,
      applyLink,
      removeLink,
      insertText,
      undo,
      redo,
      onInput,
      onPaste,
      focus,
    }),
    [
      attachRef,
      marks,
      selectedText,
      activeLink,
      toggleMark,
      toggleList,
      applyLink,
      removeLink,
      insertText,
      undo,
      redo,
      onInput,
      onPaste,
      focus,
    ],
  );
}
