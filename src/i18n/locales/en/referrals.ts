import { plural } from '../../types';

/**
 * Account → Referrals (api-doc/FRONTEND-CHANGELOG-referrals.md).
 *
 * ⛔ No rate, duration, wait or minimum is ever written here: each one comes from
 * the server and arrives as a `{{placeholder}}`. Wi-Mall can change them all.
 */
export default {
    rules: {
        fromCommission: 'Your reward comes out of Wi-Mall’s commission.',
        who: 'Vendors, customers and agencies earn you rewards.',
        limited: 'Each person earns you rewards for a limited time from the day they sign up.',
        earned: 'A reward counts once Wi-Mall has received its commission on the order.',
        wait: plural({
            one: 'You can withdraw a reward {{count}} day after that.',
            other: 'You can withdraw a reward {{count}} days after that.',
        }),
        refunds:
            'If an order is refunded after you’ve already withdrawn its reward, you may owe that amount back. Your next rewards pay it off automatically.',
        /** <0> = the amount, in bold. */
        minimum: 'The minimum withdrawal is <0>{{amount}}</0>.',
    },

    intro: {
        title: 'Earn by inviting people to Wi-Mall',
        lead: 'Share your link. When someone signs up through it, you earn a percentage of the commission Wi-Mall makes on orders they take part in.',
    },

    closed: {
        title: 'The referral program isn’t open',
        body: 'You can’t apply right now.',
    },

    apply: {
        reapplyTitle: 'Apply again',
        /** <0> = the Partner Terms link. */
        termsLabel: 'I accept the <0>Partner Terms</0>.',
        motivationLabel: 'Anything you’d like us to know? (optional)',
        motivationPlaceholder: 'For example, the shops or people you could invite',
        submit: 'Send my application',
        submitting: 'Sending…',
        sent: 'Application sent.',
        failed: 'We couldn’t send your application. Please try again.',
    },

    status: {
        pending: {
            title: 'We’re reviewing your application',
            body: 'You applied on {{date}}. We’ll let you know when there is a decision, and this page will show it.',
        },
        rejected: {
            title: 'Your application wasn’t accepted',
            canApply: 'You can apply again below.',
        },
        suspended: {
            title: 'Your partnership is suspended',
            body: 'Your link earns nothing for now. People who use it sign up normally, and you aren’t credited.',
        },
        terminated: {
            title: 'Your partnership has ended',
            body: 'Your link no longer earns anything. People who use it sign up normally, and you aren’t credited.',
        },
        unknown: {
            title: 'Your partnership is being updated',
        },
        frozen: 'Your balance is frozen, so you can’t withdraw it for now.',
        released: 'You can still withdraw your balance.',
        paused: {
            title: 'The program is paused',
            body: 'New sign-ups and new orders earn nothing for now. What you have already earned stays yours.',
        },
    },

    share: {
        title: 'Your referral code',
        inactive: 'This code and link earn nothing right now. People who use them sign up normally.',
        copyCode: 'Copy code',
        copyLink: 'Copy {{name}}',
        shareLink: 'Share {{name}}',
        shareMessage: 'Join Wi-Mall with my link:',
        shareFailed: 'We couldn’t open sharing on this device. Copy the link instead.',
        register: {
            name: 'Sign-up link',
            hint: 'For vendors, agencies, delivery agents, and customers on the website',
        },
        whatsapp: {
            name: 'WhatsApp link',
            hint: 'For people who shop through WhatsApp',
        },
        telegram: {
            name: 'Telegram link',
            hint: 'For people who shop through Telegram',
        },
    },

    terms: {
        title: 'What you earn',
        line: plural({
            one: '{{rate}}% of Wi-Mall’s commission for {{count}} month',
            other: '{{rate}}% of Wi-Mall’s commission for {{count}} months',
        }),
    },

    /** Singular: one referred account, or one row of the rates. */
    category: {
        vendor: 'Vendor',
        customer: 'Customer',
        agency: 'Agency',
        agent: 'Delivery agent',
        other: 'Account',
    },

    balance: {
        title: 'Referral balance',
        /** ⚠ Must stay visible: this is not the shop's earnings. */
        separate: 'Separate from your shop earnings, with its own withdrawal and its own minimum.',
        available: 'Available',
        pending: 'Waiting',
        pendingHint: plural({
            one: 'Can be withdrawn {{count}} day after it is earned',
            other: 'Can be withdrawn {{count}} days after it is earned',
        }),
        requested: 'Being withdrawn',
        clawback: 'You owe',
        clawbackNote:
            'A refund left you owing this. Later rewards pay it first, and you can’t withdraw until it is cleared.',
        withdraw: 'Withdraw {{amount}}',
        withdrawHint: 'Your whole available balance is sent.',
        withdrawn: 'Withdrawal requested. An administrator will handle it.',
        withdrawFailed: 'We couldn’t request your withdrawal. Please try again.',
        hint: {
            frozen: 'Your balance is frozen, so withdrawals are off for now.',
            requested: 'Your withdrawal is being handled.',
            noDestination: 'Add a payout method to withdraw.',
            belowMinimum: 'You can withdraw once you have at least {{amount}}.',
        },
    },

    destination: {
        title: 'Paid to',
        change: 'Change it on the Payout page',
        none: 'You have no payout method yet.',
        add: 'Add a payout method',
        /** The method lives on another role of the same person, in another app. */
        agency: 'Saved on your agency account. Change it there.',
        agent: 'Saved on your delivery agent account. Change it there.',
    },

    referred: {
        title: 'People you referred',
        info: 'Everyone who signed up with your code. Names are partly hidden on purpose, and orders are never shown.',
        empty: 'Nobody has signed up with your code yet.',
        summary: plural({
            one: '{{count}} account, {{earning}} still earning',
            other: '{{count}} accounts, {{earning}} still earning',
        }),
        signedUp: 'Signed up {{date}}',
        earningUntil: 'Earning until {{date}}',
        endsOn: 'Referral period ends {{date}}',
        ended: 'Ended on {{date}}',
        neverEarns: 'An agent’s own deliveries earn nothing',
    },

    rewards: {
        title: 'Rewards',
        info: 'What each referred account has earned you, as it stands today after any refund.',
        empty: 'You have no rewards yet.',
        earned: 'Earned {{date}}',
        adjusted: 'Reduced by a refund',
        status: {
            held: 'Can be withdrawn from {{date}}',
            released: 'Released',
            reversed: 'Fully refunded',
            unknown: 'Being processed',
        },
    },

    payouts: {
        title: 'Withdrawals',
        info: 'Withdrawals from your referral balance only. Your shop earnings have their own list on the Payout page.',
        empty: 'You haven’t made a withdrawal yet.',
        requested: 'Requested {{date}}',
    },

    loadFailed: 'We couldn’t load your referral page. Check your connection and try again.',
} as const;
