import { plural } from '../../types';

/** Clients : liste, fiche détaillée, étiquettes et remboursements. */
export const customers = {
    title: 'Clients',
    subtitle: 'Toutes les personnes ayant commandé dans votre boutique',

    list: {
        searchPlaceholder: 'Rechercher par nom ou e-mail…',
        filterTitle: 'Filtrer les clients',
        applyFilters: 'Afficher les clients',
        flagSection: 'Étiquette',
        allFlags: 'Toutes les étiquettes',
        noFlagsYet: 'Aucune étiquette — créez-en une depuis « Gérer les étiquettes ».',
        sortSection: 'Trier par',
        flagChip: 'Étiquette : {{value}}',
        sortChip: 'Tri : {{value}}',
        manageFlags: 'Gérer les étiquettes',
        emptyTitle: 'Aucun client',
        emptyDescription: 'Les clients apparaissent ici dès leur première commande chez vous.',
        emptyFilteredTitle: 'Aucun client correspondant',
        emptyFilteredDescription: 'Ajustez votre recherche ou le filtre d’étiquette.',
        count: plural({ one: '{{count}} client', other: '{{count}} clients' }),
    },

    sort: {
        recent: 'Commande la plus récente',
        spentDesc: 'Dépenses les plus élevées',
        spentAsc: 'Dépenses les plus faibles',
        ordersDesc: 'Plus grand nombre de commandes',
    },

    columns: {
        customer: 'Client',
        flags: 'Étiquettes',
        orders: 'Commandes',
        spent: 'Total dépensé',
        lastOrder: 'Dernière commande',
    },

    time: {
        noOrders: 'Aucune commande',
        justNow: 'à l’instant',
        minutesAgo: 'il y a {{count}} min',
        hoursAgo: 'il y a {{count}} h',
        daysAgo: 'il y a {{count}} j',
    },

    detail: {
        title: 'Client',
        editName: 'Modifier le nom affiché',
        resetToRealName: 'Rétablir « {{name}} »',
        overrideNote: 'Remplace {{name}} · vous seul voyez ce nom',
        closedName: 'Compte fermé',
        closedNote: 'Ce client a fermé son compte. Son historique de commandes est conservé, mais ses coordonnées ont été supprimées.',
        totalOrders: 'Total des commandes',
        totalSpent: 'Total dépensé',
        flags: 'Étiquettes',
        assignFlag: 'Attribuer',
        noFlagsCreated: 'Aucune étiquette créée.',
        noFlagsAssigned: 'Aucune étiquette attribuée.',
        contact: 'Contact',
        noAddress: 'Aucune adresse enregistrée',
        orders: 'Commandes',
        latestOf: 'Les {{shown}} dernières sur {{total}}',
        totalCount: '{{count}} au total',
        noOrders: 'Aucune commande trouvée pour ce client.',
        digital: 'Numérique',
        physical: 'Physique',
        refund: 'Rembourser',
    },

    paymentStatus: {
        paid: 'Payée',
        partially_refunded: 'Partiellement remboursée',
        refunded: 'Remboursée',
        pending: 'Non payée',
        authorized: 'Autorisée',
        disputed: 'Contestée',
        failed: 'Échouée',
    },

    flags: {
        title: 'Étiquettes clients',
        description: 'Des étiquettes colorées pour segmenter vos clients (ex. VIP, Nouveau).',
        editorDescription: 'Nom, couleur et description facultative.',
        newFlag: 'Nouvelle étiquette',
        editFlag: 'Modifier l’étiquette',
        removeFlag: 'Retirer l’étiquette {{name}}',
        back: 'Retour aux étiquettes',
        emptyTitle: 'Aucune étiquette',
        emptyDescription: 'Créez votre première étiquette pour commencer à regrouper vos clients.',
        editAria: 'Modifier {{name}}',
        deleteAria: 'Supprimer {{name}}',
        deleteTitle: 'Supprimer « {{name}} » ?',
        deleteDescription:
            'Cela supprime l’étiquette et la retire de tous les clients auxquels elle est ' +
            'actuellement attribuée. C’est irréversible.',
        keepFlag: 'Conserver l’étiquette',
        deleteConfirm: 'Supprimer l’étiquette',
        preview: 'Aperçu :',
        previewName: 'Nom de l’étiquette',
        name: 'Nom',
        namePlaceholder: 'ex. VIP',
        colour: 'Couleur',
        customColour: 'Couleur personnalisée',
        descriptionLabel: 'Description',
        descriptionPlaceholder: 'Facultatif — ce que signifie cette étiquette',
        create: 'Créer l’étiquette',
        duplicateName: 'Vous avez déjà une étiquette portant ce nom.',
        stale: 'Cette étiquette n’existe plus. Actualisez vos étiquettes.',
    },

    colors: {
        orange: 'Orange',
        red: 'Rouge',
        amber: 'Ambre',
        green: 'Vert',
        teal: 'Turquoise',
        blue: 'Bleu',
        indigo: 'Indigo',
        violet: 'Violet',
        pink: 'Rose',
        slate: 'Ardoise',
    },

    refund: {
        title: 'Rembourser {{order}}',
        fallbackOrder: 'la commande',
        description:
            'Les remboursements sont traités en direct par la passerelle de paiement et sont irréversibles.',
        notRefundable: 'Cette commande ne peut pas être remboursée',
        notEligible: 'Elle n’est pas éligible à un remboursement pour le moment.',
        maxRefundable: 'Remboursement maximum',
        remaining: 'Solde restant',
        settlesIn: 'Le remboursement est réglé sous ~{{days}} jours.',
        returnShipping: 'Frais de retour à la charge de {{payer}}.',
        amount: 'Montant ({{currency}})',
        amountHelp:
            'Vous pouvez rembourser jusqu’à {{max}}. Réduisez ce montant pour un remboursement partiel.',
        reason: 'Motif (facultatif)',
        reasonPlaceholder:
            'Transmis à la passerelle de paiement et conservé sur le remboursement.',
        submit: 'Rembourser',
        submitAmount: 'Rembourser {{amount}}',
        fullyRefunded: 'Commande intégralement remboursée',
        partiallyRefunded: 'Remboursement partiel effectué',
    },

    returnPayer: {
        vendor: 'Vous (vendeur)',
        customer: 'Client',
        customer_reimbursed_if_defect: 'Client (remboursé si défectueux)',
    },

    refundReason: {
        REFUND_POLICY_DISABLED: 'Votre politique de retour désactive les remboursements.',
        REFUND_ORDER_NOT_PAID:
            'Cette commande n’a pas été payée, il n’y a donc rien à rembourser.',
        REFUND_PAYMENT_NOT_FOUND: 'Aucun paiement réussi n’est lié à cette commande.',
        REFUND_ALREADY_FULLY_REFUNDED: 'Cette commande a déjà été intégralement remboursée.',
        REFUND_WINDOW_EXPIRED: 'Le délai de retour de cette commande a expiré.',
        REFUND_NOT_ELIGIBLE:
            'Votre politique ramène à zéro le montant remboursable pour cette commande.',
    },

    validation: {
        nameRequired: 'Le nom est obligatoire',
        nameMax: 'Le nom doit contenir au plus 60 caractères',
        descriptionMax: 'La description doit contenir au plus 200 caractères',
        hexColor: 'Saisissez une couleur hexadécimale, par exemple #FF8800',
    },

    toast: {
        flagCreated: 'Étiquette créée',
        flagUpdated: 'Étiquette mise à jour',
        flagDeleted: 'Étiquette supprimée',
        nameUpdated: 'Nom affiché mis à jour',
        nameReset: 'Nom affiché rétabli au nom réel',
    },

    errors: {
        loadFailed: "Nous n'avons pas pu charger vos clients. Réessayez.",
        loadDetailFailed: "Nous n'avons pas pu charger ce client. Réessayez.",
        loadOrdersFailed: "Nous n'avons pas pu charger les commandes de ce client. Réessayez.",
        saveFlagFailed: "Nous n'avons pas pu enregistrer cette étiquette. Réessayez.",
        deleteFlagFailed: "Nous n'avons pas pu supprimer cette étiquette. Réessayez.",
        updateFlagsFailed: "Nous n'avons pas pu mettre à jour les étiquettes de ce client. Réessayez.",
        updateNameFailed: "Nous n'avons pas pu mettre à jour le nom affiché. Réessayez.",
        resetNameFailed: "Nous n'avons pas pu rétablir le nom affiché. Réessayez.",
        eligibilityFailed:
            "Nous n'avons pas pu vérifier si cette commande est remboursable. Réessayez.",
        refundFailed: "Nous n'avons pas pu effectuer le remboursement. Réessayez.",
    },
};

export default customers;
