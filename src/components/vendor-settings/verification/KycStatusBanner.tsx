import { BadgeCheck, Clock, FileWarning, Lock, PencilLine } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useFormatters, useTranslation } from '@/i18n';
import { kycPhase, type KycPhase, type KycRecord } from '@/types/kyc.types';

const PHASE_STYLES: Record<KycPhase, { icon: LucideIcon; className: string }> = {
  draft: { icon: PencilLine, className: 'border-border bg-muted/40 text-foreground' },
  under_review: {
    icon: Clock,
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200',
  },
  verified: {
    icon: BadgeCheck,
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
  },
  rejected: {
    icon: FileWarning,
    className: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
};

/**
 * Where the submission stands, and what the vendor can do about it.
 *
 * ⚠ The four phases come from `status` **and** `submittedAt` together, never
 * from `status` alone — `pending` is both "never touched" and "waiting for a
 * reviewer", and those two want opposite copy. `kycPhase` collapses the pair.
 */
export function KycStatusBanner({ record }: { record: KycRecord }) {
  const { t } = useTranslation();
  const { date: formatDate } = useFormatters();
  const phase = kycPhase(record);
  const { icon: Icon, className } = PHASE_STYLES[phase];

  const detail = () => {
    if (phase === 'under_review' && record.submittedAt) {
      return t('account.verification.status.submittedOn', {
        date: formatDate(record.submittedAt, 'medium'),
      });
    }
    if (phase === 'verified' && record.verifiedAt) {
      return t('account.verification.status.verifiedOn', {
        date: formatDate(record.verifiedAt, 'medium'),
      });
    }
    return null;
  };

  const detailText = detail();

  return (
    <div className={cn('rounded-lg border p-3 md:p-4', className)}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold">
            {t(`account.verification.status.${phase}.title` as const)}
          </p>
          <p className="text-sm opacity-90">
            {t(`account.verification.status.${phase}.body` as const)}
          </p>

          {detailText && <p className="text-xs opacity-75">{detailText}</p>}

          {/* The rejection reason is the whole remedy for a refusal — it is what
              the vendor acts on, and the record is deliberately left unlocked so
              they can. Rendered verbatim: it is a human's prose, not a code. */}
          {phase === 'rejected' && record.rejectionReason && (
            <div className="mt-2 rounded-md border border-destructive/20 bg-background/60 p-2.5">
              <p className="text-xs font-medium uppercase tracking-wide opacity-70">
                {t('account.verification.status.rejectionReason')}
              </p>
              <p className="mt-1 text-sm">{record.rejectionReason}</p>
            </div>
          )}

          {record.locked && (
            <p className="mt-2 flex items-center gap-1.5 text-xs opacity-75">
              <Lock className="size-3 shrink-0" />
              {t('account.verification.status.lockedHint')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
