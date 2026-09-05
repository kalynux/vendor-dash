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

    /**
     * Account → Security → the sign-in identifiers panel.
     *
     * 🔴 Deliberately worded as "sign-in details", never as "contact details":
     * the Profile tab has its own editable Phone that writes the vendor *role*
     * profile, and two panels both called "contact" would read as duplicates of
     * one field when they are two records with two endpoints.
     *
     * ⚠ Nothing here may say the vendor will be signed out. Neither change
     * stamps the password epoch, so every existing session survives — that is
     * the *password* panel's warning, not this one's.
     */
    contact: {
        title: 'Sign-in details',
        info: 'The email address and phone number you sign in with. Changing either takes two steps, and the old one keeps working until the new one is confirmed.',
        emailLabel: 'Email address',
        phoneLabel: 'Phone number',
        change: 'Change',
        cancelChange: 'Cancel change',

        newEmailLabel: 'New email address',
        newEmailPlaceholder: 'you@example.com',
        emailFlowHint:
            "We'll email a confirmation link to the new address. Open it and confirm there — the change only takes effect once you do. The link is valid for one hour.",
        sendLink: 'Send confirmation link',
        emailChangeRequested: 'Confirmation link sent to the new address.',
        emailChangeCancelled: 'Email change cancelled.',
        /** Explicit, or a vendor who closes the tab tries the new address and fails. */
        emailPendingNotice:
            'Keep signing in with your current email until you confirm this from the link we sent.',

        newPhoneLabel: 'New phone number',
        /** 🔴 There is no SMS code — the WhatsApp connection IS the proof. */
        whatsappRequired:
            'Changing your phone number needs a linked WhatsApp account using the new number. A linked Telegram account does not count.',
        whatsappNumberMismatch:
            "Your linked WhatsApp number ends in {{hint}}, which doesn't match this one. Link WhatsApp with the new number first, or the confirmation will be refused.",
        manageConnections: 'Manage connections',
        phoneFlowHint:
            "Next you'll confirm from this page — we check that your linked WhatsApp account uses this number. There is no code to type. You have 24 hours.",
        phoneChangeRequested: 'Now confirm the change to finish.',
        phoneChangeCancelled: 'Phone change cancelled.',
        phoneChanged: 'Your phone number has been changed.',
        confirmPhone: 'Confirm change',
        phonePendingNotice:
            'Keep signing in with your current number until this is confirmed.',

        pendingTarget: 'Waiting to switch to {{target}}',
        pendingExpires: 'Expires {{when}}.',
        pendingExpired: 'This request has expired. Cancel it and start again.',

        // `confirmPage` is GONE with the page it belonged to — the main site
        // serves /account/confirm-email for all four apps now. See App.tsx.

        errors: {
            loadFailed: "We couldn't load your sign-in details. Please try again.",
            actionFailed: "We couldn't complete that. Please try again.",
            confirmFailed: "We couldn't confirm this change. The link may have expired.",
        },
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
        /**
         * The whole panel is hidden unless the device actually has enrolled
         * biometry, so none of this is ever seen on the web.
         *
         * ⚠ There is deliberately no "turn on" control here: switching it on
         * needs the password, and this screen does not have it. Asking for it
         * again just to store it would be a second password prompt whose only
         * purpose is to be saved — so the switch-on lives on the sign-in screen,
         * where the password is being typed anyway, and this panel says so.
         */
        biometricTitle: 'Fingerprint sign-in',
        biometricInfo:
            'Sign in on this phone with the fingerprint or face it already recognises, instead of typing your password.',
        biometricOn: 'On for this phone',
        biometricOnDesc:
            'Your sign-in details are held in this phone’s secure storage and released only after the phone confirms it is you.',
        biometricOffDesc:
            'Turn this on from the sign-in screen — tick “next time, sign in with your fingerprint” when you enter your password.',
        biometricTurnOff: 'Turn off',
        biometricTurnedOff: 'Fingerprint sign-in is off on this phone.',

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
