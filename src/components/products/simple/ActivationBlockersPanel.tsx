import { Link } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPickupGuidance } from '@/services/products.service';
import { useTranslation } from '@/i18n';
import {
  agencyBlockerText,
  agencyBlockerRemedy,
  DEFAULT_AGENCY_SETTING_PATH,
  NO_DELIVERY_AGENCY_CODE,
  readAgencyBlockerDetails,
} from '@/lib/agencyBlocker';
import { PickupAddressPicker } from './PickupAddressPicker';
import type { ApiPickupLocation, SimpleActivationMeta } from '@/types/product.types';

interface ActivationBlockersPanelProps {
  activation: SimpleActivationMeta;
  /** True when reporting a demotion caused by an edit rather than a fresh create. */
  demoted?: boolean;
  isBusy?: boolean;
  onRetryPublish: () => void | Promise<void>;
  onPickupLocationChosen: (location: ApiPickupLocation) => void | Promise<void>;
  onDone: () => void;
  /** Brings this product's own delivery agency setting into view. */
  onShowProductAgency?: () => void;
}

/**
 * Renders `meta.activation.blockers` as a to-do list. The product exists and is
 * not lost — it is simply a draft until the checklist is clear.
 */
export function ActivationBlockersPanel({
  activation,
  demoted = false,
  isBusy = false,
  onRetryPublish,
  onPickupLocationChosen,
  onDone,
  onShowProductAgency,
}: ActivationBlockersPanelProps) {
  const { t, tDynamic, hasKey } = useTranslation();
  if (activation.published) return null;

  // The delivery agency blocker says which agency problem it is (`details`),
  // and each problem has its own fix — one button per distinct fix.
  const agencyBlockers = activation.blockers
    .filter((blocker) => blocker.code === NO_DELIVERY_AGENCY_CODE)
    .map((blocker) => readAgencyBlockerDetails(blocker.details));
  const remedies = Array.from(
    new Map(
      agencyBlockers
        .map(agencyBlockerRemedy)
        // A button that would scroll to a section this page can't reach is no button.
        .filter((remedy) => remedy.target === 'agencySettings' || onShowProductAgency)
        .map((remedy) => [`${remedy.target}:${remedy.labelKey}`, remedy] as const),
    ).values(),
  );

  // The pickup hint for "no agency" / "agency inactive" only restates what a
  // detailed agency blocker now says better, with a second button to the same place.
  const hasDetailedAgencyBlocker = agencyBlockers.some((details) => details !== null);
  const pickupGuidance = getPickupGuidance(activation.pickupReason);
  const guidance =
    hasDetailedAgencyBlocker &&
    (activation.pickupReason === 'no_agency' || activation.pickupReason === 'agency_inactive')
      ? null
      : pickupGuidance;

  // Deduplicated because the backend emits one blocker per offending variant for
  // some codes, and they collapse onto the same sentence once localized.
  const lines = Array.from(
    new Set(
      activation.blockers.map((blocker) => {
        if (blocker.code === NO_DELIVERY_AGENCY_CODE) {
          return agencyBlockerText(t, blocker.details, blocker.message);
        }
        const contextKey = `errors.contexts.simpleProduct.${blocker.code}`;
        if (hasKey(contextKey)) return tDynamic(contextKey);
        const codeKey = `errors.codes.${blocker.code}`;
        if (hasKey(codeKey)) return tDynamic(codeKey);
        // A code we have no wording for: the server's own text (English) still
        // says what to fix, which our generic line can't.
        return blocker.message?.trim() || t('products.blockers.unknown');
      }),
    ),
  );

  return (
    // Flat on a phone — it shares the page with the form, and a box there is a
    // box inside the page's own gutter — with the same vertical padding as the
    // form's sections, so it sits as far below the header as they do. One card
    // from `md` up, like them.
    <div className="space-y-5 max-md:py-5 md:rounded-xl md:border md:bg-card md:p-6 md:text-card-foreground md:shadow-sm">
      {/* The icon sits in the heading line rather than in a column of its own,
          so everything below starts on the same left edge as the heading. */}
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-base font-semibold leading-tight">
          <AlertCircle className="size-5 shrink-0 text-amber-600 dark:text-amber-500" />
          {t(demoted ? 'products.blockers.demoted' : 'products.blockers.savedAsDraft')}
        </h2>
        {lines.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {t('products.blockers.summary', { count: lines.length })}
          </p>
        )}
      </div>

      {lines.length > 0 && (
        // Localized from `blocker.code` rather than rendered from
        // `blocker.message`: the backend writes that message for a vendor to
        // read, but only ever in English. It is shown only for a code (or
        // agency reason) we have no wording for.
        <ul className="list-disc space-y-1.5 pl-5 text-sm marker:text-muted-foreground">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      {remedies.length > 0 && (
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap">
          {remedies.map((remedy) =>
            remedy.target === 'agencySettings' ? (
              <Button
                key={`${remedy.target}:${remedy.labelKey}`}
                asChild
                variant="outline"
                className="max-md:h-11 max-md:w-full"
              >
                <Link to={DEFAULT_AGENCY_SETTING_PATH}>{t(remedy.labelKey)}</Link>
              </Button>
            ) : (
              <Button
                key={`${remedy.target}:${remedy.labelKey}`}
                type="button"
                variant="outline"
                onClick={onShowProductAgency}
                className="max-md:h-11 max-md:w-full"
              >
                {t(remedy.labelKey)}
              </Button>
            ),
          )}
        </div>
      )}

      {guidance && (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">{t(guidance.titleKey)}</p>
            <p className="text-sm text-muted-foreground">{t(guidance.bodyKey)}</p>
          </div>

          {guidance.action.kind === 'address_picker' && (
            <PickupAddressPicker disabled={isBusy} onChoose={onPickupLocationChosen} />
          )}

          {guidance.action.kind === 'link' && (
            <Button asChild variant="outline" className="max-md:h-11 max-md:w-full">
              <Link to={guidance.action.to}>{t(guidance.action.labelKey)}</Link>
            </Button>
          )}
        </div>
      )}

      {/* DOM order is the wide-screen reading order; a phone reverses it so the
          primary action lands on top. */}
      <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
        <Button
          variant="outline"
          onClick={onDone}
          disabled={isBusy}
          className="max-md:h-11 max-md:w-full"
        >
          {t('products.blockers.done')}
        </Button>
        <Button
          onClick={() => void onRetryPublish()}
          disabled={isBusy}
          className="max-md:h-11 max-md:w-full"
        >
          {isBusy && <Loader2 className="size-4 animate-spin" />}
          {t('products.blockers.retryPublish')}
        </Button>
      </div>
    </div>
  );
}
