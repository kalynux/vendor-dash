import { plural } from '../../types';

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
        verification: 'The identity documents an administrator reviews before verifying your shop',
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

    /**
     * Identity verification (Account → Verification) — `/api/vendor/kyc`.
     *
     * ⚠ Copy rule: nothing here may promise that a complete submission is
     * approved, or that an incomplete one is refused. The backend grades
     * nothing; a person decides. "Required" in this namespace always means
     * "required by the reviewers", which is guidance, not a gate.
     */
    verification: {
        title: 'Identity verification',
        info1: 'Verified shops are trusted by more buyers. An administrator reviews the documents you upload here and decides whether to verify your account.',
        info2: 'Your documents are private. They are never shown on your storefront, never shared with customers or delivery agencies, and can only be opened by you and the reviewer.',
        info3: 'Nothing is checked automatically — a person reads your documents. If something is missing or unreadable they will tell you why, and you can fix it and send it again.',
        saved: 'Verification details saved',
        submitted: 'Sent for review',
        uploadsSaveImmediately: 'Documents are saved as soon as you add them. The identity number and home address below need the Save button.',

        status: {
            draft: {
                title: 'Not sent yet',
                body: 'Add your documents below, then send them for review. You can come back and change anything until you send.',
            },
            under_review: {
                title: 'Being reviewed',
                body: 'Your documents are with a reviewer. You can still look at what you sent, but you cannot change it until they decide.',
            },
            verified: {
                title: 'Verified',
                body: 'Your identity has been verified. These documents are now locked — contact support if something needs to change.',
            },
            rejected: {
                title: 'Not accepted',
                body: 'A reviewer could not verify your account. Fix what they mention below and send it again.',
            },
            rejectionReason: 'Reason',
            submittedOn: 'Sent on {{date}}',
            verifiedOn: 'Verified on {{date}}',
            lockedHint: 'This record is locked and cannot be edited right now.',
        },

        checklist: {
            required: 'Required',
            optional: 'Optional',
            complete: 'You have everything the reviewers ask for.',
            remaining: plural({
                one: '{{count}} thing still missing before you send.',
                other: '{{count}} things still missing before you send.',
            }),
            items: {
                idNumber: 'Your ID number',
                idCardFront: 'Front of your ID card',
                idCardBack: 'Back of your ID card',
                selfieWithId: 'A photo of you holding your ID card',
                homeAddress: 'Your home address',
                homeAddressSketch: 'A map screenshot of where you live',
                storeAddressSketch: 'A map screenshot of your shop',
            },
        },

        identity: {
            title: 'Your identity',
            idNumber: 'ID number',
            idNumberPlaceholder: 'The number printed on your ID card',
            idNumberHint: 'Type it exactly as it appears on the card. Any format is accepted — a reviewer checks it against your scans.',
        },

        slots: {
            idCardFront: 'Front of your ID card',
            idCardFrontHint: 'A photo or scan. JPG, PNG, WebP or PDF, up to 10 MB.',
            idCardBack: 'Back of your ID card',
            idCardBackHint: 'The back of the same card.',
            selfieWithId: 'Photo of you holding your ID',
            selfieWithIdHint: 'Your face and the card must both be clearly visible.',
            homeAddressSketch: 'Map of where you live',
            homeAddressSketchHint: 'A screenshot of the map with your house marked, or a drawing of the route to it.',
            storeAddressSketch: 'Map of your shop',
            storeAddressSketchHint: 'A screenshot of the map with your shop marked, or a drawing of the route to it.',
        },

        locations: {
            title: 'Your locations',
            info: 'Reviewers check that your addresses can be found on a map. Your shop addresses are edited under Addresses — only your home address is set here.',
            homeAddress: 'Home address',
            homeAddressPlaceholder: 'Search for your home address',
            homeAddressHint: 'Pick your address from the search results so it carries map coordinates. A typed address a reviewer cannot find on a map does not count.',
            noHomeAddress: 'No home address set.',
            notGeocoded: '"{{address}}" was saved without map coordinates. Search for it again and pick it from the list.',
        },

        document: {
            pdf: 'PDF',
            view: 'View {{label}}',
            remove: 'Remove {{label}}',
            unavailable: "Can't load",
            quotaBlocked: 'Over storage limit',
            quotaBlockedLong: 'This file is held back because your account is over its storage limit. Free up space or upgrade your plan to see it again — the file has not been deleted.',
            save: 'Save a copy',
            saveFailed: 'Could not save the file.',
        },

        upload: {
            add: 'Add',
            replace: 'Replace',
            remaining: '{{current}} of {{max}} added',
            wrongType: '{{name}} is not a supported file. Use a JPG, PNG, WebP or PDF.',
            tooLarge: '{{name}} is larger than 10 MB. Try a smaller photo or a lower-quality scan.',
            slotFull: 'You can add up to {{max}} files here, and you already have {{current}}. Remove one first.',
            tooMany: 'You can add at most {{max}} files at a time.',
        },

        submit: {
            title: 'Send for review',
            body: 'When you are ready, send your documents to an administrator. Your details are locked while they review.',
            resubmitBody: 'Fix what the reviewer mentioned, then send your documents again.',
            action: 'Send for review',
            resubmitAction: 'Send again',
            confirmTitle: 'Send for review?',
            confirmBody: 'Your documents go to an administrator.',
            confirmIncomplete: plural({
                one: 'One thing the reviewers ask for is still missing.',
                other: '{{count}} things the reviewers ask for are still missing.',
            }),
            confirmAction: 'Send',
            freezeWarning: 'Once you send, you cannot change your documents until a reviewer decides. You will still be able to see what you sent.',
            unsavedWarning: 'You have unsaved changes above. Save them first, or they will not be part of what you send.',
        },
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
