import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ResponsiveModal } from '@/components/services/ResponsiveModal';
import { deleteProductPermanently } from '@/services/products.service';
import { useProductStore } from '@/store';
import { removeCachedItems } from '@/hooks/use-infinite-list';
import { forgetMediaLists } from '@/lib/listCache';
import {
  deleteBlockerText,
  mustStayArchived,
  readDeleteBlockers,
  type DeleteBlocker,
} from '@/lib/productDeleteBlockers';
import { ApiError } from '@/types/api';
import { Trans, useApiError, useTranslation } from '@/i18n';

/**
 * "Delete permanently" for an archived product — the confirmation, the call, and
 * the server's list of reasons when it refuses.
 *
 * Offer it on archived products only: `not_archived` is the one refusal the
 * dashboard can see coming. Every other reason (sold, booked, reviewed, …) is
 * only known to the server, so the dialog asks first and explains after.
 *
 * On success it cleans up what every screen shares — the products list in the
 * store, the phone list's saved copy, and the media library (the pictures went
 * with the product, so its file list and storage figure are stale). The caller
 * only handles its own screen in `onDeleted`.
 */

export interface PermanentDeleteTarget {
  id: string;
  title: string;
}

export function PermanentDeleteDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: PermanentDeleteTarget | null;
  onClose: () => void;
  /** Also called when the product turns out to be gone already (404). */
  onDeleted: (id: string) => void;
}) {
  const { t } = useTranslation();
  const apiError = useApiError();
  const { removeProduct } = useProductStore();
  const [busy, setBusy] = useState(false);
  const [blockers, setBlockers] = useState<DeleteBlocker[] | null>(null);

  const close = () => {
    if (busy) return;
    setBlockers(null);
    onClose();
  };

  const forget = (id: string) => {
    removeProduct(id);
    removeCachedItems<{ id: string }>('products', (p) => p.id === id);
    onDeleted(id);
  };

  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await deleteProductPermanently(target.id);
      forgetMediaLists();
      toast.success(t('products.permanentDelete.done', { name: target.title }));
      forget(target.id);
      setBlockers(null);
      onClose();
    } catch (err) {
      const found = readDeleteBlockers(err);
      if (found) {
        setBlockers(found);
        return;
      }
      const gone = err instanceof ApiError && err.code === 'CATALOG_PRODUCT_NOT_FOUND';
      const message = apiError.resolve(err, {
        context: 'productDelete',
        fallbackKey: 'products.permanentDelete.failed',
      });
      if (gone) {
        toast.info(message);
        forget(target.id);
      } else {
        toast.error(message);
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const name = target?.title ?? '';
  const nameTag = [<span className="font-semibold text-foreground" />];

  return (
    <ResponsiveModal
      open={!!target}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      title={t(blockers ? 'products.permanentDelete.blockedTitle' : 'products.permanentDelete.title')}
      desktopClassName="sm:max-w-md"
      mobileClassName="h-auto max-h-[92dvh]"
      disableClose={busy}
      footer={
        blockers ? (
          <Button type="button" variant="outline" onClick={close}>
            {t('common.actions.gotIt')}
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={close} disabled={busy}>
              {t('common.actions.cancel')}
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirm()} disabled={busy}>
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('products.permanentDelete.confirm')}
            </Button>
          </>
        )
      }
    >
      {blockers ? (
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            <Trans
              i18nKey={
                mustStayArchived(blockers)
                  ? 'products.permanentDelete.blockedKeep'
                  : 'products.permanentDelete.blockedLater'
              }
              params={{ name }}
              components={nameTag}
            />
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            {blockers.map((b, i) => (
              <li key={b.reason ?? `other-${i}`}>{deleteBlockerText(t, b)}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            <Trans
              i18nKey="products.permanentDelete.description"
              params={{ name }}
              components={nameTag}
            />
          </p>
          <p>{t('products.permanentDelete.sharedPictures')}</p>
        </div>
      )}
    </ResponsiveModal>
  );
}
