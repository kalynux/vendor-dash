import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { InventoryPageMeta } from '@/types/inventory.types';
import { useTranslation } from '@/i18n';

/**
 * The pagination footer shared by every Inventory tab. Extracted so the
 * stock-requests tab pages the same way as alerts / reservations / history
 * instead of introducing a second idiom inside one `Tabs` container.
 */
export function InventoryPagination({
  meta,
  page,
  onPage,
  loading,
}: {
  meta: InventoryPageMeta;
  page: number;
  onPage: (p: number) => void;
  loading: boolean;
}) {
  const { t } = useTranslation();
  if (meta.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t">
      <p className="text-sm text-muted-foreground">
        {t('inventory.pagination.summary', {
          page: meta.page,
          total: meta.totalPages,
          count: meta.total,
        })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || loading}
          onClick={() => onPage(page - 1)}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> {t('inventory.pagination.prev')}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= meta.totalPages || loading}
          onClick={() => onPage(page + 1)}
          className="gap-1"
        >
          {t('inventory.pagination.next')} <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default InventoryPagination;
