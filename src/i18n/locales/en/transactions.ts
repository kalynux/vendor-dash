/** Transactions: the unified money + credit activity feed. */
export const transactions = {
    title: 'Transactions',
    subtitle: 'Every payment, refund and payout on your account',

    searchPlaceholder: 'Search transactions…',
    filterTitle: 'Filter transactions',
    applyFilters: 'Show transactions',
    categorySection: 'Category',
    allActivity: 'All activity',
    /** The endpoint has no search param, so matching only covers the loaded page. */
    searchPartial: 'Searching this page only — page {{page}} of {{total}}.',

    empty: {
        none: 'No transactions yet.',
        filtered: 'No transactions match your search.',
    },

    columns: {
        activity: 'Activity',
        date: 'Date',
        amount: 'Amount',
        status: 'Status',
    },

    /** Sub-tab / filter labels. */
    tabs: {
        all: 'All',
        plan: 'Plans',
        credit: 'Credits',
        earning: 'Earnings',
        payout: 'Payouts',
    },

    category: {
        plan: 'Plan',
        credit: 'Credit',
        earning: 'Earning',
        payout: 'Payout',
    },

    status: {
        pending: 'Pending',
        paid: 'Paid',
        failed: 'Failed',
        reversed: 'Reversed',
        completed: 'Completed',
        hold: 'On hold',
        release: 'Released',
        reversal: 'Reversed',
        reserve_hold: 'To reserve',
        reserve_release: 'From reserve',
        clawback: 'Taken back',
        clawback_recovery: 'Applied',
        clawback_write_off: 'Cancelled',
    },

    /** Refund-debt rows (2026-10-05) — the server's English description is replaced. */
    typeLabel: {
        earning_clawback: 'Recovered for a refund',
        earning_clawback_recovery: 'Applied to money you owe',
        earning_clawback_write_off: 'Debt cancelled by Wi-Mall',
    },

    /** Signed amounts. `sign` is prepended by the caller. */
    amount: {
        money: '{{sign}}{{amount}}',
        credits: '{{sign}}{{amount}} cr',
    },

    via: 'via {{gateway}}',
    reversalNote: 'Chargeback/refund — this charge was unwound.',

    errors: {
        loadFailed: "We couldn't load your transactions. Please try again.",
    },
} as const;

export default transactions;
