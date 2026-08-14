/** Account area: profile, store identity, addresses, security, billing, payouts. */
export const account = {
    title: 'Account',
    subtitle: 'Manage your personal account, store identity, and payouts',

    /**
     * One line per Account sub-route, shown under the "Account › <tab>" heading.
     * `subtitle` above describes the whole section; these describe the single
     * surface the vendor actually opened. Labels come from `nav.items.*` so the
     * crumb and the sidebar can never drift apart.
     */
    tabSubtitles: {
        profile: 'Your personal details, photo, and the language the dashboard speaks to you in',
        store: 'Your public store identity, support contacts, and vacation mode',
        addresses: 'The business locations your products are shipped and picked up from',
        security: 'Your password, two-factor authentication, and signed-in devices',
        billing: 'Your plan, credit wallet, saved payment methods, and storage usage',
        payout: 'Your earnings balance and where withdrawals are sent',
    },

    /** Shared by every settings/account tab (the floating save pill). */
    unsavedBar: {
        label: 'Unsaved changes',
        discard: 'Discard',
        save: 'Save',
        saveChanges: 'Save changes',
    },

    section: {
        aboutTitle: 'About {{title}}',
        moreInformation: 'More information',
    },

    profile: {
        title: 'Profile',
        info: 'Your personal details. The name and photo here are what teammates and support see — your public storefront name lives under the Store tab. Tap your photo to pick a new one from your media library.',
        changePhoto: 'Change photo',
        addPhoto: 'Add photo',
        removePhoto: 'Remove photo',
        fullName: 'Full Name',
        fullNamePlaceholder: 'Your name',
        nameTooShort: 'Name must be at least 2 characters.',
        email: 'Email',
        emailHintLabel: 'About your email',
        emailHint: "This is the address you sign in with, and where receipts and account notices are sent. It can't be edited here — contact support to change it.",
        phone: 'Phone',
        phoneHintLabel: 'About your phone number',
        phoneHint: 'Your account phone number, used for account and payout follow-ups. Pick the country it belongs to, then enter it the way you would dial it there — it is saved with the country code.',
        whatsapp: 'WhatsApp Number',
        whatsappHintLabel: 'About your WhatsApp number',
        whatsappHint: 'The number you take order questions on. Separate from your account phone — the one customers see on your storefront is set under Store → Support & contact.',
        role: 'Role',
        roleHintLabel: 'About your role',
        roleHint: 'What this account may do on the platform. Set by the platform and not editable.',
        roles: {
            vendor: 'Vendor',
        },
        updated: 'Profile updated',
    },

    /** Business addresses (Account → Addresses). */
    addresses: {
        title: 'Business addresses',
        /** One clause per blocking address, joined into `cannotRemove`. */
        blockedByProducts:
            '“{{label}}” is used as a pickup location on {{count}} product(s)',
        cannotRemove: "Can't remove: {{list}}. Reassign those products first.",
    },

    /** Account → Security. */
    security: {
        passwordTitle: 'Change Password',
        passwordInfo:
            "Use a password you don't use anywhere else. Changing it signs out every other device and browser — this one stays signed in.",
        currentPassword: 'Current Password',
        newPassword: 'New Password',
        confirmPassword: 'Confirm New Password',
        showPassword: 'Show password',
        hidePassword: 'Hide password',
        passwordHint: '8+ chars with upper & lower case, a number, and a special character.',
        passwordsDontMatch: "Passwords don't match.",
        updatePassword: 'Update Password',
        updated: 'Password updated. Every other device has been signed out.',
        updateFailed: 'We could not change your password. Please try again.',
        rules: {
            length: 'At least 8 characters',
            uppercase: 'At least one uppercase letter',
            lowercase: 'At least one lowercase letter',
            number: 'At least one number',
            special: 'At least one special character',
        },
        twoFactorTitle: 'Two-Factor Authentication',
        twoFactorInfo:
            'A second step at login — a code from your phone on top of your password. Not available yet.',
        twoFactorToggle: 'Enable two-factor authentication',
        sessionsTitle: 'Signed-in Devices',
        /**
         * There will be no device list to show: sign-in tokens are stateless by
         * design, so the platform keeps no record of which devices hold one.
         * Changing the password is the revocation — that is the whole mechanism,
         * so the panel says so instead of promising a list that isn't coming.
         */
        sessionsInfo:
            'Signing out other devices is done by changing your password — it invalidates every sign-in but this one, everywhere, straight away.',
        sessionsHowTo:
            'Changing your password above signs out every other device and browser immediately. Use it if you think someone else has access.',
        notAvailableYet: 'Not available yet — this will be enabled in a future update.',
    },

    /** Account → Payout: the earnings balance and withdrawal requests. */
    earnings: {
        title: 'Earnings',
        info: {
            balances:
                '<0>Available</0> is what you can withdraw now. <1>Pending</1> is money from orders that haven’t cleared yet, and <2>Requested</2> is already locked into a withdrawal.',
            minimum: 'The minimum withdrawal is {{amount}}.',
            autoThreshold:
                'If your available balance reaches {{amount}}, we automatically request a payout on your behalf so your funds don’t sit unclaimed. Make sure you have a payout method saved — otherwise the automatic request can’t be created and your balance will keep growing past the threshold until you add one.',
        },
        available: 'Available',
        pending: 'Pending',
        requested: 'Requested',
        requestWithdrawal: 'Request Withdrawal',
        nothingAvailable: 'Nothing available to withdraw yet.',
        belowMinimum: 'Minimum withdrawal is {{amount}}.',
        latestRequest: 'Latest withdrawal request',
        requestedOn: '{{amount}} · requested {{date}}',
        autoOpened: 'Opened automatically because your available balance reached {{amount}}.',
        viewTicket: 'View ticket',
        requestCreated: 'Payout request created.',
        loadFailed: 'Failed to load earnings.',
        requestFailed: 'Failed to request payout.',
        status: {
            pending: 'Pending review',
            paid: 'Paid',
            rejected: 'Rejected',
        },
        origin: {
            manual: 'Requested by you',
            auto_threshold: 'Automatic',
        },
        errors: {
            alreadyPending: 'You already have a payout request in progress — track it below.',
            methodMissing: 'Add a payout method below before requesting a withdrawal.',
            noAvailableBalance: 'There is no available balance to withdraw yet.',
            belowMinimum:
                'Your available balance is below the {{amount}} minimum for a withdrawal.',
        },
    },

    localization: {
        title: 'Localization',
        info: "Where you operate, and the language everything reaches you in. Your country drives tax, shipping and address rules; your timezone is used for every date and time in the dashboard.",
        country: 'Country',
        countryHintLabel: 'About your country',
        countryHint: 'Set once during onboarding and locked afterwards — it decides your tax, shipping, and address rules, and your business addresses must fall inside it. Contact support if it needs to change.',
        countryReadOnly: 'Country (read-only)',
        timezone: 'Timezone',
        timezoneHintLabel: 'About your timezone',
        timezoneHint: "Every order time, report, and schedule in the dashboard is shown in this zone. Changing it re-labels existing timestamps; it doesn't move them.",
        timezonePlaceholder: 'Select your timezone',
        language: 'Language',
        languageHintLabel: 'About your language',
        /**
         * This hint used to end "It does not change the language of this
         * dashboard." — that is no longer true: the same field now drives both.
         */
        languageHint: 'The language of this dashboard, and of every notification you receive — email, WhatsApp, Telegram and in-app alerts. The dashboard switches over as soon as you save.',
        languagePlaceholder: 'Select a language',
    },
} as const;

export default account;
