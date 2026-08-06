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

    /** Sub-tab / filter labels. `payout` is a category but has no tab yet. */
    tabs: {
        all: 'All',
        plan: 'Plans',
        credit: 'Credits',
        earning: 'Earnings',
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
