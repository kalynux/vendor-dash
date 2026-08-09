import { plural } from '../../types';

/** Support tickets with the platform team. */
export const tickets = {
    title: 'Tickets',
    subtitle: 'Track and resolve issues with the Jovi Mall team.',

    empty: {
        title: 'No tickets yet',
        description: 'Open a ticket when you need help from the platform team.',
        filtered: 'No tickets match your filters.',
    },

    /** Backend `TicketStatus`, one key per enum value. */
    status: {
        open: 'Open',
        in_progress: 'In Progress',
        waiting_on_admin: 'Waiting on Admin',
        waiting_on_vendor: 'Waiting on You',
        waiting_on_customer: 'Waiting on Customer',
        waiting_on_agency: 'Waiting on Agency',
        waiting_on_agent: 'Waiting on Agent',
        resolved: 'Resolved',
        closed: 'Closed',
    },

    /** Shorter wording for the list's filter tabs. */
    statusTabs: {
        all: 'All',
        open: 'Open',
        in_progress: 'In progress',
        waiting_on_vendor: 'Waiting on you',
        waiting_on_admin: 'Waiting on admin',
        waiting_on_customer: 'Waiting on customer',
        waiting_on_agency: 'Waiting on agency',
        waiting_on_agent: 'Waiting on agent',
        resolved: 'Resolved',
        closed: 'Closed',
    },

    priority: {
        normal: 'Normal',
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        urgent: 'Urgent',
    },

    importance: {
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        critical: 'Critical',
    },

    /** What a ticket is attached to. */
    entityType: {
        ORDER: 'Order',
        PRODUCT: 'Product',
        BOOKING: 'Booking',
        ACCOUNT: 'Account',
        OTHER: 'Other',
    },

    /** Who wrote a message. */
    role: {
        admin: 'Admin',
        agent: 'Support Agent',
        vendor: 'Vendor',
        customer: 'Customer',
        agency: 'Agency',
    },

    columns: {
        subject: 'Subject',
        status: 'Status',
        priority: 'Priority',
        category: 'Category',
        updated: 'Last update',
        created: 'Opened',
    },

    /** The list surface. */
    list: {
        searchPlaceholder: 'Search tickets…',
        filterTitle: 'Filter tickets',
        applyLabel: 'Show tickets',
        allTypes: 'All types',
        sortBy: 'Sort by',
        newTicket: 'New ticket',
        clearFilters: 'Clear filters',
        added: 'Ticket added to your list',
        empty: 'No tickets yet',
        emptyHint: 'Create your first ticket to get help from the team.',
        emptyFiltered: 'No matching tickets',
        emptyFilteredHint: 'Try adjusting your search or filters.',
        anyStatus: 'Any status',
        anyPriority: 'Any',
        type: 'Type',
        chipStatus: 'Status: {{value}}',
        chipType: 'Type: {{value}}',
        chipPriority: 'Priority: {{value}}',
        chipSort: 'Sort: {{value}}',
        sort: {
            updated: 'Recently updated',
            created: 'Recently created',
            priority: 'Priority',
        },
    },

    create: {
        title: 'New support ticket',
        description: 'Describe your issue and link it to the related order, product, or account.',
        subject: 'Subject',
        subjectPlaceholder: 'Brief summary of the issue',
        message: 'Message',
        descriptionLabel: 'Description',
        descriptionPlaceholder: 'Provide as much detail as possible…',
        typePlaceholder: 'Select a ticket type',
        importance: 'Importance',
        importancePlaceholder: 'Select importance',
        relatedTo: 'Related to',
        trackingNumber: 'Tracking number',
        trackingPlaceholder: 'Select a tracking number',
        trackingManualPlaceholder: 'e.g. shipment or carrier tracking number',
        trackingNeedsOrder: 'Select an order above to choose its tracking number.',
        trackingEnterManually: 'Enter manually…',
        trackingNone: 'No tracking numbers found for this order yet — it may not be dispatched.',
        trackingUseList: "Choose from the order's tracking numbers instead",
        addAttachment: 'Add attachment',
        submit: 'Create ticket',
        created: 'Ticket created successfully',
        entityGone: 'The selected order, product, or booking no longer exists.',
        requiredInfoMissing:
            'Your support policy requires more information before this ticket can be created.',
        failed: 'Failed to create ticket',
        type: 'Type',
        typeModalTitle: 'Select a ticket type',
        typeModalDescription: 'Search by keyword to find the closest match.',
        typeSearchPlaceholder: 'Search ticket types…',
        entityTypeModalDescription: 'What is this ticket about?',
        selectPlaceholder: 'Select',
        searchPlaceholder: 'Search…',
        entity: 'Entity',
        optional: '(optional)',
        attachments: 'Attachments',
        attachmentCount: '{{used}}/{{max}} files. Photos and videos supported.',
        attachmentLockNotice:
            'Once the ticket is created, these files stay attached to it — they can’t be detached until the ticket is closed.',
        removeFile: 'Remove {{name}}',
        fileFallback: 'file',
        deliveryAgencyFallback: 'Delivery agency',
    },

    detail: {
        conversation: 'Conversation',
        replyPlaceholder: 'Write a note…',
        noMessages: 'No messages yet. Start the conversation below.',
        closedNoMessages: 'This ticket is closed. No new messages can be added.',
        visibleTo: 'Visible to:',
        sendReply: 'Send reply',
        privateNote: 'Private note',
        close: 'Close ticket',
        reopen: 'Reopen ticket',
        followers: 'Followers',
        attachmentCount: plural({ one: '{{count}} attachment', other: '{{count}} attachments' }),

        edit: 'Edit ticket',
        priority: 'Priority',
        importance: 'Importance',
        relatedTo: 'Related to',
        assignedTo: 'Assigned to',
        lastUpdated: 'Last updated',
        ticketId: 'Ticket ID',
        description: 'Description',
        priorityLockedByAdmin: 'An admin set this priority; it can no longer be changed.',
        unassigned: 'Unassigned',
        cannotReassign: 'Vendors can’t reassign tickets.',
        noFollowers: 'No followers yet.',
        followerLimit: 'Up to 5 non-admin followers per ticket.',
        closeConfirmTitle: 'Close this ticket?',
        closeConfirmBody:
            'Closing the ticket marks it as resolved. You won’t be able to change its priority or add new messages or attachments afterwards. This can’t be undone from here.',
        keepOpen: 'Keep open',

        attachments: 'Attachments',
        attachmentLockNotice:
            'Once attached, a file stays on the ticket — it can’t be detached until the ticket is closed.',
        attachmentsClosed: 'This ticket is closed.',
        attachmentNotYours: 'You can only attach files you own.',
        attachmentFailed: 'Failed to attach file',
        attachmentsLoadFailed: 'Failed to load attachments',
        attachmentsAttached: plural({ one: 'Attached {{count}} file', other: 'Attached {{count}} files' }),
        attachmentsLimit: 'Maximum of {{max}} attachments per ticket reached.',
        attachmentsAtLimit: 'Maximum of {{max}} attachments reached',
        uploadedBy: '{{size}} · uploaded by {{name}}',
        download: 'Download {{name}}',
        attaching: 'Attaching…',
        uploadAttachment: 'Upload attachment',
        public: 'Public',
        private: 'Private',
        notesLoadFailed: 'Failed to load messages',
        noteSent: 'Message sent',
        noteFailed: 'Failed to send message',
        noteTooLong: 'A message must be {{max}} characters or less',
        noteCount: plural({ one: '{{count}} message', other: '{{count}} messages' }),
        send: 'Send',

        followerHint: 'Who can see this private item? Admins always can.',
        noMatches: 'No matches found.',
        loadingTicket: 'Loading ticket…',
        ticket: 'Ticket',
        subject: 'Subject',
        type: 'Type',
        created: 'Created',
        noParticipant: ' · no participant',
        lockedByAdmin: 'Locked by admin',
        updateFailed: 'Failed to update ticket',
        statusUpdateFailed: 'Failed to update status',
        priorityUpdateFailed: 'Failed to update priority',
        closeFailed: 'Failed to close ticket',
    },

    /** The read-only FAQ drawer. */
    faq: {
        title: 'Frequently Asked Questions',
        description: 'Quick answers to the most common questions. Still stuck? Create a ticket.',
    },

    /** `relativeTime()` in ticket.constants — compact, not `Intl.RelativeTimeFormat`. */
    time: {
        justNow: 'just now',
        minutesAgo: '{{count}}m ago',
        hoursAgo: '{{count}}h ago',
        daysAgo: '{{count}}d ago',
    },

    toast: {
        created: 'Ticket opened',
        replied: 'Reply sent',
        closed: 'Ticket closed',
        reopened: 'Ticket reopened',
        priorityUpdated: 'Priority updated',
        updated: 'Ticket updated',
        statusUpdated: 'Status updated',
    },

    errors: {
        loadFailed: "We couldn't load your tickets. Please try again.",
        createFailed: "We couldn't open the ticket. Please try again.",
        replyFailed: "We couldn't send your reply. Please try again.",
        editNotCreator: 'Only the ticket creator can edit these details.',
        noParticipantForRole: 'No participant with that role is on this ticket to wait on.',
        statusNotAllowed: 'That status change isn’t allowed from the current state.',
        priorityLocked: 'Priority is locked by an admin and cannot be changed.',
        closeNotAllowed: 'Only the ticket creator or an admin can close this ticket.',
        loadDetailFailed: "We couldn't load this ticket. Please try again.",
    },

    /**
     * The related-entity picker. Copy is keyed per entity type rather than
     * interpolating a noun — "Select order" / "Select product" take different
     * articles in French.
     */
    entityPicker: {
        optionalOwnAccount: 'Optional — leave blank to use your account',
        enterEntityId: 'Enter the related entity ID',
        selectOrder: 'Select an order…',
        selectProduct: 'Select a product…',
        titleOrder: 'Select an order',
        titleProduct: 'Select a product',
        descriptionOrder: 'Search your orders by order number or customer.',
        descriptionProduct: 'Search your catalogue by name, category, or tag.',
        searchOrder: 'Search by order number or customer…',
        searchProduct: 'Search by name, category, or tag…',
        loadingOrders: 'Loading orders…',
        loadingProducts: 'Loading products…',
        noOrders: 'No orders found.',
        noProducts: 'No products found.',
        loadOrdersFailed: "We couldn't load your orders. Please try again.",
        loadProductsFailed: "We couldn't load your products. Please try again.",
        deliveryStatus: 'Delivery: {{status}}',
    },

    followers: {
        everyone: 'Everyone (admins only)',
        count: plural({ one: '{{count}} follower', other: '{{count}} followers' }),
    },

    /** Grouping headers in the ticket-type picker. */
    typeGroups: {
        general: 'General & Account',
        orders: 'Orders',
        payments: 'Payments',
        payouts: 'Payouts',
        bookings: 'Bookings',
        products: 'Products',
        shipping: 'Shipping',
        technical: 'Technical',
        policy: 'Policy & Legal',
        other: 'Other',
    },

    /** Every `TicketType` the backend accepts (api-doc/ticket_types.txt). */
    types: {
        GENERAL_SUPPORT: 'General Support',
        ACCOUNT_ACCESS: 'Account Access',
        ACCOUNT_VERIFICATION: 'Account Verification',
        PROFILE_UPDATE: 'Profile Update',
        SECURITY_ISSUE: 'Security Issue',
        ORDER_ISSUE: 'Order Issue',
        ORDER_CANCELLATION: 'Order Cancellation',
        ORDER_REFUND: 'Order Refund',
        ORDER_DISPUTE: 'Order Dispute',
        ORDER_FULFILLMENT: 'Order Fulfillment',
        PAYMENT_ISSUE: 'Payment Issue',
        PAYMENT_FAILED: 'Payment Failed',
        PAYMENT_CONFIRMATION: 'Payment Confirmation',
        CHARGEBACK: 'Chargeback',
        INVOICE_REQUEST: 'Invoice Request',
        PAYOUT_REQUEST: 'Payout Request',
        PAYOUT_DELAY: 'Payout Delay',
        PAYOUT_DISPUTE: 'Payout Dispute',
        COMMISSION_QUESTION: 'Commission Question',
        BOOKING_ISSUE: 'Booking Issue',
        BOOKING_CANCELLATION: 'Booking Cancellation',
        BOOKING_RESCHEDULE: 'Booking Reschedule',
        AVAILABILITY_PROBLEM: 'Availability Problem',
        PRODUCT_ISSUE: 'Product Issue',
        INVENTORY_PROBLEM: 'Inventory Problem',
        PRICING_ISSUE: 'Pricing Issue',
        VARIANT_ISSUE: 'Variant Issue',
        SHIPPING_ISSUE: 'Shipping Issue',
        DELIVERY_DELAY: 'Delivery Delay',
        DELIVERY_CONFIRMATION: 'Delivery Confirmation',
        ADDRESS_CHANGE: 'Address Change',
        TECHNICAL_ISSUE: 'Technical Issue',
        BUG_REPORT: 'Bug Report',
        INTEGRATION_ISSUE: 'Integration Issue',
        API_ACCESS: 'API Access',
        POLICY_QUESTION: 'Policy Question',
        COMPLIANCE: 'Compliance',
        LEGAL_REQUEST: 'Legal Request',
        OTHER: 'Other',
    },

    /**
     * Field-level validation. Referenced by *key* from
     * `components/tickets/schemas/ticket.schemas.ts` and resolved at the render
     * site via `useMessage()`. The limits are spelled out rather than
     * interpolated: the schema is built at module load, with no locale in scope.
     */
    validation: {
        subjectMin: 'Subject must be at least 3 characters',
        subjectMax: 'Subject must be 200 characters or less',
        descriptionMin: 'Description must be at least 10 characters',
        descriptionMax: 'Description must be 5000 characters or less',
        typeRequired: 'Please select a ticket type',
        importanceRequired: 'Please select an importance level',
        entityTypeRequired: 'Please select a related entity type',
        trackingNumberMax: 'Tracking number must be 120 characters or less',
        attachmentsMax: 'You can attach at most 5 files',
        entityRequired: 'A related entity is required',
        trackingNumberRequired: 'A tracking number is required by your support policy.',
        attachmentRequired:
            'At least one photo or video attachment is required by your support policy.',
        noteRequired: 'Note cannot be empty',
        noteMax: 'Note must be 2000 characters or less',
    },
} as const;

export default tickets;
