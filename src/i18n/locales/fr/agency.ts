import { plural } from '../../types';

/** Agences de livraison : vos connexions et la recherche de nouvelles agences. */
export const agency = {
    title: 'Agence',
    subtitle: 'Les agences de livraison qui acheminent vos commandes',

    tabSubtitles: {
        connections: 'Les agences de livraison avec lesquelles vous travaillez, et celle par défaut',
        browse: 'Trouvez de nouvelles agences de livraison à qui vous connecter',
    },

    tabs: {
        connections: 'Connexion',
        browse: 'Parcourir',
    },

    page: {
        currentDefault: 'Agence par défaut actuelle',
        noDefault:
            'Aucune agence de livraison définie. Votre première connexion approuvée devient ' +
            'automatiquement l’agence par défaut — les vendeurs de services peuvent laisser ce champ vide.',
        connectionsTitle: 'Vos connexions',
        connectionsHint:
            'Votre première connexion active devient l’agence par défaut automatiquement — ' +
            'changez-la à tout moment avec « Définir par défaut » ci-dessous.',
        browseTitle: 'Rechercher une agence et demander une connexion',
    },

    connections: {
        searchPlaceholder: 'Rechercher une connexion…',
        filterTitle: 'Filtrer les connexions',
        loading: 'Chargement des connexions…',
        emptyCategory: 'Aucune connexion dans cette catégorie.',
        notePlaceholder: 'Note (facultatif)',
        reasonPlaceholder: 'Motif (facultatif)',
        awaitingAgency: 'En attente de l’agence',
        chipHistory: 'Historique',
        statusChip: 'Statut : {{value}}',
        applyLabel: 'Afficher les connexions',
        unnamedAgency: 'Agence {{ref}}',

        actions: {
            default: 'Par défaut',
            setAsDefault: 'Définir par défaut',
            terminate: 'Résilier',
            confirmTerminate: 'Confirmer la résiliation',
            reject: 'Refuser',
            confirmReject: 'Confirmer le refus',
            withdraw: 'Retirer',
            approve: 'Approuver',
            reapprove: 'Réapprouver',
            requestAgain: 'Redemander',
        },
    },

    status: {
        pending: 'En attente',
        active: 'Active',
        paused: 'En pause',
        rejected: 'Refusée',
        disconnected: 'Déconnectée',
        withdrawn: 'Retirée',
        terminated: 'Résiliée',
        reapprovalNeeded: 'Réapprobation requise',
        awaitingTheirApproval: 'En attente de leur approbation',
        awaitingYourApproval: 'En attente de votre approbation',
    },

    browse: {
        title: 'Parcourir les agences',
        description: 'Trouvez une agence de livraison qui couvre les zones où vous vendez.',
        searchPlaceholder: 'Rechercher une agence…',
        filterTitle: 'Filtrer les agences',
        clearAllFilters: 'Effacer tous les filtres',
        rejectTitle: 'Refuser cette demande ?',
        reasonPlaceholder: 'Motif (facultatif)',
        awaitingAgency: 'En attente de l’agence',
        empty: 'Aucune agence ne correspond à votre recherche.',
        request: 'Demander une connexion',
        requested: 'Demande envoyée',
        connected: 'Connectée',
        applyLabel: 'Afficher les agences',
        emptyFiltered: 'Aucune agence ne correspond à votre recherche ou à vos filtres.',
        emptyNone: 'Aucune agence de livraison n’est encore disponible dans votre zone.',
        viewDetailsFor: 'Voir les détails de {{name}}',
    },

    filters: {
        location: 'Localisation',
        region: 'Région',
        regionPlaceholder: 'ex. Littoral',
        city: 'Ville',
        cityPlaceholder: 'ex. Douala',
        capabilities: 'Capacités',
        returnsPayer: 'Retours à la charge de',
        anyPayer: 'Tous',
        claimWindow: 'Délai de réclamation',
        minClaimDays: 'Nombre de jours minimum pour réclamer',
        claimDaysPlaceholder: 'ex. 7',
    },

    payerShort: {
        vendor: 'Vendeur',
        agency: 'Agence',
        customer: 'Client',
    },

    detail: {
        kycVerified: 'KYC vérifié',
        unverified: 'Non vérifiée',
        headquarters: 'Siège',
        coverageAreas: 'Zones de couverture',
        pricing: 'Tarification',
        storageBased: 'Basée sur le stockage',
        pickupBased: 'Basée sur l’enlèvement',
        available: 'Disponible',
        notAvailable: 'Non disponible',
        returns: 'Retours',
        costPaidBy: 'Frais à la charge de',
        returnWindow: 'Délai de retour',
        noReturns: 'Aucun retour accepté',
        returnWindowDays: '{{count}} jours après la livraison',
        damageClaims: 'Réclamations pour dommages',
        claimDeadline: 'Délai de réclamation',
        claimDeadlineDays: '{{count}} jours après la livraison',
        maxRefundPerItem: 'Remboursement max. par article',
        coverage: 'Couverture',
        contact: 'Contact',
        policies: 'Politiques',
        rates: 'Tarifs',
        supportsCod: 'Paiement à la livraison',
        noCoverage: 'Aucune zone de couverture renseignée.',
    },

    returnsPayer: {
        vendor: 'Frais à la charge du vendeur',
        agency: 'Frais à la charge de l’agence',
        customer: 'Frais à la charge du client',
    },

    reassign: {
        trigger: 'Réattribuer',
        title: 'Confier à une autre agence',
        loading: 'Chargement des agences…',
        placeholder: 'Sélectionnez une agence',
        updated: 'Agence de livraison mise à jour',
        declinedTitle: 'Expédition refusée par l’agence',
        declinedHint: 'Réattribuez cet article à une autre agence pour continuer.',
        declinedReason: 'Motif :',
        declinedNote: 'Note :',
        declinedOn: 'Refusée le {{date}}',
    },

    rejectionReason: {
        out_of_coverage_area: 'Hors zone de couverture',
        capacity_exceeded: 'Capacité de l’agence dépassée',
        invalid_address: 'Adresse de livraison invalide',
        vendor_item_not_ready: 'Article non prêt pour l’enlèvement',
        other: 'Autre motif',
        unknown: 'Refusée par l’agence',
    },

    toast: {
        requestSent: 'Demande de connexion envoyée',
        connected: 'Connecté à {{name}}',
        disconnected: 'Déconnecté de {{name}}',
        paused: 'Connexion mise en pause',
        resumed: 'Connexion reprise',
        defaultSet: 'Agence de livraison par défaut mise à jour',
        itemsReassigned: plural({
            one: '{{count}} article de commande a été réattribué à la nouvelle agence',
            other: '{{count}} articles de commande ont été réattribués à la nouvelle agence',
        }),
    },

    errors: {
        loadFailed: "Nous n'avons pas pu charger les agences de livraison. Réessayez.",
        loadConnectionsFailed: "Nous n'avons pas pu charger vos connexions. Réessayez.",
        requestFailed: "Nous n'avons pas pu envoyer la demande de connexion. Réessayez.",
        updateFailed: "Nous n'avons pas pu mettre à jour cette connexion. Réessayez.",
    },
};

export default agency;
