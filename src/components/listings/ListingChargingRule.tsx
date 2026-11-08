import { useListingActionCosts } from '@/services/listings.service';
import { useFormatters, useTranslation } from '@/i18n';

/**
 * "The first contact a customer unlocks costs 7 credits, each further one 4…"
 *
 * The figures come from the server's price list, never from this app. Until it
 * answers — or if it cannot — the same rule is said without figures rather
 * than with a guess.
 */
export function ListingChargingRule({ className }: { className?: string }) {
    const { t } = useTranslation();
    const fmt = useFormatters();
    const costs = useListingActionCosts();
    return (
        <p className={className}>
            {costs
                ? t('listings.charging.rule', {
                      first: fmt.number(costs.listingRevealFirst),
                      next: fmt.number(costs.listingRevealNext),
                  })
                : t('listings.charging.ruleNoPrices')}
        </p>
    );
}
