import { plural } from '../../types';

/** Navigation, coque de l'application et menu de création rapide. */
export const nav = {
    items: {
        overview: 'Vue d’ensemble',
        orders: 'Commandes',
        products: 'Produits',
        inventory: 'Stock',
        bookings: 'Réservations',
        services: 'Services',
        appointments: 'Rendez-vous',
        calendar: 'Agenda',
        media: 'Médias',
        customers: 'Clients',
        transactions: 'Transactions',
        analytics: 'Statistiques',
        notifications: 'Notifications',
        tickets: 'Tickets',
        agency: 'Agence',
        connection: 'Connexion',
        browse: 'Parcourir',
        account: 'Compte',
        profile: 'Profil',
        store: 'Boutique',
        addresses: 'Adresses',
        security: 'Sécurité',
        billing: 'Facturation',
        payout: 'Versements',
        settings: 'Paramètres',
        policies: 'Politiques',
        preferences: 'Préférences',
        more: 'Plus',
    },

    quickActions: {
        title: 'Créer',
        addProduct: 'Ajouter un produit',
        addProductDescription: 'Créer une nouvelle fiche',
        createOrder: 'Créer une commande',
        createOrderDescription: 'Rédiger une commande pour un client',
        addService: 'Ajouter un service',
        addServiceDescription: 'Créer un service réservable',
        newTicket: 'Nouveau ticket',
        newTicketDescription: 'Obtenir de l’aide de l’équipe',
        addCustomer: 'Ajouter un client',
        addCustomerDescription: 'Enregistrer un nouveau contact',
        uploadMedia: 'Envoyer un média',
        uploadMediaDescription: 'Ajouter des photos ou des bannières',
    },

    header: {
        search: 'Rechercher…',
        searchPlaceholder: 'Rechercher des commandes, produits, clients…',
        searchResultsFor: 'Résultats pour « {{query}} »',
        recentSearches: 'Recherches récentes',
        recentSamples: {
            order: 'Commande n° 1001',
            orderMeta: 'Alice Johnson · 284,97',
            product: 'Casque Bluetooth sans fil',
            productMeta: 'SKU : WBH-001 · 149,99',
            customer: 'Alice Johnson',
            store: 'Tech Gadgets Pro',
        },
        notifications: 'Notifications',
        newNotifications: plural({
            one: '{{count}} nouvelle notification',
            other: '{{count}} nouvelles notifications',
        }),
        noNewNotifications: 'Aucune nouvelle notification',
        markAllRead: 'Tout marquer comme lu',
        viewAllNotifications: 'Voir toutes les notifications',
        profile: 'Profil',
        myStore: 'Ma boutique',
        settings: 'Paramètres',
        logout: 'Déconnexion',
        logoutTitle: 'Se déconnecter ?',
        logoutDescription: 'Vous devrez vous reconnecter pour accéder à votre tableau de bord.',
        vendor: 'Vendeur',
        toNavigate: 'pour naviguer',
        toSelect: 'pour sélectionner',
        toClose: 'pour fermer',
    },

    sidebar: {
        defaultStoreName: 'Ma boutique',
        platformStatus: 'État de la plateforme',
        allSystemsOperational: 'Tous les systèmes sont opérationnels',
        collapse: 'Réduire',
        collapseSidebar: 'Réduire le menu latéral',
        expandSidebar: 'Développer le menu latéral',
        dragToResize: 'Faire glisser pour redimensionner',
    },

    mobile: {
        more: 'Plus',
        quickActions: 'Actions rapides',
    },

    platformStatus: {
        online: 'Tous les systèmes sont opérationnels',
        degraded: 'Performances dégradées',
        offline: 'Hors ligne',
    },

    login: {
        title: 'Jovi Mall Vendeur',
        description: 'Connectez-vous depuis le site principal pour accéder à votre tableau de bord vendeur.',
        goToLogin: 'Aller à la connexion',
    },
};

export default nav;
