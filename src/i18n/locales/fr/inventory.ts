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
    },

    tabs: {
        alerts: 'Alertes',
        reservations: 'Réservations',
        history: 'Historique',
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
