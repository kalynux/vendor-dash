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

    export: {
        exporting: 'Export en cours…',
        done: plural({ one: '{{count}} commande exportée', other: '{{count}} commandes exportées' }),
        empty: 'Aucune commande à exporter avec ces filtres.',
        failed: 'Impossible d’exporter les commandes. Réessayez.',
        fileName: 'commandes',
        columns: {
            orderNumber: 'N° de commande',
            date: 'Date',
            customer: 'Client',
            email: 'E-mail',
            type: 'Type',
            status: 'Statut',
            paymentStatus: 'Statut du paiement',
            paymentMethod: 'Mode de paiement',
            items: 'Articles',
            subtotal: 'Sous-total',
            shipping: 'Livraison',
            tax: 'Taxe',
            total: 'Total',
            currency: 'Devise',
        },
    },

    print: {
        product: 'Produit',
        quantity: 'Qté',
        unitPrice: 'Prix unitaire',
        amount: 'Montant',
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
            paidNotice: plural({
                one: '{{count}} commande sélectionnée a déjà été payée. L’annuler ne rembourse pas le client automatiquement : notre équipe s’occupera du remboursement, et vos gains sur cette commande seront suspendus jusqu’à ce que ce soit réglé.',
                other: '{{count}} commandes sélectionnées ont déjà été payées. Les annuler ne rembourse pas les clients automatiquement : notre équipe s’occupera des remboursements, et vos gains sur ces commandes seront suspendus jusqu’à ce que chacun soit réglé.',
            }),
            paidNoticeUnknown:
                'Si l’une de ces commandes a déjà été payée, l’annuler ne rembourse pas le client automatiquement : notre équipe s’occupera du remboursement, et vos gains sur cette commande seront suspendus jusqu’à ce que ce soit réglé.',
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
            /** Affiché à la place de l’action Rembourser lorsque le serveur la refuse. `reason` vient de customers.refundReason.*. */
            refundUnavailable: 'Remboursement impossible — {{reason}}',
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
            paidNotice:
                'Cette commande a été payée. L’annuler ne rembourse pas le client automatiquement : notre équipe s’occupera du remboursement, et vos gains sur cette commande seront suspendus jusqu’à ce que ce soit réglé.',
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

    review: {
        action: 'Noter la livraison',
        reviewed: 'Notée',
        title: 'Noter cette livraison',
        subtitleBoth: 'Effectuée par {{agent}}, de {{agency}}.',
        subtitleAgency: 'Effectuée par {{agency}}.',
        subtitleGeneric: "Dites-nous comment s'est passée cette livraison.",
        checking: 'Vérification de cette livraison…',
        checkFailed:
            "Nous n'avons pas pu vérifier cette livraison pour le moment. Fermez cette fenêtre et réessayez.",

        ratingLabel: 'Votre note',
        ratingHelp: "D'une à cinq étoiles. Une note seule est publiée immédiatement.",
        starsAria: plural({ one: '{{count}} étoile', other: '{{count}} étoiles' }),

        addComment: 'Ajouter un commentaire',
        removeComment: 'Retirer le commentaire',
        titleLabel: 'Titre (facultatif)',
        titlePlaceholder: 'Résumez en quelques mots',
        bodyLabel: 'Commentaire (facultatif)',
        bodyPlaceholder: "Qu'est-ce qui s'est bien passé, ou aurait pu mieux se passer ?",

        moderationNotice:
            "Les commentaires sont vérifiés par un modérateur avant d'apparaître. Votre note seule serait publiée immédiatement.",
        writeOnceNotice: 'Une note ne peut plus être modifiée ni retirée une fois envoyée.',

        submit: 'Envoyer la note',
        submittedPublished: 'Merci — votre note est en ligne.',
        submittedPending:
            'Merci — votre avis a été envoyé et apparaîtra une fois vérifié.',
        submitFailed: "Nous n'avons pas pu envoyer votre note. Réessayez.",

        blocked: {
            notDelivered:
                "Cette livraison n'est pas encore terminée. Vous pourrez la noter une fois qu'elle aura été livrée.",
            noAgent: "Aucun livreur n'est affecté à cette livraison, il n'y a donc personne à noter.",
            notAllowed: "Ce n'est pas quelque chose que vous pouvez noter.",
            alreadyReviewed: 'Vous avez déjà noté cette livraison.',
            generic: 'Cette livraison ne peut pas être notée.',
        },
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

    codLimit: {
        title: {
            agency_limit: 'Cette agence a atteint sa limite de paiement à la livraison',
            vendor_terms: 'Vos propres conditions de paiement à la livraison plafonnent cette agence',
            unknown: 'Cette remise dépasse une limite de paiement à la livraison',
        },
        body: 'L’agence détient déjà {{current}}. Cette commande ajoute {{added}}, ce qui dépasserait {{limit}}.',
        bodyMove: 'Cette agence détient déjà {{current}}. Cet article ajoute {{added}}, ce qui dépasserait {{limit}}.',
        forceNote: 'Nous noterons que vous avez expédié au-delà de la limite.',
        forceNoteMove: 'Nous noterons que vous l’avez déplacé au-delà de la limite.',
        dispatchAnyway: 'Expédier quand même',
        moveAnyway: 'Déplacer quand même',
        chooseAnotherAgency: 'Choisir une autre agence',
        openCodTerms: 'Modifier mes conditions',
        heldBadge: 'Bloquée — limite espèces',
        hold: {
            agency_limit: 'Non envoyé à l’agence : elle a atteint sa limite de paiement à la livraison.',
            vendor_terms: 'Non envoyé à l’agence : vos propres conditions plafonnent cette agence.',
            unknown: 'Non envoyé à l’agence : une limite de paiement à la livraison serait dépassée.',
        },
        holdNumbers: 'L’agence détient {{current}}, ce colis ajoute {{added}}, la limite est de {{limit}}.',
        holdNoRetry: 'Il n’est pas relancé automatiquement. Expédiez-le quand vous êtes prêt.',
        forced: 'Expédié au-delà de la limite le {{date}}',
        bulkFailed: plural({
            one: '{{count}} commande dépasse une limite de paiement à la livraison et n’a pas été expédiée.',
            other: '{{count}} commandes dépassent une limite de paiement à la livraison et n’ont pas été expédiées.',
        }),
        bulkRetry: plural({ one: 'L’expédier quand même', other: 'Expédier ces {{count}} quand même' }),
    },

    deliveryMoney: {
        customerPaidLabel: 'Livraison payée par le client',
        cashToRider: 'En espèces au livreur',
        freeForCustomer: 'Offerte',
        youPay: 'Livraison offerte — vous payez {{amount}}',
        youPayUnpriced: 'Livraison offerte — vous payez les frais de livraison',
        youPayPart: 'Vous payez aussi {{amount}} de la livraison',
        reason: {
            shop_threshold_met: 'Le client a atteint votre montant de livraison offerte.',
            threshold_not_met: 'En dessous de votre montant de livraison offerte : le client a payé.',
            cap_fallback: 'Commande trop petite pour supporter les frais de livraison : le client les a payés.',
        },
        shipmentFee: 'Frais de livraison {{amount}}',
        shipmentCustomer: 'payés par le client',
        shipmentYou: 'payés par vous',
        shipmentSplit: 'le client a payé {{customer}}, vous payez {{you}}',
        tagFree: 'Livraison offerte',
        tagCustomer: 'Livraison payée par le client',
    },

    feeProposals: {
        title: 'Changements de frais de livraison',
        fromAgency: 'De {{agency}}',
        fromAgent: 'D’un livreur de {{agency}}',
        fromChangeAgency: 'Vous avez confié ce colis à {{agency}}',
        fromCombined: 'Prix de livraison groupée de {{agency}}',
        unknownAgency: 'l’agence de livraison',
        blocksPickup: 'Le colis ne peut pas être récupéré tant que vous n’avez pas répondu.',
        blocksPickupCustomer: 'Le colis ne peut pas être récupéré tant que le client n’a pas répondu.',
        customerAnswers: 'Le client paie la livraison de ce colis : c’est donc lui qui répond à ce changement.',
        changeAgencyExplainer: 'La nouvelle société coûte plus cher. On demande au client de payer la différence. S’il refuse, c’est vous qui la payez.',
        changedHighlight: 'L’agence a modifié ces frais. Vérifiez le nouveau montant.',
        edits: plural({ one: 'Modifié {{count}} fois', other: 'Modifié {{count}} fois' }),
        status: {
            pending: 'En attente de vous',
            waitingCustomer: 'En attente du client',
            waitingCustomerPayment: 'En attente du paiement du client',
            coveredByYou: 'Vous avez payé la différence',
            customerDeclined: 'Refusé par le client — vous payez la différence',
            approved: 'Accepté',
            rejected: 'Refusé',
            withdrawn: 'Retiré',
            unknown: 'Clos',
        },
        withdrawn: {
            shipment_declined: 'Retiré — l’agence a refusé la livraison',
            agent_detached: 'Retiré — le livreur a quitté la course',
            other: 'Retiré',
        },
        rejectionNote: 'Votre note : {{note}}',
        customerNote: 'Note du client : {{note}}',
        youPayMore: 'Vous payez {{amount}} de plus pour la livraison de cette commande.',
        answeredOn: 'Répondu le {{date}}',
        earnings: 'Vos gains sur cette commande : {{before}} → {{after}}',
        approve: 'Accepter',
        reject: 'Refuser',
        cover: 'Payer la différence',
        coverDialog: {
            title: 'Payer la différence vous-même ?',
            body: 'La nouvelle société de livraison reçoit son prix et le client ne paie rien de plus. La différence est retirée de vos gains sur cette commande.',
        },
        approveDialog: {
            title: 'Accepter les nouveaux frais de livraison ?',
            earningsDown: 'Vos gains sur cette commande baissent de {{amount}}.',
            earningsUp: 'Vos gains sur cette commande augmentent de {{amount}}.',
            onlineNote: 'La commande est déjà payée : vos gains en attente changent tout de suite.',
            codNote: 'C’est un paiement à la livraison : les nouveaux frais s’appliquent à l’encaissement.',
        },
        rejectDialog: {
            title: 'Garder les frais d’origine ?',
            body: 'L’agence peut faire une dernière proposition, ou refuser cette livraison.',
            noteLabel: 'Note pour l’agence (facultatif)',
            notePlaceholder: 'Pourquoi vous gardez les frais d’origine',
        },
        toast: {
            approved: 'Nouveaux frais de livraison acceptés',
            rejected: 'Changement de frais refusé',
            covered: 'Vous payez la différence de livraison',
        },
        banner: plural({
            one: '{{count}} changement de frais vous attend',
            other: '{{count}} changements de frais vous attendent',
        }),
        bannerAction: 'Ouvrir',
        rowBadge: 'Frais modifiés',
    },
};

export default orders;
