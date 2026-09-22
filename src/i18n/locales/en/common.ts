import { plural } from '../../types';

/**
 * Vocabulary shared across the whole dashboard.
 *
 * A string belongs here when at least two unrelated features need it verbatim
 * ("Save", "Cancel", "No results"). Anything feature-specific — even a word as
 * short as "Publish" — lives in that feature's namespace, because the same
 * English word often needs different translations in different contexts.
 */
export const common = {
    /**
     * The pre-sign-in language picker (`LanguageSwitcher`). The language *names*
     * are never translated — they come from the locale registry in their own
     * language, because "Français" is what a French speaker scans a list for and
     * "French" is not.
     */
    language: {
        change: 'Change language',
    },

    actions: {
        save: 'Save',
        saving: 'Saving…',
        saveChanges: 'Save changes',
        cancel: 'Cancel',
        discard: 'Discard',
        close: 'Close',
        confirm: 'Confirm',
        continue: 'Continue',
        back: 'Back',
        next: 'Next',
        skip: 'Skip',
        done: 'Done',
        edit: 'Edit',
        delete: 'Delete',
        deleting: 'Deleting…',
        remove: 'Remove',
        add: 'Add',
        create: 'Create',
        creating: 'Creating…',
        update: 'Update',
        updating: 'Updating…',
        duplicate: 'Duplicate',
        archive: 'Archive',
        restore: 'Restore',
        view: 'View',
        viewAll: 'View all',
        viewDetails: 'View details',
        search: 'Search',
        filter: 'Filter',
        filters: 'Filters',
        clear: 'Clear',
        clearAll: 'Clear all',
        reset: 'Reset',
        apply: 'Apply',
        refresh: 'Refresh',
        retry: 'Try again',
        upload: 'Upload',
        uploading: 'Uploading…',
        download: 'Download',
        copy: 'Copy',
        copied: 'Copied',
        copyLink: 'Copy link',
        share: 'Share',
        print: 'Print',
        export: 'Export',
        import: 'Import',
        select: 'Select',
        selectAll: 'Select all',
        deselectAll: 'Deselect all',
        submit: 'Submit',
        send: 'Send',
        sending: 'Sending…',
        loadMore: 'Load more',
        showMore: 'Show more',
        showLess: 'Show less',
        seeAll: 'See all',
        signOut: 'Sign out',
        goBack: 'Go back',
        learnMore: 'Learn more',
        gotIt: 'Got it',
        openMenu: 'Open menu',
        moreOptions: 'More options',
        change: 'Change',
    },

    /**
     * Getting a file out of the app (CAPACITOR-PLAN.md → P4.6). Only the failure
     * is spoken: on the web the browser's own download UI is the confirmation,
     * and on a device the share sheet is — announcing success on top of either
     * would be the app talking over the platform.
     */
    files: {
        downloadFailed: 'Could not download that file. Check your connection and try again.',
    },

    labels: {
        name: 'Name',
        email: 'Email',
        phone: 'Phone',
        status: 'Status',
        type: 'Type',
        date: 'Date',
        time: 'Time',
        amount: 'Amount',
        total: 'Total',
        subtotal: 'Subtotal',
        quantity: 'Quantity',
        price: 'Price',
        description: 'Description',
        notes: 'Notes',
        details: 'Details',
        actions: 'Actions',
        createdAt: 'Created',
        updatedAt: 'Last updated',
        address: 'Address',
        city: 'City',
        country: 'Country',
        region: 'Region',
        currency: 'Currency',
        language: 'Language',
        timezone: 'Timezone',
        optional: 'Optional',
        required: 'Required',
        none: 'None',
        all: 'All',
        other: 'Other',
        unknown: 'Unknown',
        notSet: 'Not set',
        yes: 'Yes',
        no: 'No',
        enabled: 'Enabled',
        disabled: 'Disabled',
        on: 'On',
        off: 'Off',
        from: 'From',
        to: 'To',
        of: 'of',
        image: 'Image',
        file: 'File',
        link: 'Link',
        reason: 'Reason',
        customer: 'Customer',
        product: 'Product',
        order: 'Order',
        /** Standalone em dash used wherever a value is absent in a table cell. */
        emptyValue: '—',
    },

    states: {
        loading: 'Loading…',
        loadingDetails: 'Loading details…',
        saving: 'Saving…',
        noResults: 'No results',
        noResultsDescription: 'Try adjusting your search or filters.',
        noData: 'Nothing here yet',
        empty: 'Nothing to show',
        errorTitle: 'Something went wrong',
        errorDescription: "We couldn't load this. Please try again.",
        offline: "You're offline",
        comingSoon: 'Coming soon',
        searching: 'Searching…',
        processing: 'Processing…',
    },

    pagination: {
        previous: 'Previous',
        next: 'Next',
        page: 'Page',
        pageOf: 'Page {{page}} of {{total}}',
        showing: 'Showing {{from}}–{{to}} of {{total}}',
        /** `items` arrives already pluralized ("247 orders"), so the noun agrees. */
        showingRange: 'Showing {{from}}–{{to}} of {{items}}',
        showingOf: 'Showing {{shown}} of {{items}}',
        showingCount: 'Showing {{items}}',
        rowsPerPage: 'Rows per page',
        results: plural({ one: '{{count}} result', other: '{{count}} results' }),
        selected: plural({ one: '{{count}} selected', other: '{{count}} selected' }),
    },

    /** Defaults baked into the shared `SearchFilterBar` / `FilterSheet` primitives. */
    filters: {
        openFilters: 'Open filters',
        showResults: 'Show results',
    },

    search: {
        placeholder: 'Search…',
        clearSearch: 'Clear search',
        resultsFor: 'Results for “{{query}}”',
        noMatches: 'No matches for “{{query}}”',
    },

    confirm: {
        title: 'Are you sure?',
        deleteTitle: 'Delete this?',
        deleteDescription: 'This cannot be undone.',
        discardTitle: 'Discard your changes?',
        discardDescription: 'Any unsaved changes will be lost.',
        leaveTitle: 'Leave without saving?',
        leaveDescription: 'You have unsaved changes on this page.',
    },

    unsaved: {
        title: 'You have unsaved changes',
        description: 'Save them before leaving this page.',
    },

    time: {
        today: 'Today',
        yesterday: 'Yesterday',
        tomorrow: 'Tomorrow',
        thisWeek: 'This week',
        lastWeek: 'Last week',
        thisMonth: 'This month',
        lastMonth: 'Last month',
        thisYear: 'This year',
        allTime: 'All time',
        last7Days: 'Last 7 days',
        last30Days: 'Last 30 days',
        last90Days: 'Last 90 days',
        custom: 'Custom range',
        justNow: 'Just now',
        pickDate: 'Pick a date',
        pickDateRange: 'Pick a date range',
        startDate: 'Start date',
        endDate: 'End date',
        days: plural({ one: '{{count}} day', other: '{{count}} days' }),
        hours: plural({ one: '{{count}} hour', other: '{{count}} hours' }),
        minutes: plural({ one: '{{count}} minute', other: '{{count}} minutes' }),
    },

    units: {
        items: plural({ one: '{{count}} item', other: '{{count}} items' }),
        products: plural({ one: '{{count}} product', other: '{{count}} products' }),
        orders: plural({ one: '{{count}} order', other: '{{count}} orders' }),
        files: plural({ one: '{{count}} file', other: '{{count}} files' }),
        images: plural({ one: '{{count}} image', other: '{{count}} images' }),
        variants: plural({ one: '{{count}} variant', other: '{{count}} variants' }),
        customers: plural({ one: '{{count}} customer', other: '{{count}} customers' }),
        tickets: plural({ one: '{{count}} ticket', other: '{{count}} tickets' }),
        unlimited: 'Unlimited',
    },

    validation: {
        required: 'This field is required.',
        invalid: 'That value is not valid.',
        email: 'Enter a valid email address.',
        url: 'Enter a valid URL.',
        phone: 'Enter a valid phone number for the selected country.',
        phoneRequired: 'Enter a phone number.',
        number: 'Enter a number.',
        integer: 'Enter a whole number.',
        positive: 'Enter a number greater than zero.',
        nonNegative: 'This cannot be negative.',
        minLength: 'Use at least {{min}} characters.',
        maxLength: 'Use at most {{max}} characters.',
        min: 'Must be at least {{min}}.',
        max: 'Must be at most {{max}}.',
        between: 'Must be between {{min}} and {{max}}.',
        tooLong: 'That is too long.',
        tooShort: 'That is too short.',
        selectOne: 'Select an option.',
        selectAtLeastOne: 'Select at least one.',
        fixHighlighted: 'Please fix the highlighted fields before saving.',
        dateAfter: 'The end date has to come after the start date.',
    },

    /** The shared phone number field — country selector plus national number. */
    phone: {
        /** Accessible name for the country button; the flag is decorative. */
        countryLabel: 'Country code: {{country}} ({{dial}})',
        searchPlaceholder: 'Search country or code',
        noCountry: 'No country found.',
        /** The markets the platform operates in, pinned above the full list. */
        commonCountries: 'Common',
        allCountries: 'All countries',
    },

    toast: {
        saved: 'Changes saved',
        created: 'Created',
        updated: 'Updated',
        deleted: 'Deleted',
        copied: 'Copied to clipboard',
        linkCopied: 'Link copied',
        copyFailed: "Couldn't copy to clipboard",
    },

    /**
     * The vendor-facing chrome around a storefront preview. Everything inside
     * the frame is served by the storefront in the customer's own language —
     * only this bar is ours to translate.
     */
    preview: {
        frameTitle: 'Storefront preview',
        loading: 'Loading the storefront…',
        refresh: 'Refresh preview',
        openLive: 'Open live',
        copyFailed: 'Could not copy the link',
        statusActions: 'Status',
        device: {
            label: 'Preview width',
            mobile: 'Mobile',
            tablet: 'Tablet',
            desktop: 'Desktop',
        },
    },

    /** Address autocomplete, used by onboarding, settings and the product forms. */
    address: {
        useMyLocation: 'Use my current location',
        myLocation: 'My location',
        noMatches: 'No matches — refine your search or type the address manually.',
        geolocationUnavailable: 'Location is not available in this browser.',
        filledFromLocation: 'Address filled from your location',
        resolveFailed: 'Could not resolve your location to an address.',
        openSettings: 'Open settings',
        /** Under the box while the phone looks for a position — a first fix outdoors takes a few seconds. */
        locating: 'Finding your position… this can take a few seconds.',
        /**
         * Permission was fine and still no position — after a 20-second watch
         * and a fall-back to the phone's last known one.
         */
        locationFixFailed: 'Could not get your location. Move somewhere with a clearer signal and try again.',
        /**
         * `LocationAccessDialog` — replaces the old one-line "permission denied"
         * toast. Every version ends in a button that asks again or goes to the
         * switch, because most vendors do not know how to re-allow it by hand.
         */
        access: {
            /** Refused this time; "Allow" brings the phone's question back. */
            deniedTitle: 'Allow location access',
            deniedBody: 'The app uses your location only to fill in this address. Tap Allow, then choose “While using the app” when your phone asks.',
            allow: 'Allow',
            /** Phone app: the phone will not ask again, only its settings can change it. */
            blockedTitle: 'Location is blocked for this app',
            blockedBody: 'Your phone won’t ask again on its own. Open settings, go to Permissions → Location and choose “Allow only while using the app”. When you come back, the address fills in by itself.',
            /** Website: no settings screen can be opened, so say where the browser keeps the switch. */
            blockedBrowserTitle: 'Location is blocked for this site',
            blockedBrowserBody: 'Your browser won’t ask again on its own. Tap the icon to the left of the web address, allow Location, then tap Try again.',
            /** The phone's location switch is off; "Try again" brings back the "turn on location" question. */
            offTitle: 'Your phone’s location is off',
            offBody: 'Turn it on to fill in this address from where you are. Tap Try again and choose Turn on — or swipe down from the top of the screen and tap Location.',
            notNow: 'Not now',
        },
        searchUnavailable: 'Address search is unavailable right now.',
        /** Under the picked place, so the vendor can sanity-check the coordinates. */
        pinnedAt: 'Pinned at {{lat}}, {{lng}}',
        clearPinned: 'Remove the pinned location',
    },

    a11y: {
        goBack: 'Go back',
        openSidebar: 'Open sidebar',
        closeSidebar: 'Close sidebar',
        toggleSidebar: 'Toggle sidebar',
        openNotifications: 'Open notifications',
        userMenu: 'Account menu',
        breadcrumb: 'Breadcrumb',
        moreActions: 'More actions',
        moreInformation: 'More information',
        aboutThisField: 'About this field',
        sortAscending: 'Sort ascending',
        sortDescending: 'Sort descending',
        previousImage: 'Previous image',
        nextImage: 'Next image',
        remove: 'Remove',
        loading: 'Loading',
    },
} as const;

export default common;
