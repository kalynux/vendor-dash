import { plural } from '../../types';

/** Billing: plan, credit wallet, media storage, checkout and payment methods. */
export const billing = {
    title: 'Billing',
    subtitle: 'Your plan, credits and payment methods',

    /** Subscription status on the vendor's own plan record. */
    status: {
        active: 'Active',
        pending_activation: 'Queued',
        expired: 'Expired',
        cancelled: 'Cancelled',
    },

    /** Billing term of a plan. */
    term: {
        never: 'Never expires',
        monthly: 'Monthly',
        months: 'Every {{count}} months',
        days: 'Every {{count}} days',
    },

    plan: {
        freePlan: 'Free plan',
        price: '{{price}} · {{term}}',
        info:
            'Your current subscription. Commission is what the platform takes per sale, and the ' +
            'credit allowance is what tops up your wallet each term. Hitting the product cap ' +
            "doesn't remove anything — it just stops you publishing more until you archive one " +
            'or upgrade.',
        renewsOrExpires: 'Renews / expires',
        neverExpires: 'Never expires',
        commission: 'Commission',
        creditAllowance: 'Credit allowance',
        activeProducts: 'Active products',
        pendingQueued: '{{name}} queued',
        pendingStarts: 'Starts when your current plan ends.',
        pendingStartsOn: 'Starts when your current plan ends on {{date}}.',
    },

    /**
     * Shown only in the packaged app, where purchases are disabled
     * (CAPACITOR-PLAN.md → D2, P5.3). Each line names the action that went and
     * where it went to — an action that just disappears reads as a bug.
     *
     * Deliberately NOT collapsed into one shared string: the three surfaces
     * remove three different things, and "purchases are unavailable" on the
     * payment-methods card would leave a vendor wondering whether their saved
     * cards had stopped working too.
     */
    mobile: {
        plans: 'Plan changes aren’t available in the app. Open your dashboard in a web browser to upgrade.',
        credits: 'Top-ups aren’t available in the app. Open your dashboard in a web browser to buy credits.',
        methods:
            'Adding a card isn’t available in the app. Open your dashboard in a web browser to add one — ' +
            'your saved methods still work here.',
    },

    plans: {
        title: 'Plans',
        info:
            "Upgrade any time. A paid plan you buy now doesn't cut your current one short — it's " +
            'queued and starts the day the current one ends.',
        current: 'Current',
        free: 'Free',
        creditsOnActivation: '{{credits}} credits on activation',
        activeProductsFeature: '{{cap}} active products',
        commissionFeature: '{{percent}}% commission per sale',
        yourPlan: 'Your plan',
        defaultTier: 'Default tier',
        queued: 'Plan queued',
        choose: 'Choose plan',
        queuedHint: 'A plan is already queued to start when your current one ends.',
        switchTo: 'Switch to {{name}}',
        planSummary: '{{name}} plan',
    },

    credits: {
        title: 'Credit wallet',
        info:
            'Credits pay for AI product indexing and for WhatsApp messages to customers. They ' +
            'never expire, and your plan tops them up each term. A refunded or disputed top-up ' +
            'claws its credits back, which can push the balance below zero.',
        currentBalance: 'Current balance',
        unit: 'credits',
        negativeWarning:
            'Your balance is negative after a refunded or disputed top-up. Credit-based features ' +
            '(AI indexing, WhatsApp messages) are paused until you top back up.',
        topUp: 'Top up',
        packCredits: '{{credits}} credits',
        buy: 'Buy',
        noPacks: 'No credit packs available right now.',
        buyTitle: 'Buy credits',
    },

    storage: {
        title: 'Media storage',
        used: '{{used}} of {{limit}} used',
        usedNoLimit: '{{used}} used · no limit',
        info:
            'Only product media counts toward this limit — download assets for digital products ' +
            'are excluded. Once you hit 100% new uploads are blocked until you free up space or ' +
            'upgrade, and media left unused for a long time may be removed.',
        usedLabel: 'Used',
        remaining: '{{size}} remaining',
        categories: {
            image: 'Images',
            video: 'Videos',
            document: 'Documents',
            audio: 'Audio',
            archive: 'Archives',
            other: 'Other',
        },
        fileCount: plural({ one: '{{count}} file', other: '{{count}} files' }),
        full: 'Your media storage is full. New uploads will be blocked until you free up space.',
        nearFull: "You've used {{percent}}% of your media storage.",
        freeUpSpace: 'Free up space',
        upgradePlan: 'Upgrade plan',
    },

    /** Saved payment methods (the wallet card + its add dialog). */
    methods: {
        title: 'Payment methods',
        info:
            'Saved methods pre-fill checkout when you buy a plan or credits. Only a token and the ' +
            'last digits are stored — never the full card number or the CVV. Up to {{max}} ' +
            "methods. Deleting your default doesn't promote another one, so pick a new default " +
            'yourself.',
        atLimit: 'You can save up to {{max}} methods.',
        empty: 'No saved payment methods yet. Add one to speed up checkout.',
        default: 'Default',
        expires: 'Expires {{date}}',
        setDefault: 'Set default',
        removeAria: 'Remove payment method',
        removeTitle: 'Remove payment method?',
        removeDescription: "{{label}} will be removed. This can't be undone.",
        addTitle: 'Add payment method',
        addDescription: 'Save a method to speed up checkout. We never store full card numbers or CVV.',
        type: 'Payment method',
        phone: 'Mobile money number',
        /** Which gateway will hold the token — a processor detail, not the brand. */
        processedBy: 'Processed by',
        holderNameOptional: 'Account holder name (optional)',
        holderNamePlaceholder: 'Account holder',
        cardHolderName: 'Card holder name',
        cardHolderPlaceholder: 'Name on card',
        cardDetails: 'Card details',
        makeDefault: 'Set as default',
        makeDefaultHint: 'Pre-selected at checkout.',
        save: 'Save method',
    },

    methodType: {
        card: 'Card',
        mobile_money: 'Mobile money',
        bank_transfer: 'Bank transfer',
    },

    gateway: {
        notchpay: 'NotchPay',
        mycoolpay: 'MyCoolPay',
        card: 'Card',
    },

    gatewayHelp: {
        mobileMoney: 'Mobile money — charged in XAF',
        card: 'Visa, Mastercard & more — charged in USD',
    },

    /** The plan / credit checkout dialog. */
    checkout: {
        savedMethods: 'Payment method',
        newMethod: 'New',
        payWith: 'Pay with',
        phone: 'Mobile money number',
        usdNotice:
            'Card payments are processed in USD; your bank may apply its own conversion. ' +
            "We'll show the exact dollar amount on the next step.",
        usdNoticeShort: 'Charged in USD; your bank may apply its own currency conversion.',
        nameOnCard: 'Name on card (optional)',
        nameOnCardPlaceholder: "Jane's Store",
        receiptEmail: 'Email for receipt (optional)',
        receiptEmailPlaceholder: 'vendor@example.com',
        continueToCard: 'Continue to card',
        confirmPayment: 'Confirm Payment · {{amount}}',
        cardDetails: 'Card details',
        willBeCharged: "You'll be charged",
        forSummary: 'for {{summary}} ({{amount}})',
        completingFor: 'Completing payment for {{summary}} ({{amount}})',
        pay: 'Pay {{amount}}',
        payNow: 'Pay now',
        waiting: 'Waiting for payment…',
        phonePrompt: 'Confirm the payment prompt on your phone.',
        dialUssd: 'Dial {{code}} to approve.',
        keepOpen: 'This can take up to a couple of minutes. Keep this window open.',
        closeKeepProcessing: "Close (we'll keep processing)",
        redirectingToBank: 'Redirecting you to your bank to confirm the payment…',
        cardConfirmed: 'Card confirmed — applying your purchase…',
        confirmingPayment: 'Confirming your payment…',
        successTitle: 'Payment confirmed',
        successDescription: 'Your account has been updated.',
        failedTitle: 'Payment failed',
        failedDescription: 'The payment was not completed. No charge was made — you can try again.',
        timeoutTitle: 'Still processing',
        timeoutDescription:
            "We couldn't confirm the payment in time. If you completed it, your balance will " +
            'update shortly — check your history.',
        startOver: 'Start over',
        /** Shown after returning from a 3-D Secure bank redirect. */
        resumePending: "We're still confirming your card payment — it'll update here shortly.",
        resumeFailed: 'The card payment was not completed.',
    },

    /** The Stripe-hosted card fields. */
    cardForm: {
        unavailable: 'Card payments are unavailable right now.',
        loadFailed: 'Could not load the card form. Please try again.',
        loading: 'Loading card form…',
        loadingSecure: 'Loading secure card form…',
        notReady: 'Card form is not ready yet.',
        invalidCard: 'Could not validate the card.',
        chargeFailed: 'Your card could not be charged. Please try again.',
        notCompleted: 'The card payment was not completed. Please try again.',
        failed: 'The card payment failed. Please try again.',
    },

    /** The decorative card visual in the checkout. */
    cardPreview: {
        cardType: 'Card type',
        fallbackBrand: 'CARD',
        holder: 'Card holder',
        valid: 'Valid',
        expiryPlaceholder: 'MM/YY',
    },

    settings: {
        title: 'Expiry reminders',
        info:
            "How far ahead of your plan's expiry date we warn you, so a lapse never catches you " +
            'off guard. Set it to 7 and a plan ending on the 30th triggers a reminder on the ' +
            '23rd. Between {{min}} and {{max}} days.',
        hintLabel: 'About the reminder window',
        hint: 'Days of notice before the plan expires. Between {{min}} and {{max}}.',
        daysLabel: 'Days before expiry',
    },

    /** Field-level validation. Referenced by the zod schema via key. */
    validation: {
        daysRequired: 'Enter a number of days',
        daysInteger: 'Must be a whole number',
        daysMin: 'Must be at least 0',
        daysMax: 'Must be at most 90',
        email: 'Enter a valid email, or leave it blank.',
    },

    toast: {
        planPurchased: 'Plan purchased',
        creditsAdded: 'Credits added',
        methodAdded: 'Payment method added',
        methodRemoved: 'Payment method removed',
        pickNewDefault: 'Pick a new default payment method.',
        settingsUpdated: 'Settings updated',
    },

    errors: {
        loadFailed: "We couldn't load your billing details. Please try again.",
        loadMethodsFailed: "We couldn't load your payment methods. Please try again.",
        loadSettingsFailed: "We couldn't load your billing settings. Please try again.",
        updateSettingsFailed: "We couldn't update your billing settings. Please try again.",
        defaultFailed: "We couldn't update your default payment method. Please try again.",
        removeMethodFailed: "We couldn't remove that payment method. Please try again.",
        methodFailed: "We couldn't save that payment method. Please try again.",
        paymentFailed: 'The payment could not be completed. Please try again.',
    },
} as const;

export default billing;
