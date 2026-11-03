import { plural } from '../../types';

export default {
    rules: {
        fromCommission: 'Votre récompense est prélevée sur la commission de Wi-Mall.',
        who: 'Les vendeurs, les clients et les agences vous rapportent des récompenses.',
        limited: 'Chaque personne vous rapporte des récompenses pendant une durée limitée à partir de son inscription.',
        earned: 'Une récompense compte une fois que Wi-Mall a reçu sa commission sur la commande.',
        wait: plural({
            one: 'Vous pouvez retirer une récompense {{count}} jour plus tard.',
            other: 'Vous pouvez retirer une récompense {{count}} jours plus tard.',
        }),
        refunds:
            'Si une commande est remboursée après le retrait de sa récompense, vous pouvez devoir rendre ce montant. Vos prochaines récompenses le règlent automatiquement.',
        minimum: 'Le retrait minimum est de <0>{{amount}}</0>.',
    },

    intro: {
        title: 'Gagnez de l’argent en invitant des personnes sur Wi-Mall',
        lead: 'Partagez votre lien. Quand quelqu’un s’inscrit grâce à lui, vous gagnez un pourcentage de la commission que Wi-Mall perçoit sur les commandes auxquelles cette personne participe.',
    },

    closed: {
        title: 'Le programme de parrainage n’est pas ouvert',
        body: 'Vous ne pouvez pas faire de demande pour le moment.',
    },

    apply: {
        reapplyTitle: 'Refaire une demande',
        termsLabel: 'J’accepte les <0>Conditions du partenaire</0>.',
        motivationLabel: 'Quelque chose à nous dire ? (facultatif)',
        motivationPlaceholder: 'Par exemple, les boutiques ou les personnes que vous pourriez inviter',
        submit: 'Envoyer ma demande',
        submitting: 'Envoi…',
        sent: 'Demande envoyée.',
        failed: 'Nous n’avons pas pu envoyer votre demande. Veuillez réessayer.',
    },

    status: {
        pending: {
            title: 'Nous examinons votre demande',
            body: 'Vous avez fait votre demande le {{date}}. Nous vous préviendrons dès qu’une décision sera prise, et cette page l’affichera.',
        },
        rejected: {
            title: 'Votre demande n’a pas été acceptée',
            canApply: 'Vous pouvez refaire une demande ci-dessous.',
        },
        suspended: {
            title: 'Votre partenariat est suspendu',
            body: 'Votre lien ne rapporte rien pour le moment. Les personnes qui l’utilisent s’inscrivent normalement, sans que cela vous soit crédité.',
        },
        terminated: {
            title: 'Votre partenariat a pris fin',
            body: 'Votre lien ne rapporte plus rien. Les personnes qui l’utilisent s’inscrivent normalement, sans que cela vous soit crédité.',
        },
        unknown: {
            title: 'Votre partenariat est en cours de mise à jour',
        },
        frozen: 'Votre solde est gelé : vous ne pouvez pas le retirer pour le moment.',
        released: 'Vous pouvez toujours retirer votre solde.',
        paused: {
            title: 'Le programme est en pause',
            body: 'Les nouvelles inscriptions et les nouvelles commandes ne rapportent rien pour le moment. Ce que vous avez déjà gagné reste à vous.',
        },
    },

    share: {
        title: 'Votre code de parrainage',
        inactive: 'Ce code et ce lien ne rapportent rien pour le moment. Les personnes qui les utilisent s’inscrivent normalement.',
        copyCode: 'Copier le code',
        copyLink: 'Copier : {{name}}',
        shareLink: 'Partager : {{name}}',
        shareMessage: 'Rejoignez Wi-Mall avec mon lien :',
        shareFailed: 'Le partage n’a pas pu s’ouvrir sur cet appareil. Copiez plutôt le lien.',
        register: {
            name: 'Lien d’inscription',
            hint: 'Pour les vendeurs, les agences, les livreurs et les clients sur le site',
        },
        whatsapp: {
            name: 'Lien WhatsApp',
            hint: 'Pour les personnes qui achètent via WhatsApp',
        },
        telegram: {
            name: 'Lien Telegram',
            hint: 'Pour les personnes qui achètent via Telegram',
        },
    },

    terms: {
        title: 'Ce que vous gagnez',
        line: plural({
            one: '{{rate}} % de la commission de Wi-Mall pendant {{count}} mois',
            other: '{{rate}} % de la commission de Wi-Mall pendant {{count}} mois',
        }),
    },

    category: {
        vendor: 'Vendeur',
        customer: 'Client',
        agency: 'Agence',
        agent: 'Livreur',
        other: 'Compte',
    },

    balance: {
        title: 'Solde de parrainage',
        separate: 'Distinct des gains de votre boutique, avec son propre retrait et son propre minimum.',
        available: 'Disponible',
        pending: 'En attente',
        pendingHint: plural({
            one: 'Retirable {{count}} jour après avoir été gagné',
            other: 'Retirable {{count}} jours après avoir été gagné',
        }),
        requested: 'En cours de retrait',
        clawback: 'À rendre',
        clawbackNote:
            'Un remboursement vous laisse cette somme à rendre. Les récompenses suivantes la remboursent en priorité, et vous ne pouvez pas retirer tant qu’elle n’est pas réglée.',
        withdraw: 'Retirer {{amount}}',
        withdrawHint: 'Tout votre solde disponible est envoyé.',
        withdrawn: 'Retrait demandé. Un administrateur va s’en occuper.',
        withdrawFailed: 'Nous n’avons pas pu demander votre retrait. Veuillez réessayer.',
        hint: {
            frozen: 'Votre solde est gelé : les retraits sont bloqués pour le moment.',
            requested: 'Votre retrait est en cours de traitement.',
            noDestination: 'Ajoutez un moyen de versement pour retirer.',
            belowMinimum: 'Vous pourrez retirer à partir de {{amount}}.',
        },
    },

    destination: {
        title: 'Versé sur',
        change: 'Le modifier dans la page Versements',
        none: 'Vous n’avez pas encore de moyen de versement.',
        add: 'Ajouter un moyen de versement',
        agency: 'Enregistré sur votre compte agence. Modifiez-le là-bas.',
        agent: 'Enregistré sur votre compte livreur. Modifiez-le là-bas.',
    },

    referred: {
        title: 'Personnes parrainées',
        info: 'Toutes les personnes inscrites avec votre code. Les noms sont volontairement masqués en partie, et les commandes ne sont jamais affichées.',
        empty: 'Personne ne s’est encore inscrit avec votre code.',
        summary: plural({
            one: '{{count}} compte, {{earning}} rapporte encore',
            other: '{{count}} comptes, {{earning}} rapportent encore',
        }),
        signedUp: 'Inscrit le {{date}}',
        earningUntil: 'Rapporte jusqu’au {{date}}',
        endsOn: 'Fin de la période de parrainage le {{date}}',
        ended: 'Terminé le {{date}}',
        neverEarns: 'Les propres livraisons d’un livreur ne rapportent rien',
    },

    rewards: {
        title: 'Récompenses',
        info: 'Ce que chaque compte parrainé vous a rapporté, tel que c’est aujourd’hui après d’éventuels remboursements.',
        empty: 'Vous n’avez pas encore de récompense.',
        earned: 'Gagnée le {{date}}',
        adjusted: 'Réduite par un remboursement',
        status: {
            held: 'Retirable à partir du {{date}}',
            released: 'Débloquée',
            reversed: 'Entièrement remboursée',
            unknown: 'En cours de traitement',
        },
    },

    payouts: {
        title: 'Retraits',
        info: 'Les retraits de votre solde de parrainage uniquement. Les gains de votre boutique ont leur propre liste dans la page Versements.',
        empty: 'Vous n’avez pas encore fait de retrait.',
        requested: 'Demandé le {{date}}',
    },

    loadFailed: 'Nous n’avons pas pu charger votre page de parrainage. Vérifiez votre connexion et réessayez.',
};
