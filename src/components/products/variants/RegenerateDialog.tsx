// ─── Regenerate Dialog ────────────────────────────────────────────────────────
// Confirmation modal showing the reconciliation breakdown before applying changes.

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, PlusCircle, AlertTriangle, Loader2 } from 'lucide-react';
import type { ReconciliationResult } from './variant.types';
import { buildVariantName } from './variant.engine';

// ─── Props ───────────────────────────────────────────────────────────────────

interface RegenerateDialogProps {
  open: boolean;
  result: ReconciliationResult | null;
  isSaving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

const PREVIEW_LIMIT = 10;

export function RegenerateDialog({
  open,
  result,
  isSaving,
  onConfirm,
  onCancel,
}: RegenerateDialogProps) {
  console.log("Result IN R: ", result)
  if (!result) return null;

  const { kept, toArchive, toCreate, totalExpected } = result;
  const hasDestructive = toArchive.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {hasDestructive ? 'Regenerate Variants?' : 'Generate Variants'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {hasDestructive
              ? 'Regenerating the variant matrix will modify existing variants. Review the changes below.'
              : `${totalExpected} variant${totalExpected === 1 ? '' : 's'} will be generated from your options.`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          {/* Kept variants */}
          {kept.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  Keep {kept.length} unchanged variant{kept.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="pl-6 text-xs text-muted-foreground space-y-0.5">
                {kept.slice(0, PREVIEW_LIMIT).map((row) => (
                  <div key={row.localId}>
                    {buildVariantName(row.combo.comboValues)}
                    {row.serverId && (
                      <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0">
                        saved
                      </Badge>
                    )}
                  </div>
                ))}
                {kept.length > PREVIEW_LIMIT && (
                  <div className="text-muted-foreground/70">
                    and {kept.length - PREVIEW_LIMIT} more…
                  </div>
                )}
              </div>
            </div>
          )}

          {/* New variants */}
          {toCreate.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400">
                <PlusCircle className="h-4 w-4" />
                <span>
                  Create {toCreate.length} new variant{toCreate.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="pl-6 text-xs text-muted-foreground space-y-0.5">
                {toCreate.slice(0, PREVIEW_LIMIT).map((combo) => (
                  <div key={combo.signature}>
                    {buildVariantName(combo.comboValues)}
                  </div>
                ))}
                {toCreate.length > PREVIEW_LIMIT && (
                  <div className="text-muted-foreground/70">
                    and {toCreate.length - PREVIEW_LIMIT} more…
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Variants to archive */}
          {toArchive.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span>
                  Archive {toArchive.length} variant{toArchive.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="pl-6 text-xs text-muted-foreground space-y-0.5">
                {toArchive.slice(0, PREVIEW_LIMIT).map((row) => (
                  <div key={row.localId}>
                    {buildVariantName(row.combo.comboValues)}
                    {row.serverId && (
                      <span className="text-destructive/70 ml-1">
                        (SKU: {row.sku})
                      </span>
                    )}
                  </div>
                ))}
                {toArchive.length > PREVIEW_LIMIT && (
                  <div className="text-muted-foreground/70">
                    and {toArchive.length - PREVIEW_LIMIT} more…
                  </div>
                )}
              </div>
              <p className="pl-6 text-xs text-destructive/80">
                Archived variants will be removed from the storefront but data is preserved.
              </p>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSaving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault(); // prevent auto-close; we'll close after save
              onConfirm();
            }}
            disabled={isSaving}
            className={hasDestructive ? 'bg-destructive hover:bg-destructive/90' : ''}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                Applying…
              </>
            ) : hasDestructive ? (
              'Confirm & Regenerate'
            ) : (
              'Generate Variants'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
