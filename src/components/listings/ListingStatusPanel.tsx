import { Link } from 'react-router-dom';

import { useTranslation, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils';
import type { VendorListingDetail } from '@/types/listings.types';
import { STATUS_KEYS, SUSPENSION_KEYS, TONE_DOT, listingStatusLine, type StatusTone } from './listingStatus';

const TONE_BORDER: Record<StatusTone, string> = {
  neutral: 'border-border',
  waiting: 'border-amber-500',
  good: 'border-emerald-500',
  warning: 'border-amber-500',
  bad: 'border-red-500',
};

/**
 * Where this listing stands, in words, at the top of its editor.
 *
 * One block: the status, one sentence on what it means, the reviewer's reasons
 * when it was refused, and — for a pause — the single thing that brings it
 * back. A live listing being edited says "Changes waiting for review" and that
 * the approved version stays live meanwhile.
 */
export function ListingStatusPanel({ listing }: { listing: VendorListingDetail }) {
  const { t } = useTranslation();
  const line = listingStatusLine(listing);

  let sentence: string | null = null;
  let reasons: string[] = [];
  let action: { to: string; labelKey: TranslationKey } | null = null;
  let note: string | null = null;

  const state = listing.review?.state;
  const reviewReasons = listing.review?.reasons?.length
    ? listing.review.reasons
    : listing.lastDecision?.decision === 'rejected'
      ? listing.lastDecision.reasons
      : [];

  if (listing.status === 'suspended' && listing.suspension) {
    const reason = listing.suspension.reason;
    sentence = t(SUSPENSION_KEYS[reason]?.long ?? 'listings.status.suspended');
    if (reason === 'insufficient_credits') action = { to: '/dashboard/account/billing', labelKey: 'listings.suspension.topUp' };
    if (reason === 'plan_quota_exceeded') action = { to: '/dashboard/account/billing', labelKey: 'listings.suspension.seePlans' };
    if (reason === 'platform_oversight') {
      action = { to: '/dashboard/tickets', labelKey: 'listings.suspension.contactSupport' };
      if (listing.suspension.note) note = t('listings.suspension.platform_oversightNote', { note: listing.suspension.note });
    }
  } else if (listing.published && listing.pending) {
    // A live (or paused) listing carrying a change.
    if (state === 'pending_review') sentence = t('listings.statusLine.changesWaitingLong');
    else if (state === 'rejected') {
      sentence = t('listings.statusLine.changesRejected');
      reasons = reviewReasons;
    } else sentence = t('listings.statusLine.changesEditing');
  } else {
    switch (listing.status) {
      case 'live':
        sentence = t('listings.statusLine.live');
        break;
      case 'pending_review':
        sentence = t('listings.statusLine.pending_review');
        break;
      case 'rejected':
        sentence = t('listings.statusLine.rejected');
        reasons = reviewReasons;
        break;
      case 'archived':
        sentence = t('listings.statusLine.archived');
        break;
      default:
        sentence = t('listings.statusLine.draft');
    }
  }

  // A live listing with a pending change still IS live: say both.
  const heading =
    listing.status === 'live' && listing.pending ? t(STATUS_KEYS.live) : t(line.key);

  return (
    <div className={cn('space-y-2 border-l-2 pl-3', TONE_BORDER[line.tone])}>
      <p className="flex items-center gap-2 font-medium">
        <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', TONE_DOT[line.tone])} />
        {heading}
        {listing.status === 'live' && listing.pending && state === 'pending_review' && (
          <span className="font-normal text-muted-foreground">· {t('listings.statusLine.changesWaiting')}</span>
        )}
      </p>
      {sentence && <p className="text-sm text-muted-foreground">{sentence}</p>}
      {note && <p className="text-sm">{note}</p>}
      {reasons.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium">{t('listings.statusLine.reasonsTitle')}</p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm">
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
      {action && (
        <Link to={action.to} className="inline-block text-sm font-medium text-primary">
          {t(action.labelKey)}
        </Link>
      )}
    </div>
  );
}
