import { plural } from '../../types';

/** Analytics page: charts, snapshots, top products. */
export const analytics = {
    title: 'Analytics',
    subtitle: 'How your store is performing over the selected period',

    headerSubtitle: 'Track your store performance and insights',
    export: 'Export',
    /** The Export button's spreadsheet. */
    exportFile: {
        fileName: 'analytics',
        figure: 'Figure',
        value: 'Value',
        change: 'Change vs previous period',
        date: 'Date',
        sku: 'SKU',
        quantity: 'Quantity sold',
        orders: 'Orders',
        revenue: 'Revenue',
        exporting: 'Exporting…',
        done: 'Report exported',
        failed: 'Could not export the report. Try again.',
    },

    /** The money summary: gross sales, each deduction, then what reached your earnings. */
    earnings: {
        title: 'Earnings',
        description: 'What your sales brought in this period, after fees',
        grossSales: 'Gross sales',
        bargainFee: 'Bargain fee',
        commission: 'Commission',
        deliveryFee: 'Delivery fee',
        codFee: 'Cash-on-delivery fee',
        deliveryAndCodFees: 'Delivery + cash-on-delivery fees',
        netRevenue: 'Net revenue',
        netRevenueHint:
            'What your sales added to your earnings: gross sales, minus the bargain fee, the commission, the delivery fee and the cash-on-delivery fee.',
        bookings: 'Bookings, after commission',
        deliveryFeesReturned: 'Delivery fees given back',
        earningsReversed: 'Earnings taken back',
        netEarnings: 'Net earnings',
        netEarningsHint:
            'Everything this period added to your earnings: net revenue, bookings and delivery fees given back, minus earnings taken back (for example after a refund).',
        refunds: 'Refunds paid to customers',
        refundsCount: plural({ one: '{{count}} refund', other: '{{count}} refunds' }),
        refundsNote: 'Already counted in “Earnings taken back”.',
    },

    tabs: {
        overview: 'Overview',
        sales: 'Sales',
        products: 'Products',
        customers: 'Customers',
    },

    products: {
        title: 'Top Products',
        description: 'Ranked by revenue, with units sold',
    },

    customers: {
        totalTitle: 'Total Customers',
        totalDescription: 'Unique buyers with paid orders',
        repeatTitle: 'Repeat Customers',
        repeatDescription: 'Buyers with 2+ completed orders',
        repeatRateTitle: 'Repeat Rate',
        repeatRateDescription: 'Share of repeat customers',
    },

    charts: {
        legendSales: 'Sales',
        legendOrders: 'Orders',
        salesTitle: 'Sales Performance',
        salesDescription: 'Daily sales and order trends',
        salesAnalyticsTitle: 'Sales Analytics',
        salesAnalyticsDescription: 'Daily sales breakdown for the selected period',
        topProductsTitle: 'Top Products',
        topProductsDescription: 'Best performing products this period',
        snapshotTitle: 'Store Snapshot',
        snapshotDescription: 'Customers & bookings this period',
    },

    snapshot: {
        customers: 'Customers',
        repeatCustomers: 'Repeat customers',
        repeatRate: 'Repeat rate',
        newCustomers: 'New customers',
        bookings: 'Bookings',
        bookingRevenue: 'Booking revenue',
        conversionRate: 'Conversion rate',
    },

    empty: {
        noData: 'No data for this period yet.',
        noProducts: 'No product sales in this period.',
    },

    errors: {
        loadFailed: "We couldn't load your analytics. Please try again.",
        invalidRange: 'That date range is not valid. The end date has to come after the start date.',
    },
} as const;

export default analytics;
