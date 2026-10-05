/** Transactions : le fil d’activité unifié (argent + crédits). */
export const transactions = {
    title: 'Transactions',
    subtitle: 'Tous les paiements, remboursements et versements de votre compte',

    searchPlaceholder: 'Rechercher une transaction…',
    filterTitle: 'Filtrer les transactions',
    applyFilters: 'Afficher les transactions',
    categorySection: 'Catégorie',
    allActivity: 'Toute l’activité',
    searchPartial: 'Recherche sur cette page uniquement — page {{page}} sur {{total}}.',

    empty: {
        none: 'Aucune transaction pour le moment.',
        filtered: 'Aucune transaction ne correspond à votre recherche.',
    },

    columns: {
        activity: 'Activité',
        date: 'Date',
        amount: 'Montant',
        status: 'Statut',
    },

    tabs: {
        all: 'Tout',
        plan: 'Formules',
        credit: 'Crédits',
        earning: 'Gains',
        payout: 'Versements',
    },

    category: {
        plan: 'Formule',
        credit: 'Crédit',
        earning: 'Gain',
        payout: 'Versement',
    },

    status: {
        pending: 'En attente',
        paid: 'Payée',
        failed: 'Échouée',
        reversed: 'Annulée',
        completed: 'Terminée',
        hold: 'En attente de libération',
        release: 'Libérée',
        reversal: 'Annulée',
        reserve_hold: 'Vers la réserve',
        reserve_release: 'De la réserve',
        clawback: 'Reprise',
        clawback_recovery: 'Imputé',
        clawback_write_off: 'Annulée',
    },

    typeLabel: {
        earning_clawback: 'Repris pour un remboursement',
        earning_clawback_recovery: 'Imputé sur la somme que vous devez',
        earning_clawback_write_off: 'Dette annulée par Wi-Mall',
    },

    amount: {
        money: '{{sign}}{{amount}}',
        credits: '{{sign}}{{amount}} cr',
    },

    via: 'via {{gateway}}',
    reversalNote: 'Rétrofacturation / remboursement — ce débit a été annulé.',

    errors: {
        loadFailed: "Nous n'avons pas pu charger vos transactions. Réessayez.",
    },
};

export default transactions;
