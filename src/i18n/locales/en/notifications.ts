import { plural } from '../../types';

/** The notifications inbox, plus per-channel notification settings. */
export const notifications = {
    title: 'Notifications',
    subtitle: 'Everything that happened while you were away',

    stats: {
        unread: 'Unread',
        total: 'Total',
    },

    /** Relative timestamps on notification rows (header dropdown + page). */
    time: {
        justNow: 'just now',
        minutesAgo: '{{count}}m ago',
        hoursAgo: '{{count}}h ago',
        daysAgo: '{{count}}d ago',
    },

    tabs: {
        all: 'All',
        unread: 'Unread',
        read: 'Read',
    },

    empty: {
        all: 'No notifications yet',
        unread: 'All caught up!',
        read: 'No read notifications',
    },

    actions: {
        markAllRead: 'Mark all as read',
        markRead: 'Mark as read',
    },

    toast: {
        allMarkedRead: 'All notifications marked as read',
    },

    errors: {
        loadFailed: 'Could not load notifications.',
        markReadFailed: 'Could not mark as read.',
        markAllReadFailed: 'Could not mark all as read.',
    },

    /** Settings → Notifications: which events reach you on which channel. */
    settings: {
        title: 'Notifications',
        info: 'Choose how each kind of update reaches you. A channel has to be verified before it can be switched on.',
        channels: {
            email: 'Email',
            whatsapp: 'WhatsApp',
            telegram: 'Telegram',
            push: 'Push',
            inApp: 'In-app',
        },
        verified: 'Verified',
        notVerified: 'Not verified',
        setUp: 'Set up',
        verify: 'Verify',
        disconnect: 'Disconnect',
        linkExpires: 'Link expires at {{time}}.',
        channelNotVerified: 'Verify this channel before turning on notifications for it.',
        groups: {
            orders: 'Orders',
            payments: 'Payments & payouts',
            inventory: 'Inventory',
            bookings: 'Bookings',
            support: 'Support',
            account: 'Account & security',
        },
        saved: 'Notification settings saved',
        enabledCount: plural({
            one: '{{count}} notification enabled',
            other: '{{count}} notifications enabled',
        }),

        loadFailed: 'Could not load notification settings.',
        disconnected: '{{channel}} disconnected',

        /** The opt-in banner for browser push on this device. */
        push: {
            bannerLabel: 'Enable push notifications on this device',
            title: 'Turn on push notifications',
            description:
                'Tap to get real-time alerts on this device, even when the dashboard is in the background.',
            blocked:
                'Notifications are blocked — allow them for this site in your browser settings, then tap here.',
            dismiss: 'Dismiss',
            enabled: 'Push notifications enabled on this device',
            blockedToast:
                'Push is blocked. Enable notifications for this site in your browser settings.',
            enableFailed: 'Could not enable push on this device.',
        },

        /** The "where do notifications land" card. */
        delivery: {
            title: 'Delivery channel',
            info: "Where your notifications land. In-app is always on and can't be turned off. On top of that you may pick one extra channel — connect it first, then make it active. Only one extra channel at a time.",
            inApp: 'In-app',
            alwaysOn: 'Always on',
            inAppHint: "Every notification lands in the bell menu. This can't be turned off.",
            groupLabel: 'Extra delivery channel',
            connected: 'Connected',
            notConnected: 'Not connected',
            connect: 'Connect',
            makeActive: 'Make {{channel}} your active extra channel',
            turnOff: '{{channel}} is your active extra channel — turn it off',
            active: 'Active',
            use: 'Use',
            connectToUse: 'Connect this channel to use it.',
            alsoGoHere: 'Notifications also go here.',
            tapUse: 'Tap “Use” to send notifications here.',
        },

        /** The per-event switches. */
        events: {
            title: 'Events',
            info: 'Which events reach you. Turning one off silences it on every channel, including in-app.',
            about: 'About {{event}}',
            orderCreated: 'New order',
            orderCreatedHint: 'When a new order is received',
            orderCancelled: 'Order cancelled',
            orderCancelledHint: 'When an order is cancelled',
            bookingCreated: 'New booking',
            bookingCreatedHint: 'When a new service booking is received',
            bookingCancelled: 'Booking cancelled',
            bookingCancelledHint: 'When a service booking is cancelled',
            paymentReceivedPartial: 'Partial payment',
            paymentReceivedPartialHint: 'When a partial payment is received',
            paymentReceivedFull: 'Full payment',
            paymentReceivedFullHint: 'When a payment is completed in full',
            storageAlert: 'Storage alert',
            storageAlertHint: 'When media storage crosses 80% / 90% / 100%',
            connectionUpdated: 'Agency connections',
            connectionUpdatedHint:
                'When an agency request, approval, rejection, or re-approval happens',
            payoutUpdates: 'Payout updates',
            payoutUpdatesHint: 'When your payout request is created, paid, or rejected',
            shipmentRejected: 'Shipment rejected',
            shipmentRejectedHint:
                'When a delivery agency declines a shipment and its items need rerouting',
            planUpdates: 'Plan updates',
            planUpdatesHint: 'When your subscription plan is nearing expiry or has expired',
        },

        /** The connect-a-channel dialog. */
        setup: {
            connectTitle: 'Connect {{channel}}',
            connectedTitle: '{{channel}} connected',
            connectDescription:
                'Link your {{channel}} to receive notifications there. This is a one-time setup.',
            connectedDescription:
                'Your {{channel}} is verified. You can now enable it as your delivery channel.',
            allSet: 'All set — close this and choose {{channel}} as your channel.',
            preparing: 'Preparing…',
            emailStep1: 'We sent a verification link to <0>{{email}}</0>.',
            emailFallback: 'your email',
            emailStep2: 'Open the email and click the link to verify, then refresh below.',
            resendEmail: 'Resend email',
            telegramStep1: 'Open our Telegram bot and press <0>Start</0>.',
            openTelegram: 'Open Telegram',
            linkExpires: 'Link expires {{time}}.',
            telegramStep2: 'Once the bot confirms, refresh below.',
            whatsappStep1: 'Open WhatsApp and send the pre-filled command to our bot.',
            openWhatsapp: 'Open WhatsApp',
            copyCommand: 'Copy command',
            whatsappStep2: 'After the bot replies, refresh below.',
            checkAgain: "I've done this — check",
            notVerifiedYet: 'Not verified yet — finish the steps, then check again.',
        },
    },
} as const;

export default notifications;
