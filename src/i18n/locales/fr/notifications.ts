import { plural } from '../../types';

/** Boîte de réception des notifications et réglages par canal. */
export const notifications = {
    title: 'Notifications',
    subtitle: 'Tout ce qui s’est passé pendant votre absence',

    stats: {
        unread: 'Non lues',
        total: 'Total',
    },

    time: {
        justNow: 'à l’instant',
        minutesAgo: 'il y a {{count}} min',
        hoursAgo: 'il y a {{count}} h',
        daysAgo: 'il y a {{count}} j',
    },

    tabs: {
        all: 'Toutes',
        unread: 'Non lues',
        read: 'Lues',
    },

    empty: {
        all: 'Aucune notification pour le moment',
        unread: 'Vous êtes à jour !',
        read: 'Aucune notification lue',
    },

    actions: {
        markAllRead: 'Tout marquer comme lu',
        markRead: 'Marquer comme lu',
    },

    toast: {
        allMarkedRead: 'Toutes les notifications ont été marquées comme lues',
    },

    errors: {
        loadFailed: 'Impossible de charger les notifications.',
        markReadFailed: 'Impossible de marquer comme lu.',
        markAllReadFailed: 'Impossible de tout marquer comme lu.',
    },

    settings: {
        title: 'Notifications',
        info: 'Choisissez comment chaque type de mise à jour vous parvient. Un canal doit être vérifié avant de pouvoir être activé.',
        channels: {
            email: 'E-mail',
            whatsapp: 'WhatsApp',
            telegram: 'Telegram',
            push: 'Push',
            inApp: 'Dans l’application',
        },
        verified: 'Vérifié',
        notVerified: 'Non vérifié',
        setUp: 'Configurer',
        verify: 'Vérifier',
        disconnect: 'Déconnecter',
        linkExpires: 'Le lien expire à {{time}}.',
        channelNotVerified: "Vérifiez ce canal avant d'y activer les notifications.",
        groups: {
            orders: 'Commandes',
            payments: 'Paiements et versements',
            inventory: 'Stock',
            bookings: 'Réservations',
            support: 'Support',
            account: 'Compte et sécurité',
        },
        saved: 'Réglages de notification enregistrés',
        enabledCount: plural({
            one: '{{count}} notification activée',
            other: '{{count}} notifications activées',
        }),

        loadFailed: 'Impossible de charger les réglages de notification.',
        disconnected: '{{channel}} déconnecté',

        push: {
            bannerLabel: 'Activer les notifications push sur cet appareil',
            title: 'Activer les notifications push',
            description:
                'Touchez pour recevoir des alertes en temps réel sur cet appareil, même lorsque le tableau de bord est en arrière-plan.',
            blocked:
                'Les notifications sont bloquées — autorisez-les pour ce site dans les réglages de votre navigateur, puis touchez ici.',
            dismiss: 'Ignorer',
            enabled: 'Notifications push activées sur cet appareil',
            blockedToast:
                'Le push est bloqué. Activez les notifications pour ce site dans les réglages de votre navigateur.',
            enableFailed: 'Impossible d’activer le push sur cet appareil.',
        },

        delivery: {
            title: 'Canal de réception',
            info: 'Là où vos notifications arrivent. Le canal in-app est toujours actif et ne peut pas être désactivé. Vous pouvez y ajouter un canal supplémentaire — connectez-le d’abord, puis activez-le. Un seul canal supplémentaire à la fois.',
            inApp: 'Dans l’application',
            alwaysOn: 'Toujours actif',
            inAppHint:
                'Toutes les notifications arrivent dans le menu cloche. Ce canal ne peut pas être désactivé.',
            groupLabel: 'Canal de réception supplémentaire',
            connected: 'Connecté',
            notConnected: 'Non connecté',
            connect: 'Connecter',
            makeActive: 'Faire de {{channel}} votre canal supplémentaire actif',
            turnOff: '{{channel}} est votre canal supplémentaire actif — désactivez-le',
            active: 'Actif',
            use: 'Utiliser',
            connectToUse: 'Connectez ce canal pour l’utiliser.',
            alsoGoHere: 'Les notifications arrivent aussi ici.',
            tapUse: 'Touchez « Utiliser » pour recevoir les notifications ici.',
        },

        events: {
            title: 'Événements',
            info: 'Les événements qui vous parviennent. En désactiver un le rend silencieux sur tous les canaux, y compris in-app.',
            about: 'À propos de : {{event}}',
            orderCreated: 'Nouvelle commande',
            orderCreatedHint: 'Lorsqu’une nouvelle commande est reçue',
            orderCancelled: 'Commande annulée',
            orderCancelledHint: 'Lorsqu’une commande est annulée',
            bookingCreated: 'Nouvelle réservation',
            bookingCreatedHint: 'Lorsqu’une nouvelle réservation de service est reçue',
            bookingCancelled: 'Réservation annulée',
            bookingCancelledHint: 'Lorsqu’une réservation de service est annulée',
            paymentReceivedPartial: 'Paiement partiel',
            paymentReceivedPartialHint: 'Lorsqu’un paiement partiel est reçu',
            paymentReceivedFull: 'Paiement intégral',
            paymentReceivedFullHint: 'Lorsqu’un paiement est réglé intégralement',
            storageAlert: 'Alerte de stockage',
            storageAlertHint: 'Lorsque le stockage média franchit 80 % / 90 % / 100 %',
            connectionUpdated: 'Connexions d’agence',
            connectionUpdatedHint:
                'Lorsqu’une demande, une approbation, un refus ou une réapprobation d’agence survient',
            payoutUpdates: 'Mises à jour de versement',
            payoutUpdatesHint:
                'Lorsque votre demande de versement est créée, payée ou refusée',
            shipmentRejected: 'Expédition refusée',
            shipmentRejectedHint:
                'Lorsqu’une agence de livraison refuse une expédition et que ses articles doivent être réacheminés',
            planUpdates: 'Mises à jour de formule',
            planUpdatesHint: 'Lorsque votre formule approche de son expiration ou a expiré',
        },

        setup: {
            connectTitle: 'Connecter {{channel}}',
            connectedTitle: '{{channel}} connecté',
            connectDescription:
                'Reliez votre {{channel}} pour y recevoir les notifications. Configuration unique.',
            connectedDescription:
                'Votre {{channel}} est vérifié. Vous pouvez désormais l’activer comme canal de réception.',
            allSet: 'C’est prêt — fermez cette fenêtre et choisissez {{channel}} comme canal.',
            preparing: 'Préparation…',
            emailStep1: 'Nous avons envoyé un lien de vérification à <0>{{email}}</0>.',
            emailFallback: 'votre adresse e-mail',
            emailStep2:
                'Ouvrez l’e-mail et cliquez sur le lien pour vérifier, puis actualisez ci-dessous.',
            resendEmail: 'Renvoyer l’e-mail',
            telegramStep1: 'Ouvrez notre bot Telegram et appuyez sur <0>Start</0>.',
            openTelegram: 'Ouvrir Telegram',
            linkExpires: 'Le lien expire à {{time}}.',
            telegramStep2: 'Une fois que le bot confirme, actualisez ci-dessous.',
            whatsappStep1: 'Ouvrez WhatsApp et envoyez la commande pré-remplie à notre bot.',
            openWhatsapp: 'Ouvrir WhatsApp',
            copyCommand: 'Copier la commande',
            whatsappStep2: 'Après la réponse du bot, actualisez ci-dessous.',
            checkAgain: 'C’est fait — vérifier',
            notVerifiedYet:
                'Pas encore vérifié — terminez les étapes, puis vérifiez à nouveau.',
        },
    },
};

export default notifications;
