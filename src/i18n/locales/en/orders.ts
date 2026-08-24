import { plural } from '../../types';

/** Orders list, filters, bulk actions and the order detail surfaces. */
export const orders = {
    title: 'Orders',
    subtitle: 'Manage and track customer orders',

    empty: {
        title: 'No orders found',
        description: 'Orders placed in your store will appear here.',
        filtered: 'No orders match your filters.',
    },

    columns: {
        order: 'Order',
        customer: 'Customer',
        date: 'Date',
        items: 'Items',
        total: 'Total',
        status: 'Status',
        payment: 'Payment',
        delivery: 'Delivery',
        actions: 'Actions',
    },

    /** Order fulfilment status — the `OrderStatus` enum. */
    status: {
        pending: 'Pending',
        processing: 'Processing',
        partiallyShipped: 'Partially Shipped',
        shipped: 'Shipped',
        partiallyDelivered: 'Partially Delivered',
        delivered: 'Delivered',
        fulfilled: 'Fulfilled',
        cancelled: 'Cancelled',
        returned: 'Returned',
    },

    /** Payment status — the `PaymentStatus` enum. */
    paymentStatus: {
        pending: 'Pending',
        awaitingPayment: 'Awaiting Payment',
        partiallyPaid: 'Partially Paid',
        paid: 'Paid',
        disputed: 'Disputed',
        failed: 'Failed',
        refunded: 'Refunded',
        partiallyRefunded: 'Partially refunded',
    },

    /** Per-shipment delivery status, as reported by the delivery agency. */
    deliveryStatus: {
        pending: 'Pending',
        assigned: 'Assigned',
        pickedUp: 'Picked Up',
        inTransit: 'In Transit',
        agentDelivered: 'Delivered by Agent',
        delivered: 'Delivered',
        failed: 'Failed',
        returned: 'Returned',
        rejected: 'Rejected',
        pendingAgencyReassignment: 'Needs Reassignment',
    },

    paymentMethod: {
        online: 'Online',
        cashOnDelivery: 'Cash on Delivery',
        /** Space is tight in the mobile header, so the abbreviation is used there. */
        cashOnDeliveryShort: 'COD',
    },

    orderType: {
        physical: 'Physical',
        digital: 'Digital',
    },

    /** The moves a vendor can make from the current status. */
    statusActions: {
        pending: 'Mark as Pending',
        processing: 'Mark as Processing',
        cancelled: 'Cancel Order',
    },

    bulk: {
        selected: plural({ one: '{{count}} order selected', other: '{{count}} orders selected' }),
        noCommonAction: 'No common action available for this selection.',
        clearSelection: 'Clear selection',
        actionsLabel: 'Bulk actions',
        dispatch: 'Dispatch',
        overLimit: 'Select up to {{max}} orders to act in bulk',
        statusUpdated: plural({ one: '{{count}} order updated', other: '{{count}} orders updated' }),
        dispatched: plural({ one: '{{count}} order dispatched', other: '{{count}} orders dispatched' }),
        /** All failures shared one code, so the reason is worth naming. */
        failedWithReason: plural({
            one: "{{count}} order failed: {{reason}}",
            other: "{{count}} orders failed: {{reason}}",
        }),
        /** Mixed codes — no single reason to give, so point at the rows. */
        failedMixed: plural({
            one: "{{count}} order couldn't be updated — see it for details.",
            other: "{{count}} orders couldn't be updated — see each order for details.",
        }),
    },

    /** The Orders list page: its own toolbar, filter sheet and table. */
    list: {
        export: 'Export',
        unknownCustomer: 'Unknown customer',
        createOrder: 'Create Order',
        createOrderLabel: 'Create order',
        orderActions: 'Order actions',
        selectAll: 'Select all',
        detailsTitle: 'Order Details',
        noStatusChanges: 'No further status changes available.',
        frozenAction: 'Frozen — payment disputed',
        frozenNotice: 'Payment under dispute — this order is frozen until it settles.',
        showing: 'Showing {{shown}} of {{items}}',
        showingCount: 'Showing {{items}}',

        filters: {
            title: 'Filter orders',
            apply: 'Show orders',
            // `q` matches the order number ONLY — not customer name or email.
            // A generic "Search orders" invited names and returned nothing.
            searchPlaceholder: 'Search by order number…',
            open: 'Filter orders',
            orderStatus: 'Order status',
            paymentStatus: 'Payment status',
            paymentMethod: 'Payment method',
            orderType: 'Order type',
            orderDate: 'Order date',
            anyStatus: 'Any status',
            any: 'Any',
            chipStatus: 'Status: {{value}}',
            chipPayment: 'Payment: {{value}}',
            chipMethod: 'Method: {{value}}',
            chipType: 'Type: {{value}}',
            chipDate: 'Date: {{value}}',
            chipCustomer: 'Customer: {{value}}',
        },

        bulkCancelDialog: {
            title: plural({ one: 'Cancel {{count}} Order?', other: 'Cancel {{count}} Orders?' }),
            body: plural({
                one: 'Are you sure you want to cancel <0>{{count}} selected order</0>? This action cannot be undone and will notify the customer.',
                other: 'Are you sure you want to cancel <0>{{count}} selected orders</0>? This action cannot be undone and will notify each customer.',
            }),
            keep: 'Keep Orders',
            confirm: plural({ one: 'Yes, Cancel {{count}} Order', other: 'Yes, Cancel {{count}} Orders' }),
        },
    },

    actions: {
        viewDetails: 'View details',
        markAsShipped: 'Mark as shipped',
        markAsDelivered: 'Mark as delivered',
        cancelOrder: 'Cancel order',
        refund: 'Refund',
        reassignAgency: 'Reassign agency',
        printInvoice: 'Print invoice',
        contactCustomer: 'Contact customer',
        updateStatus: 'Update Status',
        dispatchToAgency: 'Dispatch to Agency',
    },

    detail: {
        title: 'Order {{number}}',
        itemCount: plural({ one: '{{count}} item', other: '{{count}} items' }),
        placedOn: 'Placed on {{date}}',
        noFurtherActions: 'Order {{status}} — no further actions',

        tabs: {
            details: 'Details',
            items: 'Items',
            itemsWithCount: 'Items ({{count}})',
            timeline: 'Timeline',
            payment: 'Payment',
            access: 'Access',
            accessWithCount: 'Access ({{count}})',
        },

        customer: {
            title: 'Customer',
            infoTitle: 'Customer Info',
            /** "this vendor" because a platform-wide count would mislead. */
            orderCount: 'Orders (this vendor)',
            totalSpent: 'Spent (this vendor)',
            totalSpentLong: 'Total Spent',
            addToCustomers: 'Add to Customers',
        },

        shipping: {
            addressTitle: 'Shipping Address',
            noAddress: 'No address on file',
            deliveryMethodTitle: 'Delivery Method',
            digitalDelivery: 'Digital Delivery',
            digitalDeliveryNote: "Download links and credentials will be sent to the customer's registered email.",
            digitalDeliveryNoteShort: "Download links sent to customer's email",
            shipmentsTitle: 'Shipments',
            shipmentsTitleWithCount: 'Shipments ({{count}} agencies)',
            agency: 'Agency',
            noAgency: 'No agency assigned',
            assignedAgent: 'Assigned Agent',
            agent: 'Agent: {{name}}',
            tracking: 'Tracking: {{number}}',
            freeDelivery: 'Free delivery',
            deliveryTimeline: 'Delivery Timeline',
        },

        summary: {
            title: 'Order Summary',
            subtotal: 'Subtotal',
            tax: 'Tax',
            shipping: 'Shipping',
            free: 'Free',
            discount: 'Discount',
            total: 'Total',
        },

        items: {
            sku: 'SKU: {{sku}}',
            qty: 'Qty: {{count}}',
            /** Unit price, e.g. "FCFA 4,500 each". */
            unitPrice: '{{price}} each',
        },

        timeline: {
            empty: 'No timeline events yet',
            loadingNote: 'Loading note…',
            addNote: 'Add Internal Note',
            notePlaceholder: 'Add a note visible only to you…',
            noteAdded: 'Note added',
            /** Actor on the optimistic entry added right after the vendor posts a note. */
            you: 'You',
        },

        payment: {
            title: 'Payment Information',
            status: 'Payment Status',
            statusShort: 'Status',
            method: 'Payment Method',
            orderType: 'Order Type',
            currency: 'Currency',
            placedAt: 'Placed At',
        },

        dispute: {
            bannerTitle: 'Payment under dispute — order frozen',
            bannerBody: "A chargeback is open on this order, so its status can't be changed until it settles.",
            bannerDisputedOn: 'Disputed on {{date}}.',
            bannerResolution: 'Resolution is automatic — no action is needed from you.',
            paymentTitle: 'Payment disputed',
            paymentBody: 'The customer opened a chargeback. The order is frozen until Stripe resolves it; if the dispute is lost the payment is refunded and the order is returned/cancelled.',
            paymentBodyOn: 'The customer opened a chargeback on {{date}}. The order is frozen until Stripe resolves it; if the dispute is lost the payment is refunded and the order is returned/cancelled.',
            paymentShortTitle: 'Payment disputed.',
            paymentShortBody: 'The order is frozen until Stripe resolves the chargeback — no action needed.',
            footerFrozen: 'Payment disputed — order frozen',
        },

        entitlements: {
            intro: 'Manage customer access to digital products. Revoking stops the customer from downloading. Restoring re-enables access (only if not expired).',
            introShort: 'Manage customer access to digital products. Revoke or restore entitlements as needed.',
            revoked: 'Revoked',
            expired: 'Expired',
            active: 'Active',
            revoke: 'Revoke',
            restore: 'Restore',
            downloadsUsed: 'Downloads Used',
            expires: 'Expires',
            lastDownload: 'Last Download',
            revokedAt: 'Revoked At',
            reason: 'Reason',

            revokeTitle: 'Revoke Entitlement',
            restoreTitle: 'Restore Entitlement',
            revokeBody: 'This will immediately stop “{{product}}” from being downloadable by the customer.',
            restoreBody: 'This will restore access to “{{product}}” so the customer can download it again.',
            revokeBodyShort: 'This will immediately stop “{{product}}” from being downloadable.',
            restoreBodyShort: 'This will restore access to “{{product}}”.',
            revokeReasonPlaceholder: 'e.g. Customer requested refund',
            restoreReasonPlaceholder: 'e.g. Issue resolved',
            revokeConfirm: 'Revoke Access',
            restoreConfirm: 'Restore Access',
            revokedToast: 'Entitlement revoked',
            restoredToast: 'Entitlement restored',
        },

        cancelDialog: {
            title: 'Cancel Order?',
            body: 'Are you sure you want to cancel order <0>{{number}}</0>? This action cannot be undone and will notify the customer.',
            bodyShort: 'Are you sure you want to cancel order <0>{{number}}</0>? This action cannot be undone.',
            /**
             * The word the vendor must type to arm the button. Translated — the
             * confirm check reads this same key, so the two never drift apart.
             */
            confirmWord: 'cancel',
            prompt: 'Please type <0>{{word}}</0> to confirm:',
            placeholder: 'Type “{{word}}”',
            keep: 'Keep Order',
            confirm: 'Yes, Cancel Order',
        },
    },

    toast: {
        statusUpdated: 'Order status updated',
        markedAs: 'Order marked as {{status}}',
        cancelled: 'Order cancelled',
        refunded: 'Refund issued',
        agencyReassigned: 'Delivery agency reassigned',
        dispatched: 'Order dispatched to the delivery agency',
    },

    errors: {
        loadFailed: "We couldn't load your orders. Please try again.",
        loadDetailFailed: "We couldn't load this order. Please try again.",
        statusUpdateFailed: "We couldn't update the order status. Please try again.",
        cancelFailed: "We couldn't cancel this order. Please try again.",
        refundFailed: "We couldn't issue the refund. Please try again.",
        dispatchFailed: "We couldn't dispatch this order. Please try again.",
        noteFailed: "We couldn't add your note. Please try again.",
    },

    /**
     * Order-timeline event lines. `services/orders.service.ts` maps each
     * `eventType` to one of these keys and the detail sheets resolve it, so the
     * timeline follows a language switch without refetching the order.
     */
    timeline: {
        orderCreated: 'Order was placed',
        paymentUpdated: 'Payment status updated',
        agencyAssigned: 'Delivery agency assigned',
        noteAdded: 'Internal note added',
        entitlementRevoked: 'Digital entitlement revoked',
        entitlementRestored: 'Digital entitlement restored',
        systemAction: 'Automated system action',
        fulfillmentChanged: 'Fulfillment status changed from “{{from}}” to “{{to}}”',
        /** Actor shown when the backend attributes an event to no one. */
        systemActor: 'System',
    },
} as const;

export default orders;
