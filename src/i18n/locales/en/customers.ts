import { plural } from '../../types';

/** Customers list, detail sheet, flags and refunds. */
export const customers = {
    title: 'Customers',
    subtitle: 'Everyone who has ordered from your store',

    list: {
        searchPlaceholder: 'Search by name or email…',
        filterTitle: 'Filter customers',
        applyFilters: 'Show customers',
        flagSection: 'Flag',
        allFlags: 'All flags',
        noFlagsYet: 'No flags yet — create one from “Manage flags”.',
        sortSection: 'Sort by',
        flagChip: 'Flag: {{value}}',
        sortChip: 'Sort: {{value}}',
        manageFlags: 'Manage flags',
        emptyTitle: 'No customers yet',
        emptyDescription: 'Customers appear here once they place their first order with you.',
        emptyFilteredTitle: 'No matching customers',
        emptyFilteredDescription: 'Try adjusting your search or flag filter.',
        count: plural({ one: '{{count}} customer', other: '{{count}} customers' }),
    },

    sort: {
        recent: 'Most recent order',
        spentDesc: 'Highest spend',
        spentAsc: 'Lowest spend',
        ordersDesc: 'Most orders',
    },

    columns: {
        customer: 'Customer',
        flags: 'Flags',
        orders: 'Orders',
        spent: 'Total spent',
        lastOrder: 'Last order',
    },

    /** Compact "time since last order" in the list. */
    time: {
        noOrders: 'No orders yet',
        justNow: 'just now',
        minutesAgo: '{{count}}m ago',
        hoursAgo: '{{count}}h ago',
        daysAgo: '{{count}}d ago',
    },

    detail: {
        title: 'Customer',
        editName: 'Edit display name',
        resetToRealName: 'Reset to “{{name}}”',
        overrideNote: 'Override of {{name}} · only you see this name',
        // A closed account is anonymised and kept, not deleted — its orders and
        // totals stay, but there is nothing left to contact.
        closedName: 'Closed account',
        closedNote: 'This customer closed their account. Their order history is kept, but their contact details were removed.',
        totalOrders: 'Total orders',
        totalSpent: 'Total spent',
        flags: 'Flags',
        assignFlag: 'Assign',
        noFlagsCreated: 'No flags created yet.',
        noFlagsAssigned: 'No flags assigned.',
        contact: 'Contact',
        noAddress: 'No saved address',
        orders: 'Orders',
        latestOf: 'Latest {{shown}} of {{total}}',
        totalCount: '{{count}} total',
        noOrders: 'No orders found for this customer.',
        digital: 'Digital',
        physical: 'Physical',
        refund: 'Refund',
    },

    /** Order payment pills inside the detail sheet's order list. */
    paymentStatus: {
        paid: 'Paid',
        partially_refunded: 'Partially refunded',
        refunded: 'Refunded',
        pending: 'Unpaid',
        authorized: 'Authorized',
        disputed: 'Disputed',
        failed: 'Failed',
    },

    flags: {
        title: 'Customer flags',
        description: 'Colour-coded tags to segment your customers (e.g. VIP, New).',
        editorDescription: 'Name, colour and an optional description.',
        newFlag: 'New flag',
        editFlag: 'Edit flag',
        removeFlag: 'Remove the {{name}} flag',
        back: 'Back to flags',
        emptyTitle: 'No flags yet',
        emptyDescription: 'Create your first flag to start grouping customers.',
        editAria: 'Edit {{name}}',
        deleteAria: 'Delete {{name}}',
        deleteTitle: 'Delete “{{name}}”?',
        deleteDescription:
            "This removes the flag and detaches it from every customer it's currently assigned " +
            "to. This can't be undone.",
        keepFlag: 'Keep flag',
        deleteConfirm: 'Delete flag',
        preview: 'Preview:',
        previewName: 'Flag name',
        name: 'Name',
        namePlaceholder: 'e.g. VIP',
        colour: 'Colour',
        customColour: 'Custom colour',
        descriptionLabel: 'Description',
        descriptionPlaceholder: 'Optional — what this flag means',
        create: 'Create flag',
        duplicateName: 'You already have a flag with this name.',
        stale: 'That flag no longer exists. Refresh your flags.',
    },

    /** Preset swatches in the flag editor. */
    colors: {
        orange: 'Orange',
        red: 'Red',
        amber: 'Amber',
        green: 'Green',
        teal: 'Teal',
        blue: 'Blue',
        indigo: 'Indigo',
        violet: 'Violet',
        pink: 'Pink',
        slate: 'Slate',
    },

    refund: {
        title: 'Refund {{order}}',
        fallbackOrder: 'order',
        description: "Wi-Mall sends the money back to the customer. Once it's sent, it can't be undone.",
        notRefundable: "This order can't be refunded",
        notEligible: 'It is not currently eligible for a refund.',
        /** A refund of this order is already in progress (`REFUND_ALREADY_OPEN`). */
        alreadyOpen: 'A refund of this order is already in progress',
        maxRefundable: 'Max refundable',
        remaining: 'Remaining balance',
        settlesIn: 'Refund settles in ~{{days}} days.',
        returnShipping: 'Return shipping paid by {{payer}}.',
        amount: 'Amount ({{currency}})',
        amountHelp: 'You can refund up to {{max}}. Lower it for a partial refund.',
        /** Only under the "reimbursed if defective" return-shipping rule. */
        itemDefective: 'The item was defective',
        itemDefectiveHelp: 'The customer also gets their delivery money back. You pay for it.',
        amountDefectivePlaceholder: 'Most allowed',
        amountDefectiveHelp: 'Leave it empty to refund the most allowed, delivery included. The exact amount shows once you confirm.',
        reason: 'Reason (optional)',
        reasonPlaceholder: 'Kept with the refund request.',
        submit: 'Refund',
        submitAmount: 'Refund {{amount}}',
        earningsNote: 'Your share of this amount is taken back from your earnings.',
        /**
         * How the money will reach the customer, said before the click. Only the
         * rate is named — the fee itself comes from the server after the click.
         */
        how: {
            autoSend: 'Sent straight away',
            needsApproval: 'Needs approval by Wi-Mall',
            card: 'It goes back to the customer’s card in full, with no fee.',
            mobileMoney: 'It is sent to the mobile money number that paid. A 2% transfer fee comes off what the customer receives.',
            cod: 'Cash on delivery: it can only be sent once the delivery company has handed this order’s cash to Wi-Mall. A 2% transfer fee comes off what the customer receives.',
        },
        /** After the click — the server's own figures. */
        result: {
            amountWithFee: 'Refund {{gross}} — the customer receives {{net}} ({{fee}} transfer fee).',
            amountNoFee: 'Refund {{gross}} — the customer receives the full amount.',
        },
    },

    /**
     * Where a refund request is. ⛔ Only `completed` may say "refunded" — every
     * other status is money still on its way.
     */
    refundStatus: {
        /** Short, where the Refund button was. */
        badge: {
            awaiting_approval: 'Refund requested',
            approved: 'Refund approved',
            waiting_for_cash: 'Refund waiting for cash',
            sending: 'Refund on its way',
            failed: 'Refund not sent yet',
            completed: 'Refunded',
            rejected: 'Refund declined',
            unknown: 'Refund in progress',
        },
        /** One sentence: where the money is now. */
        note: {
            awaiting_approval: 'Requested — Wi-Mall will approve it and send it to the customer.',
            awaitingApprovalCod:
                'Requested — Wi-Mall will approve it and send it once the delivery company has handed the cash to Wi-Mall.',
            approved: 'Approved — Wi-Mall will send it to the customer.',
            waiting_for_cash:
                'Approved — it will be sent as soon as the delivery company has handed the cash to Wi-Mall.',
            sending: 'Sent to the customer’s number. It should arrive shortly.',
            sendingTo: 'Sent to the customer’s number ({{number}}). It should arrive shortly.',
            failed: 'The transfer didn’t go through — Wi-Mall will retry.',
            completed: 'Refunded to the customer.',
            completedCard: 'Refunded to the customer’s card (full amount).',
            rejected: 'Wi-Mall declined this refund.',
            unknown: 'A refund of this order is in progress.',
        },
    },

    /** Who pays return shipping, per the vendor's return policy. */
    returnPayer: {
        vendor: 'You (vendor)',
        customer: 'Customer',
        customer_reimbursed_if_defect: 'Customer (reimbursed if defective)',
    },

    /** Why an order is not refundable (backend `reasonCode`). */
    refundReason: {
        REFUND_POLICY_DISABLED: 'Your return policy has refunds disabled.',
        REFUND_ORDER_NOT_PAID: 'This order has not been paid, so there is nothing to refund.',
        REFUND_PAYMENT_NOT_FOUND: 'No successful payment is linked to this order.',
        REFUND_ALREADY_FULLY_REFUNDED: 'This order has already been fully refunded.',
        REFUND_WINDOW_EXPIRED: 'The return window for this order, counted from its delivery date, has ended.',
        REFUND_NOT_ELIGIBLE: 'Your policy resolves the refundable amount to zero for this order.',
        REFUND_ALREADY_OPEN: 'A refund of this order is already in progress.',
    },

    /** Field-level validation. Referenced by the zod schema via key. */
    validation: {
        nameRequired: 'Name is required',
        nameMax: 'Name must be 60 characters or less',
        descriptionMax: 'Description must be 200 characters or less',
        hexColor: 'Enter a hex colour like #FF8800',
    },

    toast: {
        flagCreated: 'Flag created',
        flagUpdated: 'Flag updated',
        flagDeleted: 'Flag deleted',
        nameUpdated: 'Display name updated',
        nameReset: 'Display name reset to real name',
    },

    errors: {
        loadFailed: "We couldn't load your customers. Please try again.",
        loadDetailFailed: "We couldn't load this customer. Please try again.",
        loadOrdersFailed: "We couldn't load this customer's orders. Please try again.",
        saveFlagFailed: "We couldn't save that flag. Please try again.",
        deleteFlagFailed: "We couldn't delete that flag. Please try again.",
        updateFlagsFailed: "We couldn't update this customer's flags. Please try again.",
        updateNameFailed: "We couldn't update the display name. Please try again.",
        resetNameFailed: "We couldn't reset the display name. Please try again.",
        eligibilityFailed: "We couldn't check whether this order can be refunded. Please try again.",
        refundFailed: "We couldn't request the refund. Please try again.",
    },
} as const;

export default customers;
