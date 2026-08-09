/** Voir `../en/payments.ts` — les noms de marque ne sont jamais traduits. */
export const payments = {
    category: {
        card: {
            title: 'Paiement par carte',
            provider: 'Sécurisé par Stripe',
        },
        mobileMoney: {
            title: 'Mobile Money',
            payFrom: 'Validez depuis votre téléphone',
        },
    },

    brands: {
        otherCard: 'Autre carte',
    },

    providers: {
        label: 'Opérateur',
        placeholder: 'Choisissez un opérateur',
        legend: 'Opérateur mobile money',
        soon: 'Bientôt',
        soonHint: '{{brand}} n’est pas encore débitable.',
        soonNote: '{{brands}} peuvent recevoir vos versements, mais ne sont pas encore débitables.',
    },
};

export default payments;
