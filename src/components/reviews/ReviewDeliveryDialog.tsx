import { useCallback, useEffect, useState } from 'react';
import { Info, Loader2, MessageSquarePlus } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ResponsiveModal } from '@/components/services/ResponsiveModal';
import { StarRatingInput } from '@/components/reviews/StarRatingInput';
import { checkReviewEligibility, submitDeliveryReview } from '@/services/reviews.service';
import { ApiError } from '@/types/api';
import type { ReviewEligibility, ReviewIneligibilityReason } from '@/types/reviews.types';
import { useApiError, useTranslation, type TranslationKey } from '@/i18n';

/** Backend caps, mirrored so the vendor is stopped before the 400 rather than after. */
const TITLE_MAX = 120;
const BODY_MAX = 2000;

interface ReviewDeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 🔴 The **shipment** id — not the order, not the agency, not the agent. */
  shipmentId: string;
  /** Context only: who carried it, so the vendor knows which delivery this is. */
  agencyName?: string | null;
  agentName?: string | null;
  /**
   * Fired when this shipment is settled for good — a successful submit, or an
   * eligibility answer of "already reviewed". Both mean the same thing to the
   * caller, because the surface is write-once: there is nothing further to offer.
   */
  onReviewed: () => void;
}

/** Why the form is not being offered. Each maps to one sentence. */
const REASON_KEY: Record<ReviewIneligibilityReason, TranslationKey> = {
  REVIEW_NOT_ELIGIBLE: 'orders.review.blocked.notDelivered',
  REVIEW_SUBJECT_NOT_REVIEWABLE: 'orders.review.blocked.noAgent',
  REVIEW_ROLE_NOT_ALLOWED: 'orders.review.blocked.notAllowed',
  REVIEW_ALREADY_EXISTS: 'orders.review.blocked.alreadyReviewed',
};

/**
 * Rate one delivery.
 *
 * 🔴 **A vendor reviews a DELIVERY, by shipment id.** Never a product and never a
 * customer — the product review is the buyer's, and neither of those routes
 * exists. The vendor also never names the agent or the agency: the backend
 * resolves who carried this shipment and snapshots it at write time, so a later
 * reassignment cannot move somebody else's reputation onto them.
 *
 * Two rules drive the whole shape of this form:
 *
 *  1. **A comment sends the review to moderation.** A rating on its own publishes
 *     immediately; a rating plus ANY title or body lands as `pending`. So the
 *     comment box is behind a disclosure that states the consequence, and the
 *     success toast is chosen from the status the server actually returned
 *     rather than assumed — otherwise a vendor who wrote a sentence comes back
 *     tomorrow, cannot find it, and files "my review disappeared".
 *  2. **It is write-once.** The router declares three routes: no PATCH, no PUT,
 *     no DELETE, no `/:id`. After submission the only mutation is an
 *     administrator's, which is why the warning sits above the button and not in
 *     a toast afterwards.
 *
 * Eligibility is checked when the dialog opens rather than when the button is
 * rendered — one request per intent to review, instead of one per shipment per
 * order opened.
 */
