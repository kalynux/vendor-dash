import { plural } from '../../types';

/** Facturation : formule, portefeuille de crédits, stockage, paiement. */
export const billing = {
    title: 'Facturation',
    subtitle: 'Votre formule, vos crédits et vos moyens de paiement',

    status: {
        active: 'Active',
        pending_activation: 'En file d’attente',
        expired: 'Expirée',
        cancelled: 'Annulée',
    },

    term: {
        never: 'N’expire jamais',
        monthly: 'Mensuel',
        months: 'Tous les {{count}} mois',
        days: 'Tous les {{count}} jours',
    },

    plan: {
        freePlan: 'Formule gratuite',
        price: '{{price}} · {{term}}',
        info:
            'Votre abonnement actuel. La commission correspond à ce que la plateforme prélève sur ' +
            'chaque vente, et l’allocation de crédits à ce qui recharge votre portefeuille à chaque ' +
            'échéance. Atteindre le plafond de produits ne supprime rien : cela vous empêche ' +
            'seulement d’en publier d’autres tant que vous n’en archivez pas un ou ne montez pas de formule.',
        renewsOrExpires: 'Renouvellement / expiration',
        neverExpires: 'N’expire jamais',
        commission: 'Commission',
        creditAllowance: 'Allocation de crédits',
        activeProducts: 'Produits actifs',
        pendingQueued: '{{name}} en file d’attente',
        pendingStarts: 'Démarre à la fin de votre formule actuelle.',
        pendingStartsOn: 'Démarre à la fin de votre formule actuelle, le {{date}}.',
    },

    mobile: {
        plans:
            'Le changement de forfait n’est pas disponible dans l’application. Ouvrez votre tableau ' +
            'de bord dans un navigateur web pour changer de forfait.',
        credits:
            'Les recharges ne sont pas disponibles dans l’application. Ouvrez votre tableau de bord ' +
            'dans un navigateur web pour acheter des crédits.',
        methods:
            'L’ajout d’une carte n’est pas disponible dans l’application. Ouvrez votre tableau de bord ' +
            'dans un navigateur web pour en ajouter une — vos moyens de paiement enregistrés ' +
            'fonctionnent toujours ici.',
    },

    plans: {
        title: 'Formules',
        info:
            'Montez en gamme quand vous voulez. Une formule payante achetée maintenant n’interrompt ' +
            'pas la formule en cours : elle est mise en file d’attente et démarre le jour où l’actuelle se termine.',
        current: 'Actuelle',
        free: 'Gratuit',
        creditsOnActivation: '{{credits}} crédits à l’activation',
        activeProductsFeature: '{{cap}} produits actifs',
        commissionFeature: '{{percent}} % de commission par vente',
        yourPlan: 'Votre formule',
        defaultTier: 'Formule par défaut',
        queued: 'Formule en attente',
        choose: 'Choisir cette formule',
        queuedHint: 'Une formule est déjà en attente pour démarrer à la fin de l’actuelle.',
        switchTo: 'Passer à {{name}}',
        planSummary: 'Formule {{name}}',
    },

    credits: {
        title: 'Portefeuille de crédits',
        info:
            'Les crédits financent l’indexation IA des produits et les messages WhatsApp envoyés aux ' +
            'clients. Ils n’expirent jamais et votre formule les recharge à chaque échéance. Un ' +
            'rechargement remboursé ou contesté reprend ses crédits, ce qui peut rendre le solde négatif.',
        currentBalance: 'Solde actuel',
        unit: 'crédits',
        negativeWarning:
            'Votre solde est négatif après un rechargement remboursé ou contesté. Les fonctions ' +
            'payées en crédits (indexation IA, messages WhatsApp) sont suspendues jusqu’au prochain rechargement.',
        topUp: 'Recharger',
        packCredits: '{{credits}} crédits',
        buy: 'Acheter',
        noPacks: 'Aucun pack de crédits disponible pour le moment.',
        buyTitle: 'Acheter des crédits',
    },

    storage: {
        title: 'Stockage des médias',
        used: '{{used}} sur {{limit}} utilisés',
        usedNoLimit: '{{used}} utilisés · sans limite',
        info:
            'Seuls les médias produits comptent dans cette limite — les fichiers téléchargeables des ' +
            'produits numériques en sont exclus. À 100 %, les nouveaux téléversements sont bloqués ' +
            'jusqu’à ce que vous libériez de l’espace ou changiez de formule, et les médias inutilisés ' +
            'de longue date peuvent être supprimés.',
        usedLabel: 'Utilisé',
        remaining: '{{size}} restants',
        categories: {
            image: 'Images',
            video: 'Vidéos',
            document: 'Documents',
            audio: 'Audio',
            archive: 'Archives',
            other: 'Autres',
        },
        fileCount: plural({ one: '{{count}} fichier', other: '{{count}} fichiers' }),
        full:
            'Votre stockage de médias est plein. Les nouveaux téléversements sont bloqués jusqu’à ce que vous libériez de l’espace.',
        nearFull: 'Vous avez utilisé {{percent}} % de votre stockage de médias.',
        freeUpSpace: 'Libérer de l’espace',
        upgradePlan: 'Changer de formule',
    },

    methods: {
        title: 'Moyens de paiement',
        info:
            'Les moyens enregistrés pré-remplissent le paiement lors de l’achat d’une formule ou de ' +
            'crédits. Seuls un jeton et les derniers chiffres sont conservés — jamais le numéro complet ' +
            'ni le CVV. Jusqu’à {{max}} moyens. Supprimer votre moyen par défaut n’en promeut pas un ' +
            'autre : choisissez-en un vous-même.',
        atLimit: 'Vous pouvez enregistrer jusqu’à {{max}} moyens de paiement.',
        empty: 'Aucun moyen de paiement enregistré. Ajoutez-en un pour accélérer le paiement.',
        default: 'Par défaut',
        expires: 'Expire {{date}}',
        setDefault: 'Définir par défaut',
        removeAria: 'Supprimer ce moyen de paiement',
        removeTitle: 'Supprimer ce moyen de paiement ?',
        removeDescription: '{{label}} sera supprimé. C’est irréversible.',
        addTitle: 'Ajouter un moyen de paiement',
        addDescription:
            'Enregistrez un moyen pour accélérer le paiement. Nous ne conservons jamais le numéro de carte complet ni le CVV.',
        type: 'Moyen de paiement',
        phone: 'Numéro mobile money',
        processedBy: 'Traité par',
        holderNameOptional: 'Nom du titulaire (facultatif)',
        holderNamePlaceholder: 'Titulaire du compte',
        cardHolderName: 'Nom du titulaire de la carte',
        cardHolderPlaceholder: 'Nom sur la carte',
        cardDetails: 'Coordonnées de la carte',
        makeDefault: 'Définir par défaut',
        makeDefaultHint: 'Pré-sélectionné au moment du paiement.',
        save: 'Enregistrer le moyen',
    },

    methodType: {
        card: 'Carte',
        mobile_money: 'Mobile money',
        bank_transfer: 'Virement bancaire',
    },

    gateway: {
        notchpay: 'NotchPay',
        mycoolpay: 'MyCoolPay',
        card: 'Carte',
    },

    gatewayHelp: {
        mobileMoney: 'Mobile money — débité en XAF',
        card: 'Visa, Mastercard et plus — débité en USD',
    },

    checkout: {
        savedMethods: 'Moyen de paiement',
        newMethod: 'Nouveau',
        payWith: 'Payer avec',
        phone: 'Numéro mobile money',
        usdNotice:
            'Les paiements par carte sont traités en USD ; votre banque peut appliquer sa propre ' +
            'conversion. Le montant exact en dollars sera affiché à l’étape suivante.',
        usdNoticeShort: 'Débité en USD ; votre banque peut appliquer sa propre conversion.',
        nameOnCard: 'Nom sur la carte (facultatif)',
        nameOnCardPlaceholder: 'Boutique de Jeanne',
        receiptEmail: 'E-mail pour le reçu (facultatif)',
        receiptEmailPlaceholder: 'vendeur@exemple.com',
        continueToCard: 'Continuer vers la carte',
        confirmPayment: 'Confirmer le paiement · {{amount}}',
        cardDetails: 'Coordonnées de la carte',
        willBeCharged: 'Vous serez débité de',
        forSummary: 'pour {{summary}} ({{amount}})',
        completingFor: 'Finalisation du paiement pour {{summary}} ({{amount}})',
        pay: 'Payer {{amount}}',
        payNow: 'Payer maintenant',
        waiting: 'En attente du paiement…',
        phonePrompt: 'Confirmez l’invite de paiement sur votre téléphone.',
        dialUssd: 'Composez {{code}} pour approuver.',
        keepOpen: 'Cela peut prendre une ou deux minutes. Gardez cette fenêtre ouverte.',
        closeKeepProcessing: 'Fermer (le traitement continue)',
        redirectingToBank: 'Redirection vers votre banque pour confirmer le paiement…',
        cardConfirmed: 'Carte confirmée — application de votre achat…',
        confirmingPayment: 'Confirmation de votre paiement…',
        successTitle: 'Paiement confirmé',
        successDescription: 'Votre compte a été mis à jour.',
        failedTitle: 'Paiement échoué',
        failedDescription:
            'Le paiement n’a pas abouti. Aucun débit n’a été effectué — vous pouvez réessayer.',
        timeoutTitle: 'Toujours en cours',
        timeoutDescription:
            'Nous n’avons pas pu confirmer le paiement à temps. Si vous l’avez finalisé, votre solde ' +
            'sera mis à jour sous peu — consultez votre historique.',
        startOver: 'Recommencer',
        resumePending:
            'Nous confirmons encore votre paiement par carte — la mise à jour apparaîtra ici sous peu.',
        resumeFailed: 'Le paiement par carte n’a pas abouti.',
    },

    cardForm: {
        unavailable: 'Les paiements par carte sont indisponibles pour le moment.',
        loadFailed: 'Impossible de charger le formulaire de carte. Réessayez.',
        loading: 'Chargement du formulaire de carte…',
        loadingSecure: 'Chargement du formulaire de carte sécurisé…',
        notReady: 'Le formulaire de carte n’est pas encore prêt.',
        invalidCard: 'Impossible de valider la carte.',
        chargeFailed: 'Votre carte n’a pas pu être débitée. Réessayez.',
        notCompleted: 'Le paiement par carte n’a pas abouti. Réessayez.',
        failed: 'Le paiement par carte a échoué. Réessayez.',
    },

    cardPreview: {
        cardType: 'Type de carte',
        fallbackBrand: 'CARTE',
        holder: 'Titulaire',
        valid: 'Valable',
        expiryPlaceholder: 'MM/AA',
    },

    settings: {
        title: 'Rappels d’expiration',
        info:
            'Combien de jours avant la date d’expiration de votre formule nous vous prévenons, pour ' +
            'qu’une interruption ne vous surprenne jamais. Réglez sur 7 et une formule se terminant le ' +
            '30 déclenche un rappel le 23. Entre {{min}} et {{max}} jours.',
        hintLabel: 'À propos du délai de rappel',
        hint: 'Jours de préavis avant l’expiration de la formule. Entre {{min}} et {{max}}.',
        daysLabel: 'Jours avant expiration',
    },

    validation: {
        daysRequired: 'Saisissez un nombre de jours',
        daysInteger: 'Doit être un nombre entier',
        daysMin: 'Doit être au moins 0',
        daysMax: 'Doit être au plus 90',
        email: 'Saisissez un e-mail valide, ou laissez le champ vide.',
    },

    toast: {
        planPurchased: 'Formule achetée',
        creditsAdded: 'Crédits ajoutés',
        methodAdded: 'Moyen de paiement ajouté',
        methodRemoved: 'Moyen de paiement supprimé',
        pickNewDefault: 'Choisissez un nouveau moyen de paiement par défaut.',
        settingsUpdated: 'Paramètres mis à jour',
    },

    errors: {
        loadFailed: "Nous n'avons pas pu charger vos informations de facturation. Réessayez.",
        loadMethodsFailed: "Nous n'avons pas pu charger vos moyens de paiement. Réessayez.",
        loadSettingsFailed: "Nous n'avons pas pu charger vos paramètres de facturation. Réessayez.",
        updateSettingsFailed:
            "Nous n'avons pas pu mettre à jour vos paramètres de facturation. Réessayez.",
        defaultFailed:
            "Nous n'avons pas pu mettre à jour votre moyen de paiement par défaut. Réessayez.",
        removeMethodFailed: "Nous n'avons pas pu supprimer ce moyen de paiement. Réessayez.",
        methodFailed: "Nous n'avons pas pu enregistrer ce moyen de paiement. Réessayez.",
        paymentFailed: "Le paiement n'a pas pu être finalisé. Réessayez.",
    },
};

export default billing;
