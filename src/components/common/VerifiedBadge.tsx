import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n';

/**
 * Ten-lobe seal on a 24×24 box — our own drawing, in the family of the
 * Facebook / WhatsApp check rather than a copy of either.
 */
const SEAL_PATH =
  'M12 2.1Q15.83 0.21 17.82 3.99Q22.03 4.71 21.42 8.94Q24.4 12 21.42 15.06Q22.03 19.29 17.82 20.01' +
  'Q15.83 23.79 12 21.9Q8.17 23.79 6.18 20.01Q1.97 19.29 2.58 15.06Q-0.4 12 2.58 8.94' +
  'Q1.97 4.71 6.18 3.99Q8.17 0.21 12 2.1Z';

/**
 * A name that may truncate, with the badge kept visible after it — for tight
 * spots (table cells, card subtitles) where a long name would push the badge
 * out of view.
 */
export function VerifiedName({
  name,
  verified,
  kind,
  badgeClassName,
}: {
  name: ReactNode;
  verified: boolean | undefined;
  kind: VerifiedBadgeProps['kind'];
  badgeClassName?: string;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 align-bottom">
      <span className="truncate">{name}</span>
      {verified && <VerifiedBadge kind={kind} className={badgeClassName} />}
    </span>
  );
}

export interface VerifiedBadgeProps {
  /** Picks the label read by screen readers and shown on hover. */
  kind: 'agency' | 'agent';
  /** Size it with `h-* w-*`; defaults to 16px, which sits beside `text-sm`. */
  className?: string;
}

/**
 * The blue check beside an agency or agent name, shown only when admin has
 * verified their documents. Render it next to the name, never instead of it:
 *
 * ```tsx
 * <span className="truncate">{agency.agencyName}</span>
 * {agency.kycVerified && <VerifiedBadge kind="agency" />}
 * ```
 */
export function VerifiedBadge({ kind, className }: VerifiedBadgeProps) {
  const { t } = useTranslation();
  const label = kind === 'agency' ? t('common.verified.agency') : t('common.verified.agent');

  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={label}
      className={cn('inline-block h-4 w-4 shrink-0 align-[-0.125em] text-[#1877F2] dark:text-[#3B8BFF]', className)}
    >
      <title>{label}</title>
      <path d={SEAL_PATH} fill="currentColor" />
      <path
        d="M7.6 12.3l3 3 5.8-6.2"
        fill="none"
        stroke="#fff"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
