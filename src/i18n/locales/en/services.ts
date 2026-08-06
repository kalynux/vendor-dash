import { plural } from '../../types';

/** Bookable services: catalog, availability, appointments, calendar. */
export const services = {
    title: 'Bookings',
    subtitle: 'Your bookable services, appointments and calendar',

    tabs: {
        services: 'Services',
        appointments: 'Appointments',
        calendar: 'Calendar',
    },

    /** One line per Bookings sub-route — see `account.tabSubtitles`. */
    tabSubtitles: {
        services: 'Your bookable services and the availability customers book against',
        appointments: 'Every booking your customers have made, and where each one stands',
        calendar: 'Connect a calendar so bookings and availability stay in sync',
    },

    /** Catalog status of a service product (mirrors the product statuses). */
    status: {
        draft: 'Draft',
        active: 'Active',
        archived: 'Archived',
        pending_review: 'In review',
        suspended: 'Suspended',
    },

    bookingMode: {
        calendar: 'Calendar',
        manual: 'Manual',
        capacity: 'Capacity',
    },

    bookingModeHelp: {
        calendar: 'Customers pick a specific time slot from your availability.',
        manual: 'You arrange the time with the customer after they request it.',
        capacity: 'Multiple customers can book the same time slot.',
    },

    days: {
        sunday: 'Sunday',
        monday: 'Monday',
        tuesday: 'Tuesday',
        wednesday: 'Wednesday',
        thursday: 'Thursday',
        friday: 'Friday',
        saturday: 'Saturday',
    },

    daysShort: {
        sunday: 'Sun',
        monday: 'Mon',
        tuesday: 'Tue',
        wednesday: 'Wed',
        thursday: 'Thu',
        friday: 'Fri',
        saturday: 'Sat',
    },

    /** Compact session lengths shown in tables and summaries. */
    duration: {
        minutes: '{{minutes}} min',
        hours: '{{hours}}h',
        hoursMinutes: '{{hours}}h {{minutes}}m',
        presets: {
            min15: '15 min',
            min30: '30 min',
            min45: '45 min',
            hour1: '1 hour',
            hour1h30: '1.5 hours',
            hour2: '2 hours',
        },
    },

    /** The services catalog list — grid, table and mobile rows. */
    list: {
        newService: 'New service',
        searchPlaceholder: 'Search services…',
        filterTitle: 'Filter services',
        applyFilters: 'Show services',
        statusSection: 'Status',
        allStatuses: 'All statuses',
        statusChip: 'Status: {{value}}',
        gridView: 'Grid view',
        listView: 'List view',
        rowActions: 'Service actions',
        columns: {
            service: 'Service',
            duration: 'Duration',
            mode: 'Mode',
            status: 'Status',
        },
        count: plural({ one: '{{count}} service', other: '{{count}} services' }),
        emptyTitle: 'No services yet',
        emptyDescription: 'Create a bookable service to start accepting appointments.',
        emptyFilteredTitle: 'No matching services',
        emptyFilteredDescription: 'Try adjusting your search or status filter.',
    },

    /** AI-search indexing — mirrors the products surface. */
    vectorisation: {
        notStarted: 'Not indexed',
        pending: 'Indexing…',
        completed: 'AI search ready',
        failed: 'Indexing failed',
        enable: 'Enable AI search',
        retry: 'Retry AI search',
        disable: 'Disable AI search',
        editLocked: 'Edit (locked — indexing)',
        editLockedToast: 'Editing is locked while AI indexing is in progress.',
        statusLockedToast: 'Status changes are locked while AI indexing is in progress.',
        busyToast: 'AI search is being indexed — please wait until it finishes.',
        enabled: 'AI search enabled',
        disabled: 'AI search disabled',
        retryQueued: 'AI search retry queued',
        updateFailed: 'AI search could not be updated.',
        toggleLabel: 'Enable AI vectorisation',
        toggleHelp:
            'When enabled and the service is complete and active, service data is sent for ' +
            'vectorisation so customers can find it via AI search. Status and retry options are ' +
            'available from the service card.',
    },

    /** Vendor-triggered status changes on a service. */
    transitions: {
        publish: 'Publish service',
        unpublish: 'Unpublish (draft)',
        archive: 'Archive',
        restore: 'Restore to draft',
        confirmTitle: 'Confirm',
        confirm: {
            archiveDraft: 'Archive this service? It will no longer be bookable.',
            archiveActive:
                'Archive this live service? It will stop accepting new bookings immediately.',
            unpublish: 'Unpublish this service? It will stop accepting new bookings.',
            generic: 'Apply this status change?',
        },
    },

    wizard: {
        stepDetails: 'Details',
        stepImages: 'Images',
        stepBooking: 'Booking',
        stepAvailability: 'Availability',
        stepReview: 'Review',
        createTitle: 'Create Service',
        createSubtitle: 'Add a new bookable service to your store',
        editTitle: 'Edit Service',
        backToServices: 'Services',
        saveAndContinue: 'Save & Continue',
        skipForNow: 'Skip for now',
    },

    basics: {
        title: 'Service details',
        description: 'Core details about your bookable service. You can update these later.',
        name: 'Service name',
        namePlaceholder: 'e.g. 1-Hour Consultation',
        category: 'Category',
        categoryPlaceholder: 'e.g. Coaching, Consulting, Wellness',
        descriptionLabel: 'Description',
        descriptionPlaceholder: 'What does this booking include?',
        tags: 'Tags',
        tagPlaceholder: 'Add tag, press Enter or comma',
        seoSection: 'SEO (optional)',
        seoTitle: 'SEO title',
        seoTitlePlaceholder: 'Leave blank to use service name',
        seoDescription: 'SEO description',
        seoDescriptionPlaceholder: 'Brief description for search engines',
        charCount: '({{current}}/{{max}})',
    },

    images: {
        title: 'Service images',
        description:
            'Add up to {{limit}} images. The first image will be used as the service thumbnail. ' +
            'Drag cards to reorder. Images come from your media library — upload new ones right ' +
            'inside the picker.',
    },

    /** The shared booking-settings editor (duration, price, mode, peak hours). */
    config: {
        durationLabel: 'Session duration',
        durationUnit: 'minutes',
        priceLabel: 'Booking price (XAF)',
        priceHelp:
            'Base rate for one session ({{duration}} min). Longer bookings are prorated ' +
            'automatically; peak-hours surcharge is added on top.',
        modeLabel: 'Booking mode',
        seatsLabel: 'Seats per slot',
        seatsPlaceholder: 'e.g. 10',
        seatsHelp: 'How many customers can book the same time slot.',
        bufferBefore: 'Buffer before (min)',
        bufferAfter: 'Buffer after (min)',
        peakTitle: 'Peak-hours surcharge',
        peakHelp: 'Charge extra during busy windows.',
        peakDays: 'Days',
        peakDaysHelp: 'Leave all unselected to apply every day.',
        peakStart: 'Start time',
        peakEnd: 'End time',
        peakType: 'Surcharge type',
        peakTypePercentage: 'Percentage (%)',
        peakTypeFixed: 'Fixed amount',
        peakAmount: 'Amount (XAF)',
        peakPercent: 'Percent (%)',
    },

    booking: {
        settingsTitle: 'Booking settings',
        settingsDescription:
            'Set the session length, price, and how customers can book this service.',
        status: {
            pending: 'Pending',
            confirmed: 'Confirmed',
            completed: 'Completed',
            'no-show': 'No-show',
            cancelled: 'Cancelled',
        },
        /** Badge wording — deliberately more explicit than the filter labels. */
        payment: {
            unpaid: 'Unpaid',
            pending: 'Payment pending',
            paid: 'Paid',
            disputed: 'Disputed',
            failed: 'Payment failed',
            refunded: 'Refunded',
        },
        /** Filter-chip wording, where the section title already says "Payment". */
        paymentShort: {
            unpaid: 'Unpaid',
            pending: 'Pending',
            paid: 'Paid',
            disputed: 'Disputed',
            failed: 'Failed',
            refunded: 'Refunded',
        },
        transitions: {
            confirm: 'Confirm booking',
            complete: 'Complete & settle',
            noShow: 'Mark no-show',
            cancel: 'Cancel booking',
        },
    },

    bookings: {
        filterTitle: 'Filter bookings',
        applyFilters: 'Show bookings',
        statusSection: 'Booking status',
        anyStatus: 'Any status',
        paymentSection: 'Payment status',
        anyPayment: 'Any',
        statusChip: 'Status: {{value}}',
        paymentChip: 'Payment: {{value}}',
        viewList: 'List',
        viewCalendar: 'Calendar',
        emptyTitle: 'No bookings',
        emptyDescription:
            'Bookings appear here once customers reserve a time for your services.',
        columns: {
            service: 'Service',
            customer: 'Customer',
            when: 'When',
            status: 'Status',
            payment: 'Payment',
            price: 'Price',
        },
        count: plural({ one: '{{count}} booking', other: '{{count}} bookings' }),
        /** Shown when the booking's product was not expanded by the API. */
        untitledService: 'Service',
    },

    detail: {
        title: 'Booking',
        customer: 'Customer',
        payment: 'Payment',
        paymentRequired: 'Payment required',
        paymentNotRequired: 'No payment required',
        paidAt: 'paid {{date}}',
        disputeNotice:
            'The customer opened a chargeback on this payment. Stripe is resolving it — no ' +
            'action is needed. If lost, the booking is refunded and cancelled.',
        cancellationReason: 'Cancellation reason',
        markCashReceived: 'Mark cash payment received',
        reschedule: 'Reschedule',
        statusConfirmDescription:
            'Apply this change? Confirmed bookings sync to your Google Calendar.',
        cancelTitle: 'Cancel this booking?',
        cancelDescription:
            "The calendar event is removed and the customer is notified. This can't be undone.",
        cancelReasonPlaceholder: 'Reason (optional)',
        keepBooking: 'Keep booking',
        confirmCancel: 'Cancel booking',
    },

    /** The settlement dialog behind "Complete & settle". */
    complete: {
        title: 'Complete & settle',
        description: 'Choose how to settle the final price. The amount is recomputed by the system.',
        modes: {
            asBooked: 'Settle as booked',
            asBookedHint: 'Charge the originally booked duration.',
            actualEnd: 'Actual end time',
            actualEndHint: 'Recompute from when the service really ended.',
            extraMinutes: 'Extra minutes',
            extraMinutesHint: 'Add minutes beyond the booked end.',
            fixedPrice: 'Fixed price',
            fixedPriceHint: 'Charge a flat final amount.',
        },
        actualEndLabel: 'Actual end time',
        extraMinutesLabel: 'Extra minutes',
        extraMinutesPlaceholder: 'e.g. 30',
        fixedPriceLabel: 'Final price ({{currency}})',
        fixedPriceHelp: 'Amount in the smallest currency unit.',
        submit: 'Complete booking',
        resultTitle: 'Booking completed',
        resultDescription: 'The final price has been settled.',
        originallyBooked: 'Originally booked',
        finalPrice: 'Final price',
        peakSurcharge: 'Incl. peak surcharge',
        additionalDue: '{{amount}} additional due',
        additionalDueHelp:
            'The shortfall is recorded on the booking, but automatic collection isn’t enabled ' +
            'yet — arrange the extra payment with the customer directly.',
        errors: {
            actualEndRequired: 'Pick the actual end time',
            extraMinutesRequired: 'Enter the extra minutes',
            priceInvalid: 'Enter a valid price',
        },
    },

    reschedule: {
        title: 'Reschedule booking',
        empty:
            "No open time slots in the next {{days}} days. Check the service's availability rules.",
        heldFor: 'Held for {{time}}',
        confirm: 'Confirm new time',
        lockExpired: 'The hold on that time expired. Pick a slot again.',
        lockFailed: 'Could not hold that slot',
    },

    availability: {
        stepTitle: 'Select hours',
        stepDescription:
            'Set the weekly hours customers can book. Toggle a day open to add its hours, or ' +
            'leave it closed — you can refine this later.',
        closed: 'Closed',
        open: 'Open',
        close: 'Close',
        removeHours: 'Remove this set of hours',
        addHours: 'Add a set of hours',
        invalidRange: 'Close time must be after open time.',
        dayOpen: '{{day}} open',
        dayClosed: '{{day}} closed',
        fixHoursTitle: 'Fix opening hours',
        fixHoursDescription: '{{days}}: close time must be after open time.',
        partialFailure: 'Some hours could not be saved',
        removeFailure: '{{day}} (remove)',
        dayFailure: '{{day}} ({{reason}})',
        createFailure: 'New hours ({{reason}})',
        overlapReason: 'overlaps existing hours',
        genericReason: 'failed to save',
        saved: 'Availability saved',
    },

    review: {
        title: 'Review & publish',
        description:
            'Review your service before publishing. You can always save as draft and publish later.',
        indexingNotice:
            'This service is being indexed for AI search. Editing is temporarily disabled.',
        archivedNotice:
            'This service is archived and read-only. Restore it to draft from the services list ' +
            'to edit or publish it.',
        pendingReviewNotice:
            'This service is awaiting admin review and is read-only until moderation completes.',
        suspendedNotice:
            'This service is suspended. You can still edit it — it is restored automatically ' +
            'once the cause is resolved.',
        typeLabel: 'service',
        duration: 'Duration',
        price: 'Price',
        mode: 'Booking mode',
        seats: 'Seats per slot',
        tags: 'Tags',
        requirements: 'Publishing requirements',
        requirementsMet: 'All requirements met — ready to publish',
        keepDraft: 'Keep as draft',
        publish: 'Publish',
        publishing: 'Publishing…',
    },

    /** Google Calendar connection (the Calendar tab + the gating banner). */
    calendarPanel: {
        connectTitle: 'Connect Google Calendar',
        connectDescription:
            'Customers can only book once your calendar is connected — bookings are written as ' +
            'events on it, and your existing busy times are blocked from offered slots.',
        connect: 'Connect Google Calendar',
        connectShort: 'Connect',
        connected: 'Connected',
        calendarId: 'Calendar: {{id}}',
        lastSynced: 'Last synced {{date}}',
        disconnect: 'Disconnect',
        permissions: 'Granted permissions',
        reauthTitle: 'Reconnection required',
        reauthDescription:
            'Access to your Google Calendar was revoked or expired. Reconnect to keep accepting ' +
            'bookings.',
        reconnect: 'Reconnect',
        disconnectTitle: 'Disconnect Google Calendar?',
        disconnectDescription:
            'New bookings will be blocked until you reconnect. Existing bookings are not deleted.',
        keepConnected: 'Keep connected',
        banner:
            'Connect your Google Calendar so customers can book. Setup works without it, but ' +
            'bookings need a connected calendar.',
        connectedToast: 'Google Calendar connected',
        disconnectedToast: 'Google Calendar disconnected',
        connectFailed: 'Could not connect Google Calendar.',
        /** `reason` codes on the OAuth error redirect (calendar.md). */
        oauth: {
            missing_code: 'Google did not return an authorization code. Please try again.',
            missing_state: 'The connection request was missing its security token. Please try again.',
            state_mismatch: 'The connection could not be verified. Please try connecting again.',
            invalid_state: 'The connection link expired. Please try connecting again.',
            connection_failed: 'We could not complete the connection with Google. Please try again.',
        },
    },

    calendarView: {
        previousMonth: 'Previous month',
        nextMonth: 'Next month',
        today: 'Today',
        more: '+{{count}} more',
    },

    /** Field-level validation. Referenced by the zod schemas via key. */
    validation: {
        titleMin: 'Title must be at least 3 characters',
        titleMax: 'Title must be 200 characters or less',
        categoryRequired: 'Category is required',
        descriptionRequired: 'Description is required',
        tagEmpty: 'Tag cannot be empty',
        tagsUnique: 'Tags must be unique',
        seoTitleMax: 'SEO title must be 60 characters or less',
        seoDescriptionMax: 'SEO description must be 160 characters or less',
        durationRequired: 'Duration is required',
        durationInteger: 'Duration must be a whole number of minutes',
        durationMin: 'Duration must be at least 1 minute',
        priceRequired: 'Price is required',
        priceMin: 'Price must be greater than 0',
        bufferMin: 'Buffer cannot be negative',
        seatsInteger: 'Seats must be a whole number',
        seatsMin: 'At least 1 seat',
        seatsRequired: 'Set the seats per slot for capacity bookings',
        surchargeRequired: 'Surcharge value is required',
        surchargeMin: 'Cannot be negative',
        timeFormat: 'Use 24-hour HH:mm',
        timeOrder: 'End must be after start',
    },

    /** Client-side publish pre-flight (mirrors the backend requirements). */
    activation: {
        notCreated: 'Service has not been created yet',
        noDescription: 'A service description is required.',
        noDuration: 'Set a session duration before publishing.',
        noPrice: 'Set a booking price before publishing.',
        zeroPrice: 'The booking price must be greater than 0.',
        noVariant: 'A booking price must be saved before publishing.',
        noCapacity: 'Set the seats per slot (capacity) before publishing.',
    },

    toast: {
        detailsSaved: 'Details saved',
        imagesSaved: 'Images saved',
        bookingSettingsSaved: 'Booking settings saved',
        published: 'Service published successfully!',
        savedAsDraft: 'Service saved as draft.',
        statusUpdated: 'Service updated',
        bookingUpdated: 'Booking updated',
        bookingCancelled: 'Booking cancelled',
        bookingRescheduled: 'Booking rescheduled',
        markedPaid: 'Marked as paid',
    },

    errors: {
        loadFailed: "We couldn't load your services. Please try again.",
        loadServiceFailed: "We couldn't load this service. Please try again.",
        loadBookingsFailed: "We couldn't load your bookings. Please try again.",
        loadBookingFailed: "We couldn't load this booking. Please try again.",
        loadCalendarFailed: "We couldn't load your calendar. Please try again.",
        loadCalendarStatusFailed: "We couldn't check your calendar connection. Please try again.",
        loadAvailabilityFailed: "We couldn't load your availability. Please try again.",
        loadSlotsFailed: "We couldn't load the available times. Please try again.",
        saveDetailsFailed: "We couldn't save these details. Please try again.",
        saveImagesFailed: "We couldn't save the images. Please try again.",
        saveBookingSettingsFailed: "We couldn't save the booking settings. Please try again.",
        publishFailed: "We couldn't publish this service. Please try again.",
        saveFailed: "We couldn't save this service. Please try again.",
        statusChangeFailed: "We couldn't update this service. Please try again.",
        bookingUpdateFailed: "We couldn't update this booking. Please try again.",
        bookingCancelFailed: "We couldn't cancel this booking. Please try again.",
        markPaidFailed: "We couldn't mark this booking as paid. Please try again.",
        completeFailed: "We couldn't complete this booking. Please try again.",
        rescheduleFailed: "We couldn't reschedule this booking. Please try again.",
        disconnectFailed: "We couldn't disconnect Google Calendar. Please try again.",
    },
} as const;

export default services;
