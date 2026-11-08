import { plural } from '../../types';

/**
 * Service listings, leads and listing settings — the provider's three sections
 * (api-doc/vendor/FRONTEND-CHANGELOG-service-listings.md).
 *
 * On screen the feature is "Service listing". ⛔ No credit price is ever written
 * here: every cost arrives as a `{{placeholder}}` read from the server's price
 * list (`GET /public/credit-packs` → `actionCosts`).
 */
export default {
    // ── Charging rule ────────────────────────────────────────────────────────
    charging: {
        /** first / next = credits. */
        rule: 'The first contact a customer unlocks costs {{first}} credits, each further one {{next}}. The same contact again is free for 30 days.',
        /** When the price list could not be read — the rule without figures. */
        ruleNoPrices:
            'You pay in credits when a customer unlocks one of your contacts. The same contact again is free for 30 days.',
        balance: 'Balance',
        credits: plural({ one: '{{count}} credit', other: '{{count}} credits' }),
        topUp: 'Top up',
        negative: 'Your balance is below zero. Top up to bring it back.',
    },

    // ── Status, in words ─────────────────────────────────────────────────────
    status: {
        draft: 'Draft',
        pending_review: 'Waiting for review',
        rejected: 'Not approved',
        live: 'Live',
        suspended: 'Paused',
        archived: 'Archived',
    },
    statusLine: {
        draft: 'Not sent for review yet.',
        pending_review: 'Wi-Mall is checking it. Withdraw it if you want to make changes.',
        rejected: 'Fix what the reviewer asked and send it again.',
        live: 'Customers can find it and unlock your contacts.',
        archived: 'Closed. Customers can no longer find it.',
        changesWaiting: 'Changes waiting for review',
        changesWaitingLong: 'Your changes are waiting for review. The approved version stays live meanwhile.',
        changesEditing: 'You have changes that are not sent for review yet.',
        changesRejected: 'Your changes were not approved. The approved version is still live.',
        reasonsTitle: 'What the reviewer said',
    },
    suspension: {
        insufficient_credits: 'Paused — out of credits',
        insufficient_creditsLong:
            'New customers can’t reach you because your credits ran out. Top up and it comes back on its own.',
        platform_oversight: 'Taken offline by Wi-Mall',
        platform_oversightLong: 'Wi-Mall took this listing offline. Only Wi-Mall can put it back.',
        platform_oversightNote: 'Wi-Mall’s note: {{note}}',
        plan_quota_exceeded: 'Paused — over your plan’s limit',
        plan_quotaLong:
            'You have more live listings than your plan allows. Upgrade to bring it back.',
        topUp: 'Top up credits',
        seePlans: 'See plans',
        contactSupport: 'Contact support',
    },

    // ── Listings page ────────────────────────────────────────────────────────
    list: {
        title: 'Service listings',
        description: 'What customers find, and how they reach you',
        create: 'New listing',
        untitled: 'Untitled listing',
        emptyTitle: 'No listings yet',
        emptyBody: 'A listing shows customers what you do and where. Your contacts stay hidden until they tap.',
        emptyAction: 'Create your first listing',
        emptyFiltered: 'No listings with this status.',
        searchPlaceholder: 'Search your listings',
        noMatch: 'No listing matches “{{query}}”.',
        loadFailed: 'Your listings could not be loaded.',
        filterStatus: 'Status',
        allStatuses: 'All',
        updated: 'Updated {{date}}',
    },

    // ── Editor ───────────────────────────────────────────────────────────────
    editor: {
        newTitle: 'New listing',
        editTitle: 'Edit listing',
        back: 'Back to listings',
        loadFailed: 'This listing could not be opened.',
        notFound: 'This listing doesn’t exist, or it isn’t yours.',

        publicTitle: 'What customers see',
        photos: 'Photos',
        title: 'Title',
        titlePlaceholder: 'e.g. Plumbing repairs, day and night',
        companyName: 'Business name',
        description: 'Description',
        descriptionHint: 'At least {{min}} characters. Keep phone numbers, emails and links for Contact info below.',
        categories: 'Categories',
        whereTitle: 'Where you work',
        country: 'Country',
        countryPlaceholder: 'Choose a country',
        city: 'City',
        area: 'Neighbourhood',
        areaPlaceholder: 'e.g. Bonapriso',
        areaHint: 'Shown to customers. Your exact address stays hidden.',
        hours: 'Opening hours',
        hoursAdd: 'Add opening hours',
        hoursRemove: 'Remove opening hours',
        hoursClosed: 'Closed',
        hoursOpen: 'Open',
        hoursFrom: 'Opens',
        hoursTo: 'Closes',

        contactsTitle: 'Contact info',
        contactsNote: 'Customers see a contact only after they tap to unlock it.',
        contactsNeedOne: 'Add at least one contact.',
        whatsapp: 'WhatsApp number',
        phone: 'Phone number',
        phone2: 'Second phone number',
        phone2Hint: 'Customers see both numbers when they unlock your phone, for one charge.',
        liveNow: 'Customers see now: {{value}}',
        liveNowNone: 'Customers see now: nothing',
        email: 'Email',
        website: 'Website',
        websitePlaceholder: 'https://',
        socials: 'Social pages',
        socialsAdd: 'Add a social page',
        socialsRemove: 'Remove',
        socialNetwork: 'Network',
        socialUrl: 'Link',
        socialOther: 'Other',
        location: 'Exact location',
        locationHint: 'Search your address. The address and its pin are unlocked together.',
        video: 'Video link',
        videoPlaceholder: 'Paste a YouTube or Google Drive link',
        videoHint: 'A video showing your location.',
        videoHowTitle: 'How to get a video link',
        videoHowYoutube:
            'YouTube: upload your video, set its visibility to “Unlisted”, then copy the link from “Share”.',
        videoHowDrive:
            'Google Drive: upload your video, tap “Share”, set General access to “Anyone with the link”, then copy the link.',

        optional: '(optional)',
        saveDraft: 'Save draft',
        saveChanges: 'Save changes',
        saving: 'Saving…',
        submit: 'Submit for review',
        /** cost = credits. */
        submitWithCost: plural({
            one: 'Submit for review · {{count}} credit',
            other: 'Submit for review · {{count}} credits',
        }),
        submitting: 'Sending…',
        submitCostNote: plural({
            one: 'Sending it for review costs {{count}} credit. You get it back if it isn’t approved or you withdraw it.',
            other: 'Sending it for review costs {{count}} credits. You get them back if it isn’t approved or you withdraw it.',
        }),
        lockedWhileReview: 'You can’t edit while it is waiting for review. Withdraw it first.',
        cancel: 'Cancel',

        saved: 'Saved',
        created: 'Draft saved',
        submitted: 'Sent for review. We’ll let you know when it’s checked.',
        nothingToSave: 'No changes to save.',
        missingTitle: 'Some things are missing',
        missing: {
            title: 'a title',
            companyName: 'your business name',
            categories: 'a category',
            country: 'the country',
            city: 'the city',
            area: 'the neighbourhood',
            description: 'a description of at least 20 characters',
            contact: 'at least one hidden contact',
        },
        /** list = "a title, the city and a category". */
        missingBody: 'Add {{list}} before sending it for review.',
        fixHighlighted: 'Check the highlighted fields.',
    },

    // ── Actions on a listing ─────────────────────────────────────────────────
    actions: {
        withdraw: 'Withdraw from review',
        withdrawn: 'Withdrawn. Your credits were returned.',
        discard: 'Discard changes',
        discardTitle: 'Discard your changes?',
        discardBody: 'The approved version stays live. Anything you changed since is lost.',
        discardConfirm: 'Discard',
        discarded: 'Changes discarded',
        archive: 'Archive',
        archiveTitle: 'Archive this listing?',
        archiveBody: 'Customers will no longer find it. This can’t be undone.',
        archiveConfirm: 'Archive',
        archived: 'Listing archived',
    },

    // ── Leads ────────────────────────────────────────────────────────────────
    leads: {
        title: 'Leads',
        description: 'Customers who unlocked your contacts',
        emptyTitle: 'No leads yet',
        emptyBody: 'When a customer unlocks one of your contacts, they appear here.',
        loadFailed: 'Your leads could not be loaded.',
        filterListing: 'Listing',
        allListings: 'All listings',
        aCustomer: 'A customer',
        /** start / end = dates. */
        window: '{{start}} – {{end}}',
        unlocked: 'Unlocked',
        refunded: 'Refunded',
        cost: plural({ one: '{{count}} credit', other: '{{count}} credits' }),
        messagesLeft: plural({
            one: '{{count}} message left',
            other: '{{count}} messages left',
        }),
        noMessagesLeft: 'No messages left for now',
        needsOptIn: 'Needs the customer’s opt-in',
        callMe: 'Ask them to call me',
        callMeHint: 'Sends your first phone number.',
        callMeAlreadySent: 'Already asked',
        message: 'Send a message',
        report: 'Report',
        reportOpen: 'Report open',
        field: {
            whatsapp: 'WhatsApp',
            phone: 'Phone',
            email: 'Email',
            website: 'Website',
            socials: 'Social pages',
            location: 'Location',
            video: 'Video',
        },

        callMeTitle: 'Ask them to call you?',
        /** name = the customer's masked name. */
        callMeBody: 'We’ll send {{name}} your business name and your first phone number, and ask them to call you.',
        callMeCost: plural({
            one: 'This costs {{count}} credit. You get it back if it can’t be delivered.',
            other: 'This costs {{count}} credits. You get them back if it can’t be delivered.',
        }),
        callMeSend: 'Send',
        callMeSent: 'Sent. They’ll call you on your own number.',
        callMeFailed: 'It couldn’t be delivered. Your credits were returned.',

        messageTitle: 'Send a message',
        messageLabel: 'Your message',
        messagePlaceholder: 'Hello, thanks for your interest…',
        messageNote: 'Wi-Mall passes it on. The customer answers you directly on your WhatsApp.',
        messageSend: 'Send',
        messageSent: 'Message sent',
        messageFailed: 'It couldn’t be delivered. Try again later.',

        windowTitle: 'Messages are closed for now',
        windowBody:
            'WhatsApp only allows businesses to write freely within 24 hours of the customer’s last message to Wi-Mall. It reopens when the customer writes.',
        windowWho: 'This is WhatsApp’s rule, not Wi-Mall’s. You can still ask them to call you.',
        windowOk: 'OK',

        reportTitle: 'Report this lead',
        reportWants: 'What do you need?',
        reportRefund: 'Refund these unlocks',
        reportRefundHint: 'For example, the customer never meant to contact you.',
        reportCheck: 'Check this customer',
        reportCheckHint: 'For example, they behaved badly or seem fake.',
        reportPick: 'Which unlocks?',
        reportReason: 'What happened?',
        reportReasonHint: '{{min}} to {{max}} characters.',
        reportSend: 'Send report',
        /** number = the ticket's short reference. */
        reportSent: 'Report sent — ticket {{number}}. Wi-Mall will look into it.',
        reportNeedWant: 'Choose at least one.',
        reportNeedReveal: 'Choose at least one unlock to refund.',
        reportReasonShort: 'Write at least {{min}} characters.',
        reportNothingToRefund: 'Every unlock on this lead is already refunded.',
        chars: '{{count}} / {{max}}',
    },

    // ── Listing settings ─────────────────────────────────────────────────────
    settings: {
        onEmptyTitle: 'When your credits run out',
        onEmpty: {
            continue_engaged: 'Keep serving customers already talking to you',
            continue_engagedHint: 'Until their 30 days end. Your balance can go below zero.',
            stop: 'Stop for everyone',
            stopHint: 'No one can unlock a contact until you top up.',
        },
        debtFloorTitle: 'How far below zero',
        debtFloorLabel: 'Go below zero by at most',
        debtFloorHint: 'Leave empty for no limit.',
        dailyCapTitle: 'Most one customer can cost you per day',
        dailyCapLabel: 'Per customer, per day',
        dailyCapHint: 'Leave empty for no limit.',
        /** min = the first-unlock cost. */
        dailyCapMin: 'At least {{min}} credits — the price of a first unlock.',
        dailyCapMinNoPrice: 'Too low — it must cover at least one first unlock.',
        noLimit: 'No limit',
        unit: 'credits',
        wholeNumber: 'Use a whole number.',
        saved: 'Listing settings saved',
        loadFailed: 'Your listing settings could not be loaded.',
    },
};
