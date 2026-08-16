import { useMemo, useState } from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { CHAT_LIMITS, DESCRIPTION_BUDGET, docCharCount, lintDoc, type RichDoc } from '@/lib/richtext';
import { ChatPreview } from './ChatPreview';
import { EditorToolbar } from './EditorToolbar';
import { LinkDialog } from './LinkDialog';
import { useRichTextEditor } from './useRichTextEditor';

interface ChatRichTextEditorProps {
  id?: string;
  value: RichDoc;
  onChange: (doc: RichDoc) => void;
  /** Product title, previewed as the message's first line. */
  previewTitle?: string;
  /** Pre-formatted price, previewed under the title. */
  previewPrice?: string | null;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
}

/**
 * The product-description field.
 *
 * Everything about it is aimed at one outcome: a vendor writes here, and the
 * message their customer receives on WhatsApp or Telegram looks like what they
 * intended. That is why the preview is part of the field rather than an optional
 * panel somewhere else — the description is not really "done" until it has been
 * looked at as a message.
 */
export function ChatRichTextEditor({
  id,
  value,
  onChange,
  previewTitle,
  previewPrice,
  disabled,
  invalid,
  className,
}: ChatRichTextEditorProps) {
  const { t } = useTranslation();
  // Destructured rather than kept as one `editor` object: the React Compiler
  // traces the memoised return of a hook that closes over a ref and treats every
  // property read on it as a ref access during render. Pulling the values out
  // once — the shape React's own hooks return — keeps that analysis happy and
  // reads better at the use sites anyway.
  const {
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
  } = useRichTextEditor(value, onChange, disabled);
  const [linkOpen, setLinkOpen] = useState(false);

  const length = useMemo(() => docCharCount(value), [value]);
  const notice = useMemo(() => lintDoc(value)[0], [value]);
  const empty = length === 0;

  const counterTone =
    length > DESCRIPTION_BUDGET
      ? 'text-destructive'
      : length > CHAT_LIMITS.WARN
        ? 'text-amber-600 dark:text-amber-500'
        : 'text-muted-foreground';

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className={cn(
          'overflow-hidden rounded-lg border bg-background transition-colors',
          'focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
          invalid ? 'border-destructive' : 'border-input',
          disabled && 'pointer-events-none opacity-60',
        )}
      >
        <EditorToolbar
          marks={marks}
          disabled={disabled}
          onToggleMark={toggleMark}
          onToggleList={toggleList}
          onLink={() => setLinkOpen(true)}
          onEmoji={insertText}
          onUndo={undo}
          onRedo={redo}
        />

        <div className="relative">
          {/* `contenteditable` has no `placeholder`, and the usual `:empty::before`
              trick fails here because the browser leaves a `<p><br></p>` behind —
              the element is never actually empty. Driving the overlay off the
              document's own character count is the only reading that matches what
              the vendor sees. */}
          {empty && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 whitespace-pre-wrap px-3 py-2.5 text-sm text-muted-foreground/70"
            >
              {t('products.editor.placeholder')}
            </div>
          )}

          <div
            id={id}
            ref={attachRef}
            role="textbox"
            aria-multiline
            aria-invalid={invalid}
            aria-label={t('products.fields.description')}
            contentEditable={!disabled}
            suppressContentEditableWarning
            spellCheck
            onInput={onInput}
            onBlur={onInput}
            onPaste={onPaste}
            className={cn(
              'min-h-[9.5rem] w-full px-3 py-2.5 text-sm leading-relaxed outline-none',
              '[&_p]:min-h-[1.4em] [&_p:not(:last-child)]:mb-2',
              '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5',
              '[&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5',
              '[&_li]:my-0.5',
              '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
              '[&_s]:opacity-80',
            )}
          />
        </div>

        <div className="flex items-start justify-between gap-3 border-t border-border bg-muted/30 px-3 py-1.5">
          <p className="min-w-0 text-xs text-muted-foreground">
            {notice ? (
              <span
                className={cn(
                  'flex items-start gap-1.5',
                  notice.severity === 'warn' && 'text-amber-600 dark:text-amber-500',
                )}
              >
                {notice.severity === 'warn' ? (
                  <AlertTriangle className="mt-px size-3.5 shrink-0" />
                ) : (
                  <Info className="mt-px size-3.5 shrink-0" />
                )}
                {t(notice.key, notice.params)}
              </span>
            ) : (
              t('products.editor.hint')
            )}
          </p>
          <span className={cn('shrink-0 text-xs tabular-nums', counterTone)}>{length}</span>
        </div>
      </div>

      <ChatPreview doc={value} title={previewTitle} price={previewPrice} />

      <LinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        initialLabel={activeLink?.text ?? selectedText}
        initialHref={activeLink?.href ?? ''}
        onSubmit={applyLink}
        onRemove={activeLink ? removeLink : undefined}
      />
    </div>
  );
}
