import type { StorageInvoiceStatus } from '@/types/storage-invoices.types';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * ⚠ `settled` is the **agency's** claim that it was paid — nothing verifies it,
 * and who marked it is deliberately not exposed. Styled as neutral-positive
 * rather than as a platform-confirmed receipt, because the platform confirmed
 * nothing.
 */
const STATUS_STYLES: Record<StorageInvoiceStatus, string> = {
  open: 'border-amber-500 text-amber-600 bg-amber-50',
  settled: 'border-green-500 text-green-600 bg-green-50',
  void: 'border-border text-muted-foreground bg-muted',
};

export function StorageInvoiceStatusBadge({
  status,
  className,
}: {
  status: StorageInvoiceStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        STATUS_STYLES[status],
        className,
      )}
    >
      {t(`inventory.invoices.status.${status}` as const)}
    </span>
  );
}
