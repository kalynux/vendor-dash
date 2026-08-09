import { plural } from '../../types';

/** Inventory: low-stock alerts, reservations, stock history, bulk CSV updates. */
export const inventory = {
    title: 'Inventory',
    subtitle: 'Monitor low stock, active reservations, and stock history for your physical products.',

    stats: {
        lowStockVariants: 'Low-stock variants',
        unitsReserved: 'Units reserved',
        totalUnits: 'Units in stock',
        outOfStock: 'Out of stock',
        awaitingApproval: 'Awaiting your approval',
    },

    /**
     * The four sub-tabs. Each is a real route and a sidebar child, so these keys
     * label the menu entry, the mobile pill and the page header — one string, so
     * the three can never disagree.
     */
    tabs: {
        alerts: 'Alerts',
        reservations: 'Reservations',
        history: 'History',
        requests: 'Stock requests',
    },

    /** One line under the "Inventory › <tab>" header, describing *that* sub-tab. */
    tabSubtitles: {
        alerts: 'Variants sitting at or below their low-stock threshold.',
        reservations: 'Units currently locked by open checkouts and orders.',
        history: 'Every recorded stock movement, and what caused it.',
        requests: 'Quantity changes on warehoused SKUs, waiting on a second signature.',
    },

    columns: {
        product: 'Product',
        sku: 'SKU',
        available: 'Available',
        inStock: 'In stock',
        reserved: 'Reserved',
        threshold: 'Threshold',
        expiresAt: 'Expires',
        quantity: 'Quantity',
        quantityLocked: 'Qty locked',
        change: 'Change',
        beforeAfter: 'Before → After',
        reason: 'Reason',
        timestamp: 'When',
        status: 'Status',
        action: 'Action',
    },

    empty: {
        alerts: "No low-stock variants. You're all stocked up.",
        reservations: 'No active reservations right now.',
        history: 'No stock changes recorded yet.',
    },

    /** Reservation lifecycle, as returned by the API. */
    reservationStatus: {
        active: 'Active',
        released: 'Released',
        committed: 'Committed',
        expired: 'Expired',
    },

    /** What caused a stock-history entry. */
    operation: {
        order: 'order',
        reservation: 'reservation',
        release: 'release',
        bulk: 'bulk',
        manual: 'manual',
        adjustment: 'adjustment',
    },

    adjust: {
        action: 'Adjust',
        title: 'Adjust stock',
        description: 'Set the absolute stock level for <0>{{sku}}</0> ({{product}}).',
        currentStock: 'Current stock',
        reserved: 'Reserved',
        newLevel: 'New stock level (absolute)',
        newLevelHint: 'This sets the total quantity — it is not added to the current stock.',
        wholeNumber: 'Enter a whole number.',
        updated: 'Stock updated for {{sku}} ({{count}} variant updated).',
        /** An agency warehouses this SKU, so the change was proposed, not written. */
        queued: '{{sku}}: {{from}} → {{to}} sent to the storage agency for approval. Nothing has changed yet.',
        hasOpenRequest:
            'A stock request is already open on this SKU. Resolve it before proposing another quantity.',
        viewRequest: 'View request',
    },

    bulk: {
        title: 'Import stock from CSV',
        importCsv: 'Import CSV',
        description:
            'Upload a CSV with exactly two columns — <0>variantId</0> and <1>quantity</1> — to set absolute stock levels in one atomic batch.',
        requiredFormat: 'Required format',
        limits: 'Max 5MB · up to 1,000 rows · quantities are absolute (they replace current stock, not added to it).',
        chooseFile: 'Choose file',
        noFileSelected: 'No file selected',
        notCsv: 'Please choose a .csv file.',
        tooLarge: 'That file is larger than the 5MB limit.',
        upload: 'Upload',
        imported: plural({
            one: '{{count}} variant updated from {{name}}.',
            other: '{{count}} variants updated from {{name}}.',
        }),
        rowsFailed: plural({
            one: '{{count}} row failed — no stock was changed.',
            other: '{{count}} rows failed — no stock was changed.',
        }),
        rowLabel: 'Row {{row}}',
        /** Shown when a row's failure code isn't in the shared error catalog. */
        rowUnknownError: 'This row could not be imported.',
        fixAndRetry: 'Fix the rows above and upload again — the batch is applied all-or-nothing.',
        rowsReady: plural({ one: '{{count}} row ready', other: '{{count}} rows ready' }),
        applyUpdate: 'Apply update',

        /**
         * The three groups a bulk update comes back in. `updated` counts only the
         * rows that were WRITTEN — a `requested` row has not changed yet, and
         * calling it updated is the one way to make the response lie.
         */
        result: {
            title: 'Import result',
            updated: plural({ one: '{{count}} SKU updated', other: '{{count}} SKUs updated' }),
            requested: plural({
                one: '{{count}} SKU awaiting the agency’s approval',
                other: '{{count}} SKUs awaiting the agency’s approval',
            }),
            requestedHint:
                'An agency warehouses these, so their quantities need its countersignature. Nothing has changed for them yet.',
            notRequested: plural({ one: '{{count}} SKU not applied', other: '{{count}} SKUs not applied' }),
            notRequestedHint:
                'These could neither be updated nor proposed. Resolve the open request on each, then import again.',
            goToRequests: 'Go to stock requests',
            done: 'Done',
        },
    },

    /** Shared "this quantity is proposed, not written" badge wording. */
    pending: {
        badge: '{{from}} → {{to}} · pending',
        requestedTo: '→ {{to}}',
        awaitingApproval: 'Awaiting the storage agency’s approval',
    },

    /**
     * The stock-request inbox. Changing the recorded stock of a product a
     * delivery agency warehouses needs both signatures — one side proposes, the
     * other approves. See api-doc/vendor/stock-requests.md.
     */
    requests: {
        status: {
            pending: 'Pending',
            approved: 'Approved',
            rejected: 'Rejected',
            withdrawn: 'Withdrawn',
        },

        direction: {
            awaiting_me: 'Awaiting you',
            raised_by_me: 'Raised by you',
        },

        filters: {
            status: 'Status',
            anyStatus: 'Any status',
            direction: 'Whose turn',
            bothDirections: 'Both',
            variant: 'SKU: {{sku}}',
        },

        /**
         * Search is client-side — the endpoint takes no `q` and rejects unknown
         * query parameters — so it only covers the page in hand. `searchPartial`
         * says so out loud whenever there is more than one page.
         */
        searchPlaceholder: 'Search by SKU or product…',
        searchPartial: 'Searching this page only — page {{page}} of {{total}}.',
        filterTitle: 'Filter stock requests',

        columns: {
            sku: 'SKU',
            change: 'Change',
            raisedBy: 'Raised by',
            status: 'Status',
            when: 'Raised',
            actions: 'Actions',
        },

        /** `quantityBefore → requestedQuantity`, plus the drift line when they moved. */
        change: '{{from}} → {{to}}',
        driftNow: 'now {{current}}',
        driftHint:
            'The quantity moved after this was proposed. Approving still sets the requested figure.',
        unlimitedBefore: 'unlimited',
        unknownSku: 'Variant {{id}}',

        raisedByYou: 'You',
        raisedByAgency: 'The agency',
        raisedByNamedAgency: '{{name}}',

        actions: {
            approve: 'Approve',
            reject: 'Reject',
            withdraw: 'Withdraw',
            confirmReject: 'Reject request',
            confirmWithdraw: 'Withdraw request',
            reasonPlaceholder: 'Why are you rejecting this? (optional, shown to the agency)',
            withdrawHint: 'This retracts your proposal. The agency is not notified.',
        },

        detail: {
            title: 'Stock request',
            quantities: 'Quantities',
            quantityBefore: 'When proposed',
            currentQuantity: 'Now on record',
            requestedQuantity: 'Requested',
            note: 'Note from the proposer',
            history: 'History',
            approvedAt: 'Approved {{date}}',
            approvedApplied: 'Applied over a recorded quantity of {{quantity}}.',
            rejectedAt: 'Rejected {{date}}',
            rejectionReason: 'Reason: {{reason}}',
            withdrawnAt: 'Withdrawn {{date}}',
            noActions: 'This request is resolved — there is nothing left to do.',
            viewProduct: 'Open product',
            skuHistory: 'This SKU’s history',
            loadFailed: "We couldn't load that stock request.",
        },

        raise: {
            action: 'Propose a change',
            title: 'Propose a stock change',
            description:
                'The agency that warehouses this product has to approve the new quantity before it takes effect.',
            product: 'Product',
            productPlaceholder: 'Choose a warehoused product',
            variant: 'Variant',
            variantPlaceholder: 'Choose a variant',
            quantity: 'New quantity (absolute)',
            quantityHint: 'This is the total the SKU should read — not an amount to add. 0 is valid.',
            wholeNumber: 'Enter a whole number of 0 or more.',
            note: 'Note for the agency',
            notePlaceholder: 'e.g. Sold 30 through another channel',
            noteHint: 'Optional, but it is what the agency reads when deciding.',
            submit: 'Send request',
            openExisting: 'Open that request',
        },

        toast: {
            raised: 'Request sent — the agency will be notified.',
            approved: 'Approved. The stock is now {{quantity}}.',
            rejected: 'Request rejected. Nothing was changed.',
            withdrawn: 'Request withdrawn.',
        },

        empty: {
            none: 'No stock requests yet.',
            noneHint:
                'These appear when you or a storage agency proposes a quantity change on a warehoused product.',
            filtered: 'No stock requests match these filters.',
            searched: 'No stock requests on this page match your search.',
        },

        errors: {
            loadFailed: "We couldn't load your stock requests. Please try again.",
            actionFailed: "We couldn't complete that action. Please try again.",
            raiseFailed: "We couldn't send that request. Please try again.",
        },
    },

    pagination: {
        summary: 'Page {{page}} of {{total}} · {{count}} total',
        prev: 'Prev',
        next: 'Next',
    },

    toast: {
        stockUpdated: 'Stock updated',
        bulkApplied: plural({
            one: 'Stock updated on {{count}} variant',
            other: 'Stock updated on {{count}} variants',
        }),
    },

    errors: {
        loadFailed: "We couldn't load your inventory. Please try again.",
        loadAlertsFailed: "We couldn't load your stock alerts. Please try again.",
        loadReservationsFailed: "We couldn't load your reservations. Please try again.",
        loadHistoryFailed: "We couldn't load your stock history. Please try again.",
        updateFailed: "We couldn't update the stock. Please try again.",
        csvInvalid: "We couldn't read that CSV file. Check the columns and try again.",
    },
} as const;

export default inventory;
