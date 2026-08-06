import { plural } from '../../types';

/** Page d'accueil du tableau de bord. */
export const overview = {
    title: 'Vue d’ensemble',
    subtitle: 'Bon retour ! Voici ce qui se passe dans votre boutique.',
    welcomeBack: 'Bon retour',
    myStore: 'Ma boutique',

    notReady: {
        short: 'Les statistiques de cette période ne sont pas encore prêtes. Revenez bientôt.',
        long: 'Les statistiques de cette période ne sont pas encore prêtes. Les données sont agrégées quotidiennement — revenez bientôt.',
    },

    metrics: {
        totalSales: 'Ventes totales',
        totalOrders: 'Commandes totales',
        netRevenue: 'Revenu net',
        averageOrderValue: 'Panier moyen',
        orders: 'Commandes',
        averageOrderShort: 'Panier moyen',
        netRevenueShort: 'Revenu net',
        totalSalesForRange: 'Ventes totales · {{range}}',
        vsLastPeriod: 'vs période précédente',
    },

    charts: {
        salesTitle: 'Performance des ventes',
        salesDescription: 'Évolution quotidienne des ventes et des commandes',
        legendSales: 'Ventes',
        legendOrders: 'Commandes',
        topProductsTitle: 'Meilleurs produits',
        topProductsDescription: 'Meilleures ventes en chiffre d’affaires sur la période',
        topProductsShort: 'Meilleurs produits',
    },

    topProducts: {
        empty: 'Aucune vente de produit sur cette période.',
        sold: plural({ one: '{{count}} vendu', other: '{{count}} vendus' }),
    },

    recentOrders: {
        title: 'Commandes récentes',
        titleShort: 'Commandes récentes',
        description: 'Les dernières commandes de vos clients',
        itemCount: plural({ one: '{{count}} article', other: '{{count}} articles' }),
    },

    quickActions: {
        title: 'Actions rapides',
        description: 'Les tâches courantes de votre boutique',
        addProduct: 'Ajouter un produit',
        addProductDescription: 'Créer une nouvelle fiche',
        processRefund: 'Traiter un remboursement',
        processRefundDescription: 'Gérer les retours',
        abandonedCarts: 'Paniers abandonnés',
        abandonedCartsDescription: '{{count}} à traiter',
        viewReports: 'Voir les rapports',
        viewReportsDescription: 'Statistiques et analyses',
    },

    lowStock: {
        title: 'Stock faible',
        description: 'Variantes au niveau du seuil ou en dessous',
        empty: 'Toutes les variantes sont au-dessus de leur seuil de stock.',
        outOfStock: 'Rupture de stock',
        unitsLeft: '{{count}} restant(s)',
        manageInventory: 'Gérer le stock',
    },
};

export default overview;
