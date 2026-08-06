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
import { useTranslation } from '@/i18n';

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
  const { t } = useTranslation();
  if (!result) return null;

  const { kept, toArchive, toCreate, totalExpected } = result;
  const hasDestructive = toArchive.length > 0;

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t(hasDestructive
              ? 'products.regenerate.titleDestructive'
              : 'products.regenerate.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {hasDestructive
              ? t('products.regenerate.descriptionDestructive')
              : t('products.regenerate.description', { count: totalExpected })}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          {/* Kept variants */}
          {kept.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>{t('products.regenerate.keep', { count: kept.length })}</span>
              </div>
              <div className="pl-6 text-xs text-muted-foreground space-y-0.5">
                {kept.slice(0, PREVIEW_LIMIT).map((row) => (
                  <div key={row.localId}>
                    {buildVariantName(row.combo.comboValues)}
                    {row.serverId && (
                      <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0">
                        {t('products.regenerate.savedBadge')}
                      </Badge>
                    )}
                  </div>
                ))}
                {kept.length > PREVIEW_LIMIT && (
                  <div className="text-muted-foreground/70">
                    {t('products.regenerate.andMore', { count: kept.length - PREVIEW_LIMIT })}
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
                <span>{t('products.regenerate.create', { count: toCreate.length })}</span>
              </div>
              <div className="pl-6 text-xs text-muted-foreground space-y-0.5">
                {toCreate.slice(0, PREVIEW_LIMIT).map((combo) => (
                  <div key={combo.signature}>
                    {buildVariantName(combo.comboValues)}
                  </div>
                ))}
                {toCreate.length > PREVIEW_LIMIT && (
                  <div className="text-muted-foreground/70">
                    {t('products.regenerate.andMore', { count: toCreate.length - PREVIEW_LIMIT })}
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
                <span>{t('products.regenerate.archive', { count: toArchive.length })}</span>
              </div>
              <div className="pl-6 text-xs text-muted-foreground space-y-0.5">
                {toArchive.slice(0, PREVIEW_LIMIT).map((row) => (
                  <div key={row.localId}>
                    {buildVariantName(row.combo.comboValues)}
                    {row.serverId && (
                      <span className="text-destructive/70 ml-1">
                        {t('products.regenerate.skuHint', { sku: row.sku })}
                      </span>
                    )}
                  </div>
                ))}
                {toArchive.length > PREVIEW_LIMIT && (
                  <div className="text-muted-foreground/70">
                    {t('products.regenerate.andMore', { count: toArchive.length - PREVIEW_LIMIT })}
                  </div>
                )}
              </div>
              <p className="pl-6 text-xs text-destructive/80">
                {t('products.regenerate.archiveNote')}
              </p>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSaving}>{t('common.actions.cancel')}</AlertDialogCancel>
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
                {t('products.regenerate.applying')}
              </>
            ) : (
              t(hasDestructive
                ? 'products.regenerate.confirmDestructive'
                : 'products.regenerate.confirm')
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
