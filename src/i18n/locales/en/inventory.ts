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
    },

    tabs: {
        alerts: 'Alerts',
        reservations: 'Reservations',
        history: 'History',
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
