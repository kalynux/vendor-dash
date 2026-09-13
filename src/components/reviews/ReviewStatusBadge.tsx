import type { ReviewStatus } from '@/types/reviews.types';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * 🔴 **`pending` is the state this badge exists for.** A rating on its own
 * publishes immediately, but adding any comment sends the whole review to
 * moderation — so a vendor who wrote a few words and then cannot find their
 * review publicly is the predictable support ticket
 * (api-doc/vendor/reviews.md § 4). Rendering it as a visible, named state is the
 * cheapest way to answer that question before it is asked.
 *
 * Styled amber rather than red: `pending` is the normal outcome of commenting,
 * not a problem. `rejected` is the muted one — it is terminal and there is
 * nothing the vendor can do about it, since reviews are write-once.
 */
const STATUS_STYLES: Record<ReviewStatus, string> = {
  published: 'border-green-500 text-green-600 bg-green-50',
  pending: 'border-amber-500 text-amber-600 bg-amber-50',
  rejected: 'border-border text-muted-foreground bg-muted',
};

export function ReviewStatusBadge({
  status,
  className,
}: {
  status: ReviewStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        STATUS_STYLES[status],
        className,
      )}
    >
      {t(`agency.reviews.status.${status}` as const)}
    </span>
  );
}