export function ReviewDeliveryDialog({
  open,
  onOpenChange,
  shipmentId,
  agencyName,
  agentName,
  onReviewed,
}: ReviewDeliveryDialogProps) {
  const { t } = useTranslation();
  const apiError = useApiError();

  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const [rating, setRating] = useState(0);
  const [commentOpen, setCommentOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Re-check on every open: a shipment can be reviewed from another device, and
  // "delivered" can arrive between two openings of the same order.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setEligibility(null);
    setCheckFailed(false);
    setChecking(true);
    setRating(0);
    setCommentOpen(false);
    setTitle('');
    setBody('');

    checkReviewEligibility(shipmentId)
      .then((result) => {
        if (cancelled) return;
        setEligibility(result);
        // Tell the caller straight away rather than waiting for a dismissal —
        // the control behind this dialog should stop offering a second attempt.
        if (result.reason === 'REVIEW_ALREADY_EXISTS') onReviewed();
      })
      .catch(() => {
        // A failed check is not a refusal. Surfacing it as "you may not review
        // this" would be a lie, so the form stays closed but the vendor is told
        // to retry rather than told no.
        if (!cancelled) setCheckFailed(true);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, shipmentId, onReviewed]);

  const handleSubmit = useCallback(async () => {
    if (rating < 1) return;
    setSubmitting(true);
    try {
      const review = await submitDeliveryReview(
        shipmentId,
        rating,
        commentOpen ? { title, body } : undefined,
      );
      // The server decides. A vendor who typed nothing is live; one who wrote a
      // sentence is queued — and telling them the wrong one is the whole reason
      // this reads `review.status` instead of `commentOpen`.
      toast.success(
        review.status === 'published'
          ? t('orders.review.submittedPublished')
          : t('orders.review.submittedPending'),
      );
      onReviewed();
      onOpenChange(false);
    } catch (err) {
      // Someone else's tab got there first, or a retry after a response we never
      // saw. Either way the review exists, so close rather than invite a retry
      // that can only fail the same way.
      if (err instanceof ApiError && err.code === 'REVIEW_ALREADY_EXISTS') {
        toast.info(t('orders.review.blocked.alreadyReviewed'));
        onReviewed();
        onOpenChange(false);
        return;
      }
      apiError.toast(err, { fallbackKey: 'orders.review.submitFailed' });
    } finally {
      setSubmitting(false);
    }
  }, [rating, shipmentId, commentOpen, title, body, t, onReviewed, onOpenChange, apiError]);

  const titleTooLong = title.trim().length > TITLE_MAX;
  const bodyTooLong = body.trim().length > BODY_MAX;
  const canSubmit =
    !!eligibility?.eligible && rating >= 1 && !titleTooLong && !bodyTooLong && !submitting;
  // A comment is only "written" once it survives trimming — whitespace alone is
  // never sent (the schema rejects an empty string), so it must not scare the
  // vendor with the moderation notice either.
  const willBeModerated = commentOpen && (!!title.trim() || !!body.trim());

  // Names the delivery without claiming to name who gets rated: the vendor picks
  // a shipment, and what the rating moves is deliberately not shown back here.
  const subtitle =
    agencyName && agentName
      ? t('orders.review.subtitleBoth', { agency: agencyName, agent: agentName })
      : agencyName
        ? t('orders.review.subtitleAgency', { agency: agencyName })
        : t('orders.review.subtitleGeneric');

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('orders.review.title')}
      description={subtitle}
      mobileClassName="h-auto max-h-[92dvh]"
      disableClose={submitting}
      footer={
        eligibility?.eligible ? (
          <>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {t('orders.review.submit')}
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.actions.close')}
          </Button>
        )
      }
    >
      {checking && (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t('orders.review.checking')}
        </div>
      )}

      {!checking && checkFailed && (
        <Alert variant="destructive">
          <AlertDescription>{t('orders.review.checkFailed')}</AlertDescription>
        </Alert>
      )}

      {!checking && !checkFailed && eligibility && !eligibility.eligible && (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>
            {t(eligibility.reason ? REASON_KEY[eligibility.reason] : 'orders.review.blocked.generic')}
          </AlertDescription>
        </Alert>
      )}

      {!checking && !checkFailed && eligibility?.eligible && (
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>{t('orders.review.ratingLabel')}</Label>
            <StarRatingInput value={rating} onChange={setRating} disabled={submitting} />
            <p className="text-xs text-muted-foreground">{t('orders.review.ratingHelp')}</p>
          </div>

          {!commentOpen ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={submitting}
              onClick={() => setCommentOpen(true)}
            >
              <MessageSquarePlus className="size-4" />
              {t('orders.review.addComment')}
            </Button>
          ) : (
            <div className="space-y-4 rounded-lg border border-border p-4">
              <div className="space-y-1.5">
                <Label htmlFor="review-title" className="text-xs text-muted-foreground">
                  {t('orders.review.titleLabel')}
                </Label>
                <Input
                  id="review-title"
                  value={title}
                  maxLength={TITLE_MAX}
                  disabled={submitting}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t('orders.review.titlePlaceholder')}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="review-body" className="text-xs text-muted-foreground">
                  {t('orders.review.bodyLabel')}
                </Label>
                <Textarea
                  id="review-body"
                  value={body}
                  maxLength={BODY_MAX}
                  rows={4}
                  disabled={submitting}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={t('orders.review.bodyPlaceholder')}
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={submitting}
                onClick={() => {
                  setCommentOpen(false);
                  setTitle('');
                  setBody('');
                }}
              >
                {t('orders.review.removeComment')}
              </Button>
            </div>
          )}

          {/*
            The consequence of the comment box, stated before the button and not
            after the submit. Shown only once something is actually typed, so an
            opened-then-emptied box does not warn about a moderation queue it
            will never enter.
          */}
          {willBeModerated && (
            <Alert>
              <Info className="size-4" />
              <AlertDescription>{t('orders.review.moderationNotice')}</AlertDescription>
            </Alert>
          )}

          <p className="text-xs text-muted-foreground">{t('orders.review.writeOnceNotice')}</p>
        </div>
      )}
    </ResponsiveModal>
  );
}
