import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';
import {
  SERVICE_STATUS_META,
  BOOKING_STATUS_META,
  PAYMENT_STATUS_META,
  TONE_CLASSES,
} from '@/components/services/service.constants';
import type {
  ServiceStatus,
  BookingStatus,
  PaymentStatus,
} from '@/types/services.types';

const base =
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap';

export function ServiceStatusBadge({ status, className }: { status: ServiceStatus; className?: string }) {
  const { t } = useTranslation();
  const meta = SERVICE_STATUS_META[status] ?? SERVICE_STATUS_META.draft;
  return <span className={cn(base, TONE_CLASSES[meta.tone], className)}>{t(meta.labelKey)}</span>;
}

export function BookingStatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const { t } = useTranslation();
  const meta = BOOKING_STATUS_META[status] ?? BOOKING_STATUS_META.pending;
  return <span className={cn(base, TONE_CLASSES[meta.tone], className)}>{t(meta.labelKey)}</span>;
}

export function PaymentStatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  const { t } = useTranslation();
  const meta = PAYMENT_STATUS_META[status] ?? PAYMENT_STATUS_META.unpaid;
  return <span className={cn(base, TONE_CLASSES[meta.tone], className)}>{t(meta.labelKey)}</span>;
}
