/** Settings area: policies, notification channels, store preferences. */
export const settings = {
    title: 'Settings',
    subtitle: 'Configure policies, notifications, and preferences for your store',

    /** One line per Settings sub-route — see `account.tabSubtitles`. */
    tabSubtitles: {
        policies: 'The return, cancellation, and support terms customers see on your storefront',
        notifications: 'Which events reach you, and on which channel',
        preferences: 'Dashboard appearance and the rules that dispatch or cancel orders for you',
    },

    preferences: {
        appearance: {
            title: 'Appearance',
            info: "Applies to this dashboard only, on this browser. “System” follows your device's light/dark setting.",
            theme: 'Theme',
            light: 'Light',
            dark: 'Dark',
            system: 'System',
        },

        orderAutomation: {
            title: 'Order Automation',
            info: 'Two hands-off rules that keep your order list clean: one moves paid orders on to the delivery agency for you, the other cancels orders customers never paid for.',

            autoDispatch: 'Auto-dispatch paid orders',
            autoDispatchHintLabel: 'About auto-dispatch',
            autoDispatchHint: 'As soon as a physical order is paid, it moves straight to the delivery agency in charge instead of waiting in your queue. Off by default — leave it off if you want to check each order before it ships.',

            maxOrderTotal: 'Maximum order total',
            maxOrderTotalHintLabel: 'About the maximum order total',
            maxOrderTotalHint: 'A safety cap. Set it to 50 000 and orders up to 50 000 dispatch themselves, while a 75 000 order stays pending so you can look at it first. Leave it empty and every paid order dispatches, whatever the total.',
            maxOrderTotalPlaceholder: 'No cap',

            autoCancel: 'Auto-cancel unpaid orders',
            autoCancelHintLabel: 'About auto-cancel',
            autoCancelHint: 'Orders that are still unpaid after the number of days below are cancelled automatically and their reserved stock is released back to your inventory.',

            daysBeforeCancel: 'Days before cancel',
            daysBeforeCancelHintLabel: 'About days before cancel',
            daysBeforeCancelHint: "How long an unpaid order is held before it is cancelled and its stock released. Set it to 3 and an order placed Monday is cancelled Thursday if it's still unpaid. Between {{min}} and {{max}} days.",
        },

        saved: 'Preferences saved',
    },

    /** Account → Store: public identity, support contacts, vacation mode. */
    storefront: {
        title: 'Storefront',
        info: 'Your public store identity and support contacts.',
        loadFailed: 'Could not load your storefront.',

        bannerAlt: 'Store banner',
        changeBanner: 'Change banner',
        removeBanner: 'Remove banner',
        addBanner: 'Add banner',
        addBannerPrompt: 'Click to add a banner — it makes your storefront stand out',
        logoAlt: 'Store logo',
        changeLogo: 'Change logo',
        removeLogo: 'Remove logo',
        addLogo: 'Add logo',
        viewStore: 'View store',

        identity: {
            title: 'Store identity',
            info: 'The name and description customers see on your storefront page and in search results. Changing the name here does not change your store URL.',
            name: 'Store name',
            namePlaceholder: "Your store's display name",
            description: 'Description',
            descriptionPlaceholder: 'Tell customers what your store is about — what you sell, what makes you different',
            /** Character counter, e.g. "18/100". */
            counter: '{{current}}/{{max}}',
        },

        support: {
            title: 'Support & contact',
            info: 'How customers reach you with questions about their orders. These are published on your storefront — leave a field empty to hide that channel.',
            email: 'Support email',
            emailPlaceholder: 'support@yourstore.com',
            phone: 'Support phone',
            whatsapp: 'WhatsApp',
        },

        status: {
            title: 'Store status',
            info: "Close your storefront temporarily without deleting anything. While closed, customers see a vacation notice, your products stay listed but can't be ordered, and existing orders are unaffected.",
            open: 'Open',
            openTitle: 'Open for business',
            openBody: 'Visible and accepting orders.',
            closed: 'On vacation',
            closedBody: 'Customers see a vacation notice; new orders are paused.',
            toggleLabel: 'Store open for business',
            reopened: 'Store reopened',
            closedToast: 'Vacation mode enabled — store is now closed',
        },

        details: {
            title: 'Store details',
            info: 'Fixed properties of your storefront. None of these can be edited here — contact support if one is wrong.',
            publicUrl: 'Public URL',
            slug: 'Slug',
            slugHint: "The last part of your store URL. It's locked because existing links, QR codes, and shared posts would break — contact support if you need a new one.",
            country: 'Country',
            countryHint: "Set once during onboarding and taken from your vendor profile. It drives tax, shipping, and which addresses you're allowed to register.",
            lastUpdated: 'Last updated',
            hintLabel: 'About {{label}}',
        },

        validation: {
            nameTooShort: 'Store name must be at least 2 characters.',
            nameTooLong: 'Store name must be at most 100 characters.',
        },

        saved: 'Storefront updated',
        conflictReload: 'Storefront was updated elsewhere. Refreshed — please re-apply your changes.',
        conflictRetry: 'Storefront was updated elsewhere. Please try again.',
        copyUrlFailed: 'Could not copy the URL',
    },

    /** Account → Payout Setup, and onboarding step 1 (same form body). */
    payout: {
        country: 'Country',
        countryPlaceholder: 'Select your country',
        timezone: 'Timezone',
        timezonePlaceholder: 'Select your timezone',

        methodsTitle: 'Payout Methods',
        methodsHint:
            'The first method is used by default — add up to 3. Account names must match your records with the provider.',
        /** Badge on the row at the front of the list. */
        preferred: 'Preferred',
        paymentMethod: 'Payment Method',

        /**
         * Full names — the list rows, the remove confirmation and the "coming
         * soon" note, all of which have a whole line to themselves.
         */
        mobileMoney: 'Mobile Money',
        bankTransfer: 'Bank Transfer',
        card: 'Card',

        /**
         * The three method tiles. They sit in one row, so a phone gives each of
         * them about eighty pixels — anything longer than a word or two per line
         * breaks mid-word, and the descriptions have to earn their place.
         */
        methodMobileMoney: 'Mobile Money',
        methodBank: 'Bank',
        methodCard: 'Card',
        mobileMoneyHint: 'Mobile wallet',
        bankTransferHint: 'Bank account',
        cardHint: 'Bank card',
        /** Under the method tiles, naming whichever kinds cannot be picked yet. */
        methodSoonNote: '{{methods}} cannot receive payouts yet — we are working on it.',

        provider: 'Provider',
        phoneNumber: 'Phone Number',
        accountName: 'Account Name',
        mobileAccountNamePlaceholder: 'Name on the mobile money account',
        bankAccountNamePlaceholder: 'Name on the bank account',
        bankName: 'Bank Name',
        bankNamePlaceholder: 'e.g. Afriland First Bank',
        accountNumber: 'Account Number',
        accountNumberPlaceholder: 'IBAN or local account number',
        bankCountry: 'Bank Country',
        bankCountryPlaceholder: 'Country where the bank operates',

        /** Card destinations — brand + last 4 + holder + expiry, and nothing else. */
        cardBrand: 'Card Network',
        cardBrandPlaceholder: 'Select the card network',
        cardLast4: 'Last 4 Digits',
        cardLast4Placeholder: '4242',
        cardLast4Hint: 'We never ask for the full card number or the CVV.',
        cardHolderName: 'Cardholder Name',
        cardHolderPlaceholder: 'Name as it appears on the card',
        cardExpiryMonth: 'Expiry Month',
        cardExpiryYear: 'Expiry Year',
        /** Placeholders inside the two expiry dropdowns. */
        cardMM: 'MM',
        cardYYYY: 'YYYY',
        cardCountry: 'Issuing Country',
        cardCountryPlaceholder: 'Country that issued the card',
        issuingBank: 'Issuing Bank (optional)',
        issuingBankPlaceholder: 'e.g. Afriland First Bank',
        cardSettlementNote:
            'Card payouts are released by hand today, so they take longer to arrive. Keep a mobile money or bank method as your preferred one if you want the fastest payout.',

        /** The saved-methods list and its add/edit dialog. */
        addMethod: 'Add payout method',
        addTitle: 'Add payout method',
        /**
         * One line each. The account-name rule that used to trail these lives on
         * the surfaces that have room for it — the tab's own info, and the
         * methods hint in onboarding — rather than in a dialog subtitle that ran
         * to three lines on a phone before the form even started.
         */
        addDescription: 'Where your withdrawals are sent.',
        editTitle: 'Edit payout method',
        editDescription: 'Change where this payout lands.',
        saveMethod: 'Save method',
        empty: 'No payout method yet. Add one so we know where to send your earnings.',
        atLimit: 'You can save up to {{max}} payout methods.',
        setPreferred: 'Set preferred',
        /** Opens with the button's own visible text, which speech control types. */
        setPreferredAria: 'Set preferred: {{label}}',
        makePreferred: 'Set as preferred',
        makePreferredHint: 'Used first for every payout.',
        editAria: 'Edit {{label}}',
        removeAria: 'Remove {{label}}',
        removeTitle: 'Remove payout method?',
        removeDescription: '{{label}} will be removed. Nothing changes until you save.',
        keepOne: 'Keep at least one payout method.',
        /** A stored entry that would be rejected on save — usually a legacy record. */
        incomplete: 'Incomplete',
        incompleteHint: 'Some details are missing — open it to finish.',

        /** Account → Payout, the standalone settings tab. */
        paymentMethodsTitle: 'Payment Methods',
        paymentMethodsInfo1:
            'Where your withdrawals are sent. Add up to 3 methods — the first one is the preferred one and is used by default; the rest are fallbacks.',
        paymentMethodsInfo2:
            'Account names must match the name registered with the provider, otherwise the transfer is rejected and the payout is sent back to your available balance.',
        saved: 'Payout setup updated',
    },

    /** Account → Addresses, the standalone settings tab. */
    addresses: {
        title: 'Business Addresses',
        info1:
            "Your physical pickup locations. Customers won't see a pickup point on your products until you add at least one.",
        info2:
            'Every new or edited address has to be picked from the search box so we can pin it on the map, and it must sit inside your registered country.',
        info3:
            'Removing an address that a product still uses as its pickup point will block the save until you reassign that product.',
        saved: 'Business addresses updated',
    },

    /** Account → Store branding + business addresses (onboarding step 3 body). */
    /**
     * Timezone-picker city names. The abbreviation + UTC offset next to each
     * ("WAT, UTC+1") is technical and stays as-is; only the city is translated.
     */
    cities: {
        douala: 'Douala',
        lagos: 'Lagos',
        abidjan: 'Abidjan',
        dakar: 'Dakar',
        accra: 'Accra',
        nairobi: 'Nairobi',
        darEsSalaam: 'Dar es Salaam',
        kampala: 'Kampala',
        kigali: 'Kigali',
        cairo: 'Cairo',
        johannesburg: 'Johannesburg',
        paris: 'Paris',
        london: 'London',
        newYork: 'New York',
    },

    branding: {
        title: 'Branding',
        removeImage: 'Remove {{label}}',
        logo: 'Logo',
        logoHint: 'Square image, min 200×200px recommended',
        coverImage: 'Cover Image',

        addressesTitle: 'Business Addresses',
        addAddress: 'Add address',
        removeAddress: 'Remove address',
        noAddresses: "No addresses added. Customers won't see a pickup location until you add one.",

        /** Card heading — the row's place in the list, under the vendor's own label. */
        primaryAddress: 'Primary address',
        otherAddress: 'Address {{number}}',

        findAddressHintLabel: 'About finding an address',
        findAddressHint: 'Type a street, area, or city and pick a result — that pins the exact coordinates we hand to delivery agencies. The fields below are filled in for you and stay editable, but editing them without re-picking a result will block the save.',
        searchPlaceholder: 'Search a street, area, or city…',
        notPinned: 'Not pinned yet.',

        label: 'Label',
        labelHintLabel: 'About the address label',
        labelHint: "Your own name for this location, e.g. “Main Shop” or “Warehouse”. It's how you pick a pickup point when publishing a product.",
        labelPlaceholder: 'e.g. Main Shop, Warehouse',
        street: 'Address / landmark',
        streetPlaceholder: '123 Market Street',
        line2: 'Address Line 2',
        line2Placeholder: 'Suite 4B, Floor 2…',
        city: 'City',
        cityPlaceholder: 'Douala',
        state: 'State / Region',
        statePlaceholder: 'Littoral',
        /** Trails the city/region line so it reads as filled in, not typed. */
        fromMapResult: '· from the map result',
        notNamedByMap: "the map result didn't name one",

        geoRequired: 'Search and select this address so we can pin it on the map.',
        geoCountryMismatch: 'This address must be in your registered country ({{country}}). Search for it again within {{country}}.',
        geoBlocked: 'Some addresses need a valid pinned location before saving.',

        removeConfirmTitle: 'Remove this address?',
        removeConfirmBody: "If it's still set as a pickup location on a product, saving will be blocked until you reassign that product.",

        clearPinTitle: 'Remove the pinned location?',
        clearPinBody: 'This is the coordinate delivery agencies route to. You will have to search for the address and pick it again before this can be saved.',
        clearPinAction: 'Remove pin',
    },

    policies: {
        /** The standalone Settings → Policies tab header. */
        tabTitle: 'Policies',
        tabInfo1:
            "The rules customers see on your storefront and that support falls back on when there's a dispute. Every field below has its own info icon explaining what it changes.",
        tabInfo2:
            'Switching a whole policy off deletes it — your store then shows no policy for that area, which customers read as “not offered”.',
        /** Opens the popover that explains what a policy field actually changes. */
        fieldHintLabel: 'What this field changes',
        enableSection: 'Enable {{title}}',

        return: {
            title: 'Return Policy',
            subtitle: 'How you handle product returns and refunds',

            accept: 'Accept returns',
            acceptHintLabel: 'About accepting returns',
            acceptHint: 'On, customers get a “Request return” button on delivered orders and the rules below apply. Off, your storefront shows “No returns accepted” and all the fields below disappear.',

            windowDays: 'Return window (days)',
            windowDaysHint: 'How long after purchase a customer may start a return. Set it to 14 and an order placed on 1 March can be returned until 15 March — on the 16th the return button is gone. 0 means returns close immediately. Max 180.',

            refundType: 'Refund type',
            refundTypeHint: 'What the customer gets back on an accepted return. Full → the whole item price. Partial → only the percentage you set below (80% of a 10 000 order = 8 000 back). No refund → the return is accepted but no money is returned, e.g. exchange-only stores.',
            refundTypeFull: 'Full refund',
            refundTypePartial: 'Partial refund',
            refundTypeNone: 'No refund',

            refundPercentage: 'Refund percentage (%)',
            refundPercentageHint: 'The share of the order refunded, 0–100. At 80, a 10 000 order refunds 8 000 and you keep 2 000 as a restocking charge. Required while the refund type is Partial.',
            refundPercentagePlaceholder: 'e.g. 80',

            shippingPayer: 'Return shipping paid by',
            shippingPayerHint: 'Who pays to send the item back. Customer → they cover it, whatever the reason. Vendor (you) → you cover every return, which reads well on the storefront but costs you on change-of-mind returns. Customer, reimbursed if defective → they pay upfront and you refund the shipping only when the item really was faulty.',
            shippingPayerCustomer: 'Customer',
            shippingPayerVendor: 'Vendor (you)',
            shippingPayerReimbursed: 'Customer (reimbursed if defective)',

            processingDays: 'Refund processing time (days)',
            processingDaysHint: 'Business days between the returned item reaching you and the money going out. Set 5 and a parcel you receive on a Monday is refunded by the following Monday — that date is what the customer is shown, so pad it a little. Max 30.',

            conditionNotes: 'Return condition notes',
            conditionNotesHint: 'Free text printed next to your return policy, e.g. “Unused, in the original packaging, with the tag still attached.” Support quotes this when a return is contested, so be specific. Leave it empty if you have no extra conditions.',
            conditionNotesPlaceholder: 'e.g. Item must be unused and in original packaging.',
        },

        cancellation: {
            title: 'Cancellation Policy',
            subtitle: 'When and how customers can cancel orders',

            allow: 'Allow cancellations',
            allowHintLabel: 'About allowing cancellations',
            allowHint: 'On, customers can cancel a placed order themselves under the rules below. Off, the cancel button is hidden and they have to contact you — every cancellation then goes through support.',

            deadline: 'Cancellation deadline',
            deadlineHint: 'The cut-off for a free cancellation. “Within 24 hours” lets someone who ordered Monday 9am cancel until Tuesday 9am; after that the late-cancellation rules further down take over. “Before vendor confirms” closes the window the moment you accept the order, so it shrinks as you get faster.',
            deadlinePlaceholder: 'Select a deadline…',
            deadline1Hour: 'Within 1 hour of order',
            deadline24Hours: 'Within 24 hours of order',
            deadlineBeforeConfirmation: 'Before vendor confirms the order',
            deadlineBeforeServiceStart: 'Before service start date/time',
            deadlineDaysBeforeDelivery: 'Anytime until X days before delivery',

            deadlineDays: 'Days before delivery',
            deadlineDaysHint: 'How many days ahead of the delivery date cancelling is still free. At 3, an order due Friday can be cancelled up to Tuesday; Wednesday onwards counts as late.',
            deadlineDaysPlaceholder: 'e.g. 3',

            fee: 'Cancellation fee',
            feeHint: 'What you keep when a customer cancels in time. No fee → they get everything back. Fixed → a flat amount, e.g. 500 off a 10 000 order refunds 9 500. Percentage → a share, e.g. 10% refunds 9 000. Full amount → nothing is refunded, which only makes sense for made-to-order work.',
            feeNone: 'No fee',
            feeFixed: 'Fixed amount',
            feePercentage: 'Percentage of order',
            feeFull: 'Full amount (non-refundable)',

            feeAmount: 'Fee amount',
            feeAmountHint: 'The flat amount you keep on a cancellation. At 500, a 10 000 order refunds 9 500 and a 2 000 order refunds 1 500 — the same charge either way, so keep it small.',
            feeAmountPlaceholder: 'e.g. 500',
            feePercentageValue: 'Fee percentage (%)',
            feePercentageHint: 'The share of the order you keep, 0–100. At 10, a 10 000 order refunds 9 000 and a 2 000 order refunds 1 800 — the charge scales with the order.',
            feePercentagePlaceholder: 'e.g. 10',

            lateRefund: 'Late cancellation refund',
            lateRefundHint: 'What a customer gets back when they cancel after the deadline above. Leave it as None and late cancellations follow the same fee as on-time ones. No refund → they get nothing. Percentage refunded → e.g. 50 returns 5 000 on a 10 000 order.',
            lateRefundNone: 'No refund',
            lateRefundFixed: 'Fixed amount refunded',
            lateRefundPercentage: 'Percentage refunded',

            lateRefundAmount: 'Refund amount',
            lateRefundAmountHint: 'The flat amount handed back on a late cancellation. At 2 000, a 10 000 order returns 2 000 and you keep 8 000.',
            lateRefundPercentageValue: 'Refund percentage (%)',
            lateRefundPercentageHint: 'The share handed back on a late cancellation, 0–100. At 50, a 10 000 order returns 5 000.',
        },

        support: {
            title: 'Support Policy',
            subtitle: 'How customers can reach you for help',

            channels: 'Support channels',
            channelsHint: 'Where customers reach you for help. These are published on your storefront and attached to order emails, so only add addresses you actually watch. Each type can be added once, up to 4 in total.',
            addChannel: 'Add channel',
            noChannels: 'No channels added yet. Add at least one so customers can reach you.',
            removeChannel: 'Remove {{type}} channel',
            channelEmail: 'Email',
            channelPhone: 'Phone',
            channelWhatsapp: 'WhatsApp',
            channelTelegram: 'Telegram',

            requiredInfo: 'Required from customer',
            requiredInfoHint: 'What a customer has to attach before a support request can be sent. Ticking “Product photo / video” blocks the form until they upload one — useful for damage claims, but it also slows down someone asking a simple question.',
            requiredOrderNumber: 'Order number',
            requiredProductPhoto: 'Product photo / video',
            requiredTrackingNumber: 'Tracking number',

            availability: 'Availability',
            availabilityHint: 'When you answer. Shown as a badge next to your support channels, so it sets the reply time customers expect. Pick “Limited” to spell out your exact hours in the field that appears.',
            availabilityPlaceholder: 'Select availability…',
            availability247: '24/7',
            availabilityBusinessHours: 'Business hours',
            availabilityLimited: 'Limited (specify below)',

            availabilityDescription: 'Availability description',
            availabilityDescriptionHint: 'Your exact hours, shown to customers word for word — e.g. “Mon–Fri, 10:00–18:00 (WAT), closed on public holidays.”',
            availabilityDescriptionPlaceholder: 'e.g. Mon–Fri, 10:00–18:00',

            languages: 'Languages',
            languagesHint: "The languages you can actually handle a support conversation in. Type one and press Enter or +, e.g. English, then Français. Up to 20. This is what customers filter on, so don't list a language you can't reply in.",
            languagesPlaceholder: 'e.g. English',
            removeLanguage: 'Remove {{language}}',

            eligibilityNotes: 'Eligibility notes',
            eligibilityNotesHint: 'Who qualifies for support, e.g. “Only orders placed in the last 90 days” or “Bulk orders are handled by your account manager.” Printed under your support policy.',
            eligibilityNotesPlaceholder: 'e.g. Only customers with a valid order.',
        },

        documents: {
            title: 'Policy Documents',
            subtitle: 'Optional supporting PDFs (max 2, 5MB each)',
            upload: 'Upload document',
            remove: 'Remove document',
            uploadFailed: 'Could not upload document. Please try again.',
        },
    },
} as const;

export default settings;
