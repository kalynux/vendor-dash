import { plural } from '../../types';

/** Stock : alertes, réservations, historique, mises à jour groupées par CSV. */
export const inventory = {
    title: 'Stock',
    subtitle:
        'Suivez les stocks faibles, les réservations actives et l’historique de stock de vos produits physiques.',

    stats: {
        lowStockVariants: 'Variantes en stock faible',
        unitsReserved: 'Unités réservées',
        totalUnits: 'Unités en stock',
        outOfStock: 'En rupture',
        awaitingApproval: 'En attente de votre validation',
    },

    tabs: {
        alerts: 'Alertes',
        reservations: 'Réservations',
        history: 'Historique',
        requests: 'Demandes de stock',
        invoices: 'Factures de stockage',
    },

    tabSubtitles: {
        alerts: 'Variantes au niveau de leur seuil de stock faible, ou en dessous.',
        reservations: 'Unités actuellement bloquées par des paiements et commandes en cours.',
        history: 'Chaque mouvement de stock enregistré, et sa cause.',
        requests:
            'Modifications de quantité sur les SKU entreposés, en attente d’une seconde signature.',
        invoices: 'Loyer mensuel facturé par vos agences pour l’entreposage de votre stock.',
    },

    columns: {
        product: 'Produit',
        sku: 'SKU',
        available: 'Disponible',
        inStock: 'En stock',
        reserved: 'Réservé',
        threshold: 'Seuil',
        expiresAt: 'Expire',
        quantity: 'Quantité',
        quantityLocked: 'Qté bloquée',
        change: 'Variation',
        beforeAfter: 'Avant → Après',
        reason: 'Motif',
        timestamp: 'Quand',
        status: 'Statut',
        action: 'Action',
    },

    empty: {
        alerts: 'Aucune variante en stock faible. Tout est approvisionné.',
        reservations: 'Aucune réservation active pour le moment.',
        history: 'Aucun mouvement de stock enregistré.',
    },

    reservationStatus: {
        active: 'Active',
        released: 'Libérée',
        committed: 'Confirmée',
        expired: 'Expirée',
    },

    operation: {
        order: 'commande',
        reservation: 'réservation',
        release: 'libération',
        bulk: 'lot',
        manual: 'manuel',
        adjustment: 'ajustement',
    },

    adjust: {
        action: 'Ajuster',
        title: 'Ajuster le stock',
        description: 'Définissez le niveau de stock absolu pour <0>{{sku}}</0> ({{product}}).',
        currentStock: 'Stock actuel',
        reserved: 'Réservé',
        newLevel: 'Nouveau niveau de stock (absolu)',
        newLevelHint:
            'Cette valeur définit la quantité totale — elle ne s’ajoute pas au stock actuel.',
        wholeNumber: 'Saisissez un nombre entier.',
        updated: 'Stock mis à jour pour {{sku}} ({{count}} variante mise à jour).',
        queued:
            '{{sku}} : {{from}} → {{to}} envoyé à l’agence de stockage pour validation. Rien n’a encore changé.',
        hasOpenRequest:
            'Une demande de stock est déjà ouverte sur ce SKU. Traitez-la avant d’en proposer une autre.',
        viewRequest: 'Voir la demande',
    },

    bulk: {
        title: 'Importer le stock depuis un CSV',
        importCsv: 'Importer un CSV',
        description:
            'Téléversez un CSV comportant exactement deux colonnes — <0>variantId</0> et <1>quantity</1> — pour définir des niveaux de stock absolus en un seul lot atomique.',
        requiredFormat: 'Format requis',
        limits:
            'Max. 5 Mo · jusqu’à 1 000 lignes · les quantités sont absolues (elles remplacent le stock actuel, elles ne s’y ajoutent pas).',
        chooseFile: 'Choisir un fichier',
        noFileSelected: 'Aucun fichier sélectionné',
        notCsv: 'Veuillez choisir un fichier .csv.',
        tooLarge: 'Ce fichier dépasse la limite de 5 Mo.',
        upload: 'Téléverser',
        imported: plural({
            one: '{{count}} variante mise à jour depuis {{name}}.',
            other: '{{count}} variantes mises à jour depuis {{name}}.',
        }),
        rowsFailed: plural({
            one: '{{count}} ligne en échec — aucun stock n’a été modifié.',
            other: '{{count}} lignes en échec — aucun stock n’a été modifié.',
        }),
        rowLabel: 'Ligne {{row}}',
        rowUnknownError: 'Cette ligne n’a pas pu être importée.',
        fixAndRetry:
            'Corrigez les lignes ci-dessus et téléversez à nouveau — le lot s’applique en tout ou rien.',
        rowsReady: plural({ one: '{{count}} ligne prête', other: '{{count}} lignes prêtes' }),
        applyUpdate: 'Appliquer la mise à jour',

        result: {
            title: 'Résultat de l’import',
            updated: plural({ one: '{{count}} SKU mis à jour', other: '{{count}} SKU mis à jour' }),
            requested: plural({
                one: '{{count}} SKU en attente de validation de l’agence',
                other: '{{count}} SKU en attente de validation de l’agence',
            }),
            requestedHint:
                'Une agence les entrepose : leurs quantités nécessitent donc son contreseing. Rien n’a encore changé pour eux.',
            notRequested: plural({
                one: '{{count}} SKU non appliqué',
                other: '{{count}} SKU non appliqués',
            }),
            notRequestedHint:
                'Ceux-ci n’ont pu être ni mis à jour ni proposés. Traitez la demande ouverte sur chacun, puis réimportez.',
            goToRequests: 'Voir les demandes de stock',
            done: 'Terminé',
        },
    },

    pending: {
        badge: '{{from}} → {{to}} · en attente',
        requestedTo: '→ {{to}}',
        awaitingApproval: 'En attente de validation de l’agence de stockage',
    },

    requests: {
        status: {
            pending: 'En attente',
            approved: 'Approuvée',
            rejected: 'Refusée',
            withdrawn: 'Retirée',
        },

        direction: {
            awaiting_me: 'À traiter par vous',
            raised_by_me: 'Proposées par vous',
        },

        filters: {
            status: 'Statut',
            anyStatus: 'Tous les statuts',
            direction: 'À qui le tour',
            bothDirections: 'Les deux',
            variant: 'SKU : {{sku}}',
        },

        searchPlaceholder: 'Rechercher par SKU ou produit…',
        searchPartial: 'Recherche sur cette page uniquement — page {{page}} sur {{total}}.',
        filterTitle: 'Filtrer les demandes de stock',

        columns: {
            sku: 'SKU',
            change: 'Modification',
            raisedBy: 'Proposée par',
            status: 'Statut',
            when: 'Proposée le',
            actions: 'Actions',
        },

        change: '{{from}} → {{to}}',
        driftNow: 'actuellement {{current}}',
        driftHint:
            'La quantité a changé après cette proposition. L’approbation applique tout de même la valeur demandée.',
        unlimitedBefore: 'illimité',
        unknownSku: 'Variante {{id}}',

        raisedByYou: 'Vous',
        raisedByAgency: 'L’agence',
        raisedByNamedAgency: '{{name}}',

        actions: {
            approve: 'Approuver',
            reject: 'Refuser',
            withdraw: 'Retirer',
            confirmReject: 'Refuser la demande',
            confirmWithdraw: 'Retirer la demande',
            reasonPlaceholder: 'Pourquoi refusez-vous ? (facultatif, visible par l’agence)',
            withdrawHint: 'Ceci retire votre proposition. L’agence n’est pas notifiée.',
        },

        detail: {
            title: 'Demande de stock',
            quantities: 'Quantités',
            quantityBefore: 'À la proposition',
            currentQuantity: 'Actuellement enregistré',
            requestedQuantity: 'Demandé',
            note: 'Note de l’auteur',
            history: 'Historique',
            approvedAt: 'Approuvée le {{date}}',
            approvedApplied: 'Appliquée sur une quantité enregistrée de {{quantity}}.',
            rejectedAt: 'Refusée le {{date}}',
            rejectionReason: 'Motif : {{reason}}',
            withdrawnAt: 'Retirée le {{date}}',
            noActions: 'Cette demande est traitée — il n’y a plus rien à faire.',
            viewProduct: 'Ouvrir le produit',
            skuHistory: 'Historique de ce SKU',
            loadFailed: "Nous n'avons pas pu charger cette demande de stock.",
        },

        raise: {
            action: 'Proposer une modification',
            title: 'Proposer une modification de stock',
            description:
                'L’agence qui entrepose ce produit doit approuver la nouvelle quantité avant qu’elle ne prenne effet.',
            product: 'Produit',
            productPlaceholder: 'Choisissez un produit entreposé',
            variant: 'Variante',
            variantPlaceholder: 'Choisissez une variante',
            quantity: 'Nouvelle quantité (absolue)',
            quantityHint:
                'C’est le total que doit afficher le SKU — pas une quantité à ajouter. 0 est valide.',
            wholeNumber: 'Saisissez un nombre entier supérieur ou égal à 0.',
            note: 'Note pour l’agence',
            notePlaceholder: 'ex. 30 unités vendues via un autre canal',
            noteHint: 'Facultatif, mais c’est ce que l’agence lit pour décider.',
            submit: 'Envoyer la demande',
            openExisting: 'Ouvrir cette demande',
        },

        toast: {
            raised: 'Demande envoyée — l’agence sera notifiée.',
            approved: 'Approuvée. Le stock est désormais de {{quantity}}.',
            rejected: 'Demande refusée. Rien n’a été modifié.',
            withdrawn: 'Demande retirée.',
        },

        empty: {
            none: 'Aucune demande de stock pour le moment.',
            noneHint:
                'Elles apparaissent lorsque vous ou une agence de stockage proposez une modification de quantité sur un produit entreposé.',
            filtered: 'Aucune demande de stock ne correspond à ces filtres.',
            searched: 'Aucune demande de stock de cette page ne correspond à votre recherche.',
        },

        errors: {
            loadFailed: "Nous n'avons pas pu charger vos demandes de stock. Réessayez.",
            actionFailed: "Nous n'avons pas pu effectuer cette action. Réessayez.",
            raiseFailed: "Nous n'avons pas pu envoyer cette demande. Réessayez.",
        },
    },

    pagination: {
        summary: 'Page {{page}} sur {{total}} · {{count}} au total',
        prev: 'Préc.',
        next: 'Suiv.',
    },

    toast: {
        stockUpdated: 'Stock mis à jour',
        bulkApplied: plural({
            one: 'Stock mis à jour sur {{count}} variante',
            other: 'Stock mis à jour sur {{count}} variantes',
        }),
    },

    invoices: {
        countSummary: plural({
            one: '{{count}} facture de stockage',
            other: '{{count}} factures de stockage',
        }),
        settlementNotice:
            "Ces factures sont émises et réglées directement avec votre agence de livraison — rien n'est prélevé sur vos revenus ni sur vos versements. Contactez l'agence pour toute question sur une facture.",
        snapshotNotice:
            "Tout ce qui figure sur une facture est un instantané du jour de son émission : les noms de produits, SKU et dépôts peuvent différer d'aujourd'hui. Les quantités correspondent aux unités en rayon à ce moment précis, et non à une moyenne mensuelle.",
        filterTitle: 'Filtrer les factures',
        viewBreakdown: 'Voir le détail',
        unknownAgency: 'Agence de stockage',

        detailTitle: 'Stockage — {{period}}',
        detailTitleFallback: 'Facture de stockage',
        linesTitle: 'Ce qui vous a été facturé',
        noLines: 'Cette facture ne comporte aucune ligne.',
        issuedOn: 'Émise le {{date}}',
        settledOn: 'Marquée réglée le {{date}}',

        columns: {
            period: 'Période',
            agency: 'Agence',
            depot: 'Dépôt',
            unitsHeld: 'Unités en stock',
            charge: 'Montant',
        },

        fields: {
            status: 'Statut',
            skus: 'SKU',
            units: 'Unités',
            total: 'Total',
        },

        status: {
            open: 'Ouverte',
            settled: 'Réglée',
            void: 'Annulée',
        },

        filters: {
            status: 'Statut',
            anyStatus: 'Tous les statuts',
            period: 'Mois',
        },

        empty: {
            none: 'Aucune facture de stockage pour le moment',
            noneHint:
                'Une facture apparaît au début de chaque mois pour les agences qui entreposent votre stock et le facturent.',
            filtered: 'Aucune facture ne correspond à vos filtres.',
        },

        errors: {
            loadFailed: "Nous n'avons pas pu charger vos factures de stockage. Réessayez.",
            loadDetailFailed: "Nous n'avons pas pu charger cette facture. Réessayez.",
        },
    },

    errors: {
        loadFailed: "Nous n'avons pas pu charger votre stock. Réessayez.",
        loadAlertsFailed: "Nous n'avons pas pu charger vos alertes de stock. Réessayez.",
        loadReservationsFailed: "Nous n'avons pas pu charger vos réservations. Réessayez.",
        loadHistoryFailed: "Nous n'avons pas pu charger votre historique de stock. Réessayez.",
        updateFailed: "Nous n'avons pas pu mettre à jour le stock. Réessayez.",
        csvInvalid: "Nous n'avons pas pu lire ce fichier CSV. Vérifiez les colonnes et réessayez.",
    },
};

export default inventory;
