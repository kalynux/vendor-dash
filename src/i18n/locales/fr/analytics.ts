/** Statistiques : graphiques, aperçu de la boutique, meilleurs produits. */
export const analytics = {
    title: 'Statistiques',
    subtitle: 'Les performances de votre boutique sur la période sélectionnée',

    headerSubtitle: 'Suivez les performances et les tendances de votre boutique',
    export: 'Exporter',

    notReady: 'Vos chiffres pour cette période ne sont pas encore prêts. Les données sont agrégées quotidiennement — revenez bientôt.',

    tabs: {
        overview: 'Vue d’ensemble',
        sales: 'Ventes',
        products: 'Produits',
        customers: 'Clients',
    },

    products: {
        title: 'Meilleurs produits',
        description: 'Classés par chiffre d’affaires, avec les unités vendues',
    },

    customers: {
        totalTitle: 'Total des clients',
        totalDescription: 'Acheteurs uniques avec des commandes payées',
        repeatTitle: 'Clients fidèles',
        repeatDescription: 'Acheteurs ayant 2 commandes terminées ou plus',
        repeatRateTitle: 'Taux de fidélité',
        repeatRateDescription: 'Part des clients fidèles',
    },

    charts: {
        legendSales: 'Ventes',
        legendOrders: 'Commandes',
        salesTitle: 'Performance des ventes',
        salesDescription: 'Évolution quotidienne des ventes et des commandes',
        salesAnalyticsTitle: 'Analyse des ventes',
        salesAnalyticsDescription: 'Détail quotidien des ventes sur la période sélectionnée',
        topProductsTitle: 'Meilleurs produits',
        topProductsDescription: 'Produits les plus performants sur la période',
        snapshotTitle: 'Aperçu de la boutique',
        snapshotDescription: 'Clients et réservations sur la période',
    },

    snapshot: {
        customers: 'Clients',
        repeatCustomers: 'Clients fidèles',
        repeatRate: 'Taux de fidélité',
        newCustomers: 'Nouveaux clients',
        bookings: 'Réservations',
        bookingRevenue: 'Revenu des réservations',
        conversionRate: 'Taux de conversion',
    },

    empty: {
        noData: 'Aucune donnée pour cette période.',
        noProducts: 'Aucune vente de produit sur cette période.',
    },

    errors: {
        loadFailed: "Nous n'avons pas pu charger vos statistiques. Réessayez.",
        invalidRange: "Cette période n'est pas valide. La date de fin doit suivre la date de début.",
    },
};

export default analytics;
