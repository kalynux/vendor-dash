import { ArchiveRestore, Pencil, Send, Trash2, type LucideIcon } from 'lucide-react';
import type { StatusTransitionIntent } from '@/services/products.service';

/**
 * One icon per status transition, shared by every surface that offers them.
 *
 * Two of those surfaces are action *lists* now — the preview bar's menu and the
 * quick-add editor's — and a list where some rows have an icon and others do not
 * reads as broken rather than as minimal. Keeping the mapping in one place is
 * also what stops "archive" from being a bin in one menu and something else in
 * the next.
 */
export const STATUS_INTENT_ICON: Record<StatusTransitionIntent, LucideIcon> = {
  activate: Send,
  demote_to_draft: Pencil,
  restore: ArchiveRestore,
  archive: Trash2,
};
