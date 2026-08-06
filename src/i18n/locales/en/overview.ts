import { plural } from '../../types';

/** The dashboard landing page — KPI cards, charts, recent orders, low stock. */
export const overview = {
    title: 'Overview',
    subtitle: "Welcome back! Here's what's happening with your store.",
    welcomeBack: 'Welcome back',
    myStore: 'My Store',

    notReady: {
        short: "Analytics for this period aren't ready yet. Please check back shortly.",
        long: "Analytics for this period aren't ready yet. Data is aggregated daily — please check back shortly.",
    },

    metrics: {
        totalSales: 'Total Sales',
        totalOrders: 'Total Orders',
        netRevenue: 'Net Revenue',
        averageOrderValue: 'Average Order Value',
        orders: 'Orders',
        averageOrderShort: 'Avg. order',
        netRevenueShort: 'Net revenue',
        totalSalesForRange: 'Total sales · {{range}}',
        vsLastPeriod: 'vs last period',
    },

    charts: {
        salesTitle: 'Sales Performance',
        salesDescription: 'Daily sales and order trends',
        legendSales: 'Sales',
        legendOrders: 'Orders',
        topProductsTitle: 'Top Products',
        topProductsDescription: 'Best sellers by revenue this period',
        topProductsShort: 'Top products',
    },

    topProducts: {
        empty: 'No product sales in this period.',
        sold: plural({ one: '{{count}} sold', other: '{{count}} sold' }),
    },

    recentOrders: {
        title: 'Recent Orders',
        titleShort: 'Recent orders',
        description: 'Latest orders from your customers',
        itemCount: plural({ one: '{{count}} item', other: '{{count}} items' }),
    },

    quickActions: {
        title: 'Quick Actions',
        description: 'Common tasks you might want to perform',
        addProduct: 'Add Product',
        addProductDescription: 'Create new listing',
        processRefund: 'Process Refund',
        processRefundDescription: 'Handle returns',
        abandonedCarts: 'Abandoned Carts',
        abandonedCartsDescription: '{{count}} need attention',
        viewReports: 'View Reports',
        viewReportsDescription: 'Analytics & insights',
    },

    lowStock: {
        title: 'Low Stock',
        description: 'Variants at or below their threshold',
        empty: 'All variants are above their stock thresholds.',
        outOfStock: 'Out of stock',
        unitsLeft: '{{count}} left',
        manageInventory: 'Manage inventory',
    },
} as const;

export default overview;
