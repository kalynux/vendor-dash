import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Redo2,
  Strikethrough,
  Undo2,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useTranslation } from '@/i18n';
import { EmojiPicker } from './EmojiPicker';
import { ToolbarButton } from './ToolbarButton';
import type { ActiveMarks } from './useRichTextEditor';

interface EditorToolbarProps {
  marks: ActiveMarks;
  disabled?: boolean;
  onToggleMark: (mark: 'bold' | 'italic' | 'strike') => void;
  onToggleList: (ordered: boolean) => void;
  onLink: () => void;
  onEmoji: (emoji: string) => void;
  onUndo: () => void;
  onRedo: () => void;
}

/**
 * The whole formatting vocabulary, and nothing else.
 *
 * There is no font, size, colour, alignment or heading control, and that is the
 * product decision rather than an unfinished toolbar: none of them exist in a
 * WhatsApp or Telegram message. Offering a colour picker would let a vendor
 * spend time on something that is discarded the moment the description is
 * shared — which is the only place it really gets read.
 *
 * The row scrolls horizontally instead of wrapping. A wrapping toolbar changes
 * height as the viewport narrows and pushes the writing area around; a single
 * row stays put, and the two least-used controls (undo/redo) are the ones that
 * fall off the edge on a narrow phone.
 */
export function EditorToolbar({
  marks,
  disabled,
  onToggleMark,
  onToggleList,
  onLink,
  onEmoji,
  onUndo,
  onRedo,
}: EditorToolbarProps) {
  const { t } = useTranslation();

  return (
    <div
      role="toolbar"
      aria-label={t('products.editor.toolbar.label')}
      className="flex items-center gap-0.5 overflow-x-auto border-b border-border bg-muted/40 px-1.5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <ToolbarButton
        label={t('products.editor.toolbar.bold')}
        active={marks.bold}
        disabled={disabled}
        onClick={() => onToggleMark('bold')}
      >
        <Bold />
      </ToolbarButton>
      <ToolbarButton
        label={t('products.editor.toolbar.italic')}
        active={marks.italic}
        disabled={disabled}
        onClick={() => onToggleMark('italic')}
      >
        <Italic />
      </ToolbarButton>
      <ToolbarButton
        label={t('products.editor.toolbar.strike')}
        active={marks.strike}
        disabled={disabled}
        onClick={() => onToggleMark('strike')}
      >
        <Strikethrough />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <ToolbarButton
        label={t('products.editor.toolbar.bulletList')}
        active={marks.bulletList}
        disabled={disabled}
        onClick={() => onToggleList(false)}
      >
        <List />
      </ToolbarButton>
      <ToolbarButton
        label={t('products.editor.toolbar.orderedList')}
        active={marks.orderedList}
        disabled={disabled}
        onClick={() => onToggleList(true)}
      >
        <ListOrdered />
      </ToolbarButton>

      <Separator orientation="vertical" className="mx-1 h-5" />

      <ToolbarButton
        label={t('products.editor.toolbar.link')}
        active={marks.link}
        disabled={disabled}
        onClick={onLink}
      >
        <Link2 />
      </ToolbarButton>
      <EmojiPicker onPick={onEmoji} disabled={disabled} />

      <Separator orientation="vertical" className="mx-1 h-5" />

      <ToolbarButton label={t('products.editor.toolbar.undo')} disabled={disabled} onClick={onUndo}>
        <Undo2 />
      </ToolbarButton>
      <ToolbarButton label={t('products.editor.toolbar.redo')} disabled={disabled} onClick={onRedo}>
        <Redo2 />
      </ToolbarButton>
    </div>
  );
}
