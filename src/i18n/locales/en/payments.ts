/**
 * Shared payment-method UI — the brand pickers used by Billing (saved methods
 * and checkout), Account → Payout Setup, and onboarding step 1.
 *
 * Brand names themselves (MTN Mobile Money, Visa, Wave…) are proper nouns and
 * live in `components/payment-methods/paymentBrands.ts`, never here.
 */
export const payments = {
    /** The two top-level choices a vendor picks between when paying. */
    category: {
        card: {
            title: 'Card payment',
            /** Named because the vendor is handing card details to Stripe, not to us. */
            provider: 'Secured by Stripe',
        },
        mobileMoney: {
            title: 'Mobile Money',
            payFrom: 'Approve on your phone',
        },
    },

    brands: {
        /** The card networks' catch-all — the one entry that is not a proper noun. */
        otherCard: 'Other card',
    },

    providers: {
        label: 'Provider',
        /** Empty state of the provider dropdown. */
        placeholder: 'Choose a provider',
        /** Accessible name for the logo grid when no visible label sits above it. */
        legend: 'Mobile money provider',
        /**
         * Badge on a choice that exists but cannot be used yet — a wallet no
         * gateway can charge, or a payout destination we cannot settle.
         */
        soon: 'Soon',
        soonHint: '{{brand}} cannot be charged yet.',
        soonNote: '{{brands}} can receive payouts, but cannot be charged yet.',
    },
} as const;

export default payments;
