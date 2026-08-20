import { plural } from '../../types';

/**
 * Navigation, the app shell and the quick-create menu.
 *
 * `src/config/navigation.ts` holds the route/icon structure and points at these
 * keys, so a menu label is translated in one place and stays consistent between
 * the desktop sidebar, the mobile tab bar and the "more" drawer.
 */
export const nav = {
    items: {
        overview: 'Overview',
        orders: 'Orders',
        products: 'Products',
        inventory: 'Inventory',
        bookings: 'Bookings',
        services: 'Services',
        appointments: 'Appointments',
        calendar: 'Calendar',
        media: 'Media',
        customers: 'Customers',
        transactions: 'Transactions',
        analytics: 'Analytics',
        notifications: 'Notifications',
        tickets: 'Tickets',
        agency: 'Agency',
        connection: 'Connection',
        browse: 'Browse',
        account: 'Account',
        profile: 'Profile',
        store: 'Store',
        addresses: 'Addresses',
        security: 'Security',
        billing: 'Billing',
        payout: 'Payout Setup',
        settings: 'Settings',
        policies: 'Policies',
        preferences: 'Preferences',
        more: 'More',
    },

    quickActions: {
        title: 'Create',
        addProduct: 'Add Product',
        addProductDescription: 'Create a new listing',
        createOrder: 'Create Order',
        createOrderDescription: 'Draft an order for a customer',
        addService: 'Add Service',
        addServiceDescription: 'Create a bookable service',
        newTicket: 'New Ticket',
        newTicketDescription: 'Get help from the team',
        addCustomer: 'Add Customer',
        addCustomerDescription: 'Save a new contact',
        uploadMedia: 'Upload Media',
        uploadMediaDescription: 'Add product photos or banners',
    },

    header: {
        search: 'Search…',
        searchPlaceholder: 'Search orders, products, customers…',
        searchResultsFor: 'Search results for “{{query}}”',
        recentSearches: 'Recent searches',
        /**
         * Sample rows in the global-search overlay. The overlay is not wired to
         * a real search endpoint yet; these placeholders live in the catalog so
         * no English leaks into a French dashboard in the meantime.
         */
        recentSamples: {
            order: 'Order #1001',
            orderMeta: 'Alice Johnson · 284.97',
            product: 'Wireless Bluetooth Headphones',
            productMeta: 'SKU: WBH-001 · 149.99',
            customer: 'Alice Johnson',
            store: 'Tech Gadgets Pro',
        },
        notifications: 'Notifications',
        newNotifications: plural({
            one: '{{count}} new notification',
            other: '{{count}} new notifications',
        }),
        noNewNotifications: 'No new notifications',
        markAllRead: 'Mark all read',
        viewAllNotifications: 'View all notifications',
        profile: 'Profile',
        myStore: 'My Store',
        settings: 'Settings',
        logout: 'Logout',
        logoutTitle: 'Log out?',
        logoutDescription: "You'll need to sign in again to access your dashboard.",
        vendor: 'Vendor',
        toNavigate: 'to navigate',
        toSelect: 'to select',
        toClose: 'to close',
    },

    sidebar: {
        defaultStoreName: 'My Store',
        platformStatus: 'Platform status',
        allSystemsOperational: 'All systems operational',
        collapse: 'Collapse',
        collapseSidebar: 'Collapse sidebar',
        expandSidebar: 'Expand sidebar',
        dragToResize: 'Drag to resize',
    },

    mobile: {
        more: 'More',
        quickActions: 'Quick actions',
        /**
         * The Android hardware back button asks once before it quits, at the
         * root of the stack (CAPACITOR-PLAN.md → P3.1). Never shown on the web.
         */
        exitConfirm: 'Press back again to exit',
    },

    platformStatus: {
        online: 'All systems operational',
        degraded: 'Degraded performance',
        offline: 'Offline',
        /**
         * The second half of the offline banner, shown from `sm` up. The label
         * alone states a fact; this says what it means for the vendor.
         */
        offlineDetail: 'Some actions won’t work until the connection returns.',
    },

    login: {
        title: 'Wi-Vendor',
        description: 'Please log in via the main site to access your vendor dashboard.',
        goToLogin: 'Go to login',
    },
} as const;

export default nav;
