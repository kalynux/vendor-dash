import { plural } from '../../types';

/** Liste des commandes, filtres, actions groupées et détail de commande. */
export const orders = {
    title: 'Commandes',
    subtitle: 'Gérez et suivez les commandes de vos clients',

    empty: {
        title: 'Aucune commande trouvée',
        description: 'Les commandes passées dans votre boutique apparaîtront ici.',
        filtered: 'Aucune commande ne correspond à vos filtres.',
    },

    columns: {
        order: 'Commande',
        customer: 'Client',
        date: 'Date',
        items: 'Articles',
        total: 'Total',
        status: 'Statut',
        payment: 'Paiement',
        delivery: 'Livraison',
        actions: 'Actions',
    },

    status: {
        pending: 'En attente',
        processing: 'En préparation',
        partiallyShipped: 'Partiellement expédiée',
        shipped: 'Expédiée',
        partiallyDelivered: 'Partiellement livrée',
        delivered: 'Livrée',
        fulfilled: 'Honorée',
        cancelled: 'Annulée',
        returned: 'Retournée',
    },

    paymentStatus: {
        pending: 'En attente',
        awaitingPayment: 'Paiement attendu',
        partiallyPaid: 'Partiellement payée',
        paid: 'Payée',
        disputed: 'En litige',
        failed: 'Échouée',
        refunded: 'Remboursée',
        partiallyRefunded: 'Partiellement remboursée',
    },

    deliveryStatus: {
        pending: 'En attente',
        assigned: 'Assignée',
        pickedUp: 'Récupérée',
        inTransit: 'En transit',
        agentDelivered: 'Livrée par l’agent',
        delivered: 'Livrée',
        failed: 'Échouée',
        returned: 'Retournée',
        rejected: 'Refusée',
        pendingAgencyReassignment: 'Changement d’agence requis',
    },

    paymentMethod: {
        online: 'En ligne',
        cashOnDelivery: 'Paiement à la livraison',
        cashOnDeliveryShort: 'PAL',
    },

    orderType: {
        physical: 'Physique',
        digital: 'Numérique',
    },

    statusActions: {
        pending: 'Marquer en attente',
        processing: 'Marquer en préparation',
        cancelled: 'Annuler la commande',
    },

    bulk: {
        selected: plural({
            one: '{{count}} commande sélectionnée',
            other: '{{count}} commandes sélectionnées',
        }),
        noCommonAction: 'Aucune action commune disponible pour cette sélection.',
        clearSelection: 'Effacer la sélection',
        actionsLabel: 'Actions groupées',
        dispatch: 'Transmettre',
        overLimit: 'Sélectionnez au maximum {{max}} commandes pour une action groupée',
        statusUpdated: plural({
            one: '{{count}} commande mise à jour',
            other: '{{count}} commandes mises à jour',
        }),
        dispatched: plural({
            one: '{{count}} commande transmise',
            other: '{{count}} commandes transmises',
        }),
        failedWithReason: plural({
            one: '{{count}} commande en échec : {{reason}}',
            other: '{{count}} commandes en échec : {{reason}}',
        }),
        failedMixed: plural({
            one: "{{count}} commande n'a pas pu être mise à jour — consultez-la pour le détail.",
            other: "{{count}} commandes n'ont pas pu être mises à jour — consultez chaque commande pour le détail.",
        }),
    },

    list: {
        export: 'Exporter',
        unknownCustomer: 'Client inconnu',
        createOrder: 'Créer une commande',
        createOrderLabel: 'Créer une commande',
        orderActions: 'Actions de la commande',
        selectAll: 'Tout sélectionner',
        detailsTitle: 'Détails de la commande',
        noStatusChanges: 'Aucun changement de statut possible.',
        frozenAction: 'Gelée — paiement contesté',
        frozenNotice: 'Paiement contesté — cette commande est gelée jusqu’au dénouement.',
        showing: 'Affichage de {{shown}} sur {{items}}',
        showingCount: 'Affichage de {{items}}',

        filters: {
            title: 'Filtrer les commandes',
            apply: 'Voir les commandes',
            searchPlaceholder: 'Rechercher par numéro de commande…',
            open: 'Filtrer les commandes',
            orderStatus: 'Statut de la commande',
            paymentStatus: 'Statut du paiement',
            paymentMethod: 'Moyen de paiement',
            orderType: 'Type de commande',
            orderDate: 'Date de la commande',
            anyStatus: 'Tous les statuts',
            any: 'Tous',
            chipStatus: 'Statut : {{value}}',
            chipPayment: 'Paiement : {{value}}',
            chipMethod: 'Moyen : {{value}}',
            chipType: 'Type : {{value}}',
            chipDate: 'Date : {{value}}',
            chipCustomer: 'Client : {{value}}',
        },

        bulkCancelDialog: {
            title: plural({
                one: 'Annuler {{count}} commande ?',
                other: 'Annuler {{count}} commandes ?',
            }),
            body: plural({
                one: 'Voulez-vous vraiment annuler <0>{{count}} commande sélectionnée</0> ? Cette action est irréversible et le client en sera informé.',
                other: 'Voulez-vous vraiment annuler <0>{{count}} commandes sélectionnées</0> ? Cette action est irréversible et chaque client en sera informé.',
            }),
            keep: 'Garder les commandes',
            confirm: plural({
                one: 'Oui, annuler {{count}} commande',
                other: 'Oui, annuler {{count}} commandes',
            }),
        },
    },

    actions: {
        viewDetails: 'Voir les détails',
        markAsShipped: 'Marquer comme expédiée',
        markAsDelivered: 'Marquer comme livrée',
        cancelOrder: 'Annuler la commande',
        refund: 'Rembourser',
        reassignAgency: 'Changer d’agence',
        printInvoice: 'Imprimer la facture',
        contactCustomer: 'Contacter le client',
        updateStatus: 'Mettre à jour le statut',
        dispatchToAgency: 'Transmettre à l’agence',
    },

    detail: {
        title: 'Commande {{number}}',
        itemCount: plural({ one: '{{count}} article', other: '{{count}} articles' }),
        placedOn: 'Passée le {{date}}',
        noFurtherActions: 'Commande {{status}} — aucune action possible',

        tabs: {
            details: 'Détails',
            items: 'Articles',
            itemsWithCount: 'Articles ({{count}})',
            timeline: 'Chronologie',
            payment: 'Paiement',
            access: 'Accès',
            accessWithCount: 'Accès ({{count}})',
        },

        customer: {
            title: 'Client',
            infoTitle: 'Informations client',
            orderCount: 'Commandes (chez vous)',
            totalSpent: 'Dépensé (chez vous)',
            totalSpentLong: 'Total dépensé',
            addToCustomers: 'Ajouter aux clients',
        },

        shipping: {
            addressTitle: 'Adresse de livraison',
            noAddress: 'Aucune adresse enregistrée',
            deliveryMethodTitle: 'Mode de livraison',
            digitalDelivery: 'Livraison numérique',
            digitalDeliveryNote: 'Les liens de téléchargement et les identifiants seront envoyés à l’adresse e-mail enregistrée du client.',
            digitalDeliveryNoteShort: 'Liens de téléchargement envoyés à l’e-mail du client',
            shipmentsTitle: 'Expéditions',
            shipmentsTitleWithCount: 'Expéditions ({{count}} agences)',
            agency: 'Agence',
            noAgency: 'Aucune agence assignée',
            assignedAgent: 'Agent assigné',
            agent: 'Agent : {{name}}',
            tracking: 'Suivi : {{number}}',
            freeDelivery: 'Livraison offerte',
            deliveryTimeline: 'Chronologie de livraison',
        },

        summary: {
            title: 'Récapitulatif de la commande',
            subtotal: 'Sous-total',
            tax: 'Taxe',
            shipping: 'Livraison',
            free: 'Offerte',
            discount: 'Remise',
            total: 'Total',
        },

        items: {
            sku: 'SKU : {{sku}}',
            qty: 'Qté : {{count}}',
            unitPrice: '{{price}} l’unité',
        },

        timeline: {
            empty: 'Aucun événement pour l’instant',
            loadingNote: 'Chargement de la note…',
            addNote: 'Ajouter une note interne',
            notePlaceholder: 'Ajoutez une note visible par vous seul…',
            noteAdded: 'Note ajoutée',
            you: 'Vous',
        },

        payment: {
            title: 'Informations de paiement',
            status: 'Statut du paiement',
            statusShort: 'Statut',
            method: 'Moyen de paiement',
            orderType: 'Type de commande',
            currency: 'Devise',
            placedAt: 'Passée le',
        },

        dispute: {
            bannerTitle: 'Paiement contesté — commande gelée',
            bannerBody: 'Une contestation de paiement est ouverte sur cette commande : son statut ne peut pas changer avant son dénouement.',
            bannerDisputedOn: 'Contestée le {{date}}.',
            bannerResolution: 'La résolution est automatique — aucune action de votre part n’est nécessaire.',
            paymentTitle: 'Paiement contesté',
            paymentBody: 'Le client a ouvert une contestation de paiement. La commande est gelée jusqu’à ce que Stripe la tranche ; si la contestation est perdue, le paiement est remboursé et la commande est retournée/annulée.',
            paymentBodyOn: 'Le client a ouvert une contestation de paiement le {{date}}. La commande est gelée jusqu’à ce que Stripe la tranche ; si la contestation est perdue, le paiement est remboursé et la commande est retournée/annulée.',
            paymentShortTitle: 'Paiement contesté.',
            paymentShortBody: 'La commande est gelée jusqu’à ce que Stripe tranche la contestation — aucune action nécessaire.',
            footerFrozen: 'Paiement contesté — commande gelée',
        },

        entitlements: {
            intro: 'Gérez l’accès des clients aux produits numériques. Révoquer empêche le client de télécharger. Restaurer réactive l’accès (uniquement s’il n’a pas expiré).',
            introShort: 'Gérez l’accès des clients aux produits numériques. Révoquez ou restaurez les droits selon vos besoins.',
            revoked: 'Révoqué',
            expired: 'Expiré',
            active: 'Actif',
            revoke: 'Révoquer',
            restore: 'Restaurer',
            downloadsUsed: 'Téléchargements utilisés',
            expires: 'Expire le',
            lastDownload: 'Dernier téléchargement',
            revokedAt: 'Révoqué le',
            reason: 'Motif',

            revokeTitle: 'Révoquer le droit d’accès',
            restoreTitle: 'Restaurer le droit d’accès',
            revokeBody: 'Cela empêchera immédiatement le client de télécharger « {{product}} ».',
            restoreBody: 'Cela restaurera l’accès à « {{product}} » pour que le client puisse le télécharger à nouveau.',
            revokeBodyShort: 'Cela rendra immédiatement « {{product}} » non téléchargeable.',
            restoreBodyShort: 'Cela restaurera l’accès à « {{product}} ».',
            revokeReasonPlaceholder: 'ex. Remboursement demandé par le client',
            restoreReasonPlaceholder: 'ex. Problème résolu',
            revokeConfirm: 'Révoquer l’accès',
            restoreConfirm: 'Restaurer l’accès',
            revokedToast: 'Droit d’accès révoqué',
            restoredToast: 'Droit d’accès restauré',
        },

        cancelDialog: {
            title: 'Annuler la commande ?',
            body: 'Voulez-vous vraiment annuler la commande <0>{{number}}</0> ? Cette action est irréversible et le client en sera informé.',
            bodyShort: 'Voulez-vous vraiment annuler la commande <0>{{number}}</0> ? Cette action est irréversible.',
            confirmWord: 'annuler',
            prompt: 'Tapez <0>{{word}}</0> pour confirmer :',
            placeholder: 'Tapez « {{word}} »',
            keep: 'Garder la commande',
            confirm: 'Oui, annuler la commande',
        },
    },

    toast: {
        statusUpdated: 'Statut de la commande mis à jour',
        markedAs: 'Commande marquée « {{status}} »',
        cancelled: 'Commande annulée',
        refunded: 'Remboursement effectué',
        agencyReassigned: 'Agence de livraison modifiée',
        dispatched: 'Commande transmise à l’agence de livraison',
    },

    errors: {
        loadFailed: "Nous n'avons pas pu charger vos commandes. Réessayez.",
        loadDetailFailed: "Nous n'avons pas pu charger cette commande. Réessayez.",
        statusUpdateFailed: "Nous n'avons pas pu mettre à jour le statut. Réessayez.",
        cancelFailed: "Nous n'avons pas pu annuler cette commande. Réessayez.",
        refundFailed: "Nous n'avons pas pu effectuer le remboursement. Réessayez.",
        dispatchFailed: "Nous n'avons pas pu transmettre cette commande. Réessayez.",
        noteFailed: "Nous n'avons pas pu ajouter votre note. Réessayez.",
    },

    timeline: {
        orderCreated: 'Commande passée',
        paymentUpdated: 'Statut du paiement mis à jour',
        agencyAssigned: 'Agence de livraison attribuée',
        noteAdded: 'Note interne ajoutée',
        entitlementRevoked: 'Accès numérique révoqué',
        entitlementRestored: 'Accès numérique rétabli',
        systemAction: 'Action automatique du système',
        fulfillmentChanged: 'Statut de traitement modifié de « {{from}} » à « {{to}} »',
        systemActor: 'Système',
    },
};

export default orders;
