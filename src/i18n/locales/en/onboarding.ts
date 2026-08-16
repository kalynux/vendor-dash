/** The four-step vendor onboarding wizard, plus its guard and error boundary. */
export const onboarding = {
    stepLabel: 'Step {{current}} of {{total}}',
    loading: 'Setting up your account…',

    steps: {
        basicSetup: 'Basic Setup',
        deliveryLinking: 'Delivery',
        branding: 'Branding',
        policySetup: 'Policies',
    },

    stepSublabels: {
        basicSetup: 'Country, timezone & payout',
        deliveryLinking: 'Link a delivery agency',
        branding: 'Logo & addresses (optional)',
        policySetup: 'Return, cancellation & support (optional)',
    },

    layout: {
        brand: 'Wi-Mall',
        goBack: 'Go back',
        goBackTo: 'Go back to {{step}}',
        progress: 'Onboarding progress',
        signOut: 'Sign out',
    },

    optional: 'This step is optional',
    saveAndFinish: 'Save & Finish',
    continuing: 'Continuing…',

    basicSetup: {
        heading: 'Basic Setup',
        subheading: "Tell us where you operate and how you'd like to receive payouts.",
        saved: 'Basic setup saved!',
        title: 'Tell us where you operate',
        description: 'Your country sets your tax, shipping and address rules. It cannot be changed later.',
        country: 'Country',
        countryPlaceholder: 'Select your country',
        countryLocked: 'Chosen once, then locked — contact support if it needs to change.',
        timezone: 'Timezone',
        timezonePlaceholder: 'Select your timezone',
        payoutTitle: 'How should we pay you?',
        payoutDescription: 'You can add more methods later from Payout Setup.',
    },

    deliveryLinking: {
        heading: 'Delivery Linking',
        askProductType: 'Do you sell physical products that need to be shipped?',
        physicalSubheading:
            'Delivery agencies are connected independently of setup — this is optional.',
        serviceSubheading: 'No delivery needed for your business.',
        physicalOption: 'Yes, I sell physical products',
        physicalOptionHint: 'I need a delivery agency to ship orders to customers.',
        serviceOption: 'No, I only offer services',
        serviceOptionHint: 'My business is service-based — no physical shipping needed.',
        serviceOnlyTitle: 'Service-only vendor',
        serviceOnlyDescription:
            'No delivery agency needed. This step will be skipped and you can proceed to the ' +
            'next one. You can always link a delivery agency later from Settings.',
        headStartTitle: 'Get a head start (optional)',
        headStartDescription:
            'Delivery agencies now require an agreement — request a connection now so approval ' +
            "time overlaps with the rest of setup, or skip this and do it later from Settings → " +
            "Delivery. Either way, you don't need one to continue.",
        switchToService: 'I only sell services — skip this step',
        switchToPhysical: 'Actually, I do sell physical products',
        stepComplete: 'Step complete!',
        title: 'Choose a delivery agency',
        description: 'Agencies carry your physical orders. You can connect more later, or skip for now.',
        skip: 'Skip for now',
        selected: 'Selected',
        noAgencies: 'No delivery agencies are available in your area yet.',
    },

    branding: {
        heading: 'Branding & Addresses',
        subheading:
            'Optional — add your logo and store address to give customers a better experience. ' +
            'You can always do this later.',
        profileComplete: 'Profile complete! Welcome aboard 🎉',
        setupComplete: 'Setup complete! Welcome to the dashboard 🎉',
        title: 'Make it yours',
        description: 'Add a logo and a banner so customers recognise your store.',
        logo: 'Logo',
        banner: 'Banner',
        businessName: 'Business name',
        businessDescription: 'What do you sell?',
        addressTitle: 'Business address',
        addressDescription: 'Where you dispatch orders from. It has to be inside your registered country.',
    },

    policySetup: {
        heading: 'Policy Setup',
        subheading:
            "Define your store's return, cancellation, and support policies. All sections are " +
            'optional and can be updated later from your dashboard.',
        setupComplete: 'Setup complete! Welcome to your dashboard.',
        title: 'Set your policies',
        description: 'How returns, cancellations and support work for your customers.',
        returnPolicy: 'Return policy',
        cancellationPolicy: 'Cancellation policy',
        supportContact: 'Support contact',
    },

    guard: {
        checkingSession: 'Checking your session…',
        signInRequired: 'Please sign in to continue.',
    },

    router: {
        unknownStepTitle: 'Unexpected onboarding state',
        unknownStepDescription:
            'The server returned an unrecognised onboarding step ({{step}}). Please contact ' +
            'support if this persists.',
        unknownStepNone: 'none',
    },

    errorBoundary: {
        title: 'Something went wrong',
        description:
            'An unexpected error occurred. Your progress is saved — you can try again safely.',
        reload: 'Reload',
    },

    errors: {
        continueFailed: 'Could not continue. Please try again.',
        saveFailed: "We couldn't save this step. Please try again.",
        skipFailed: 'Could not skip. Please try again.',
    },

    toast: {
        stepSaved: 'Saved',
        completed: 'Your store is ready',
    },

    /**
     * Field-level validation for the wizard schemas. These are referenced by
     * *key* from `onboarding/schemas/onboarding.schemas.ts` — a zod schema is
     * built at module load, long before a locale exists — and resolved at the
     * render site through `useMessage()`. The same schemas back the Account →
     * Payout / Branding / Policies tabs, so the wording stays surface-neutral.
     */
    validation: {
        providerRequired: 'Provider is required',
        accountNameRequired: 'Account name is required',
        bankNameRequired: 'Bank name is required',
        accountNumberRequired: 'Account number is required',
        cardBrandRequired: 'Select the card network',
        cardLast4: 'Enter the last 4 digits of the card',
        cardHolderRequired: 'Cardholder name is required',
        cardExpiryMonthRequired: 'Select the expiry month',
        cardExpiryYearRequired: 'Select the expiry year',
        cardExpired: 'This card has already expired',
        issuingBankMax: 'Issuing bank must be 100 characters or fewer',
        countryIso2: 'Must be a valid 2-letter country code',
        countryIso2Letters: 'Must be a 2-letter country code',
        timezoneRequired: 'Timezone is required',
        payoutMethodMin: 'At least one payout method is required',
        payoutMethodMax: 'You can add at most 3 payout methods',
        labelRequired: 'Label is required',
        labelMax: 'Label must be 50 characters or fewer',
        addressRequired: 'Address is required',
        addressMax: 'Address must be 200 characters or fewer',
        cityRequired: 'City is required',
        cityMax: 'City must be 100 characters or fewer',
        stateMax: 'State/region must be 100 characters or fewer',
        min0: 'Must be 0 or more',
        min1: 'Must be 1 or more',
        max180Days: 'Must be 180 days or fewer',
        max30Days: 'Must be 30 days or fewer',
        max500Chars: 'Must be 500 characters or fewer',
        max200Chars: 'Must be 200 characters or fewer',
        max50Chars: 'Must be 50 characters or fewer',
        refundPercentageRequired: 'Refund percentage is required for partial refunds',
        daysRequired: 'Number of days is required',
        feeValueRequired: 'Fee value is required',
        refundValueRequired: 'Refund value is required',
        contactRequired: 'Contact is required',
        maxChannels: 'You can add at most 4 support channels',
        maxLanguages: 'You can add at most 20 languages',
        maxDocuments: 'You can upload at most 2 documents',
    },
} as const;

export default onboarding;
