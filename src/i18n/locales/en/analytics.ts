/** Analytics page: charts, snapshots, top products. */
export const analytics = {
    title: 'Analytics',
    subtitle: 'How your store is performing over the selected period',

    headerSubtitle: 'Track your store performance and insights',
    export: 'Export',

    notReady: "Your figures for this period aren't ready yet. Data is aggregated daily — please check back shortly.",

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
