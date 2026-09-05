/** Compte : profil, identité de la boutique, adresses, sécurité, versements. */
export const account = {
    title: 'Compte',
    subtitle: 'Gérez votre compte personnel, l’identité de votre boutique et vos versements',

    tabSubtitles: {
        profile: 'Vos informations personnelles, votre photo et la langue du tableau de bord',
        store: 'L’identité publique de votre boutique, vos contacts d’assistance et le mode vacances',
        addresses: 'Les adresses professionnelles d’où vos produits sont expédiés et retirés',
        security: 'Votre mot de passe, l’authentification à deux facteurs et vos appareils connectés',
        billing: 'Votre formule, vos crédits, vos moyens de paiement enregistrés et votre stockage',
        payout: 'Votre solde de gains et la destination de vos retraits',
    },

    unsavedBar: {
        label: 'Modifications non enregistrées',
        discard: 'Abandonner',
        save: 'Enregistrer',
        saveChanges: 'Enregistrer les modifications',
    },

    section: {
        aboutTitle: 'À propos de « {{title}} »',
        moreInformation: 'Plus d’informations',
    },

    profile: {
        title: 'Profil',
        info: "Vos informations personnelles. Le nom et la photo affichés ici sont ceux que voient vos collaborateurs et le support — le nom public de votre vitrine se trouve dans l'onglet Boutique. Touchez votre photo pour en choisir une nouvelle dans votre bibliothèque de médias.",
        changePhoto: 'Changer la photo',
        addPhoto: 'Ajouter une photo',
        removePhoto: 'Retirer la photo',
        fullName: 'Nom complet',
        fullNamePlaceholder: 'Votre nom',
        nameTooShort: 'Le nom doit comporter au moins 2 caractères.',
        email: 'E-mail',
        emailHintLabel: 'À propos de votre e-mail',
        emailHint: "C'est l'adresse avec laquelle vous vous connectez, et celle qui reçoit vos reçus et avis de compte. Elle ne se modifie pas ici — contactez le support pour la changer.",
        phone: 'Téléphone',
        phoneHintLabel: 'À propos de votre numéro de téléphone',
        phoneHint: 'Le numéro de votre compte, utilisé pour le suivi du compte et des versements. Choisissez le pays auquel il appartient, puis saisissez-le comme vous le composeriez sur place — il est enregistré avec l’indicatif.',
        whatsapp: 'Numéro WhatsApp',
        whatsappHintLabel: 'À propos de votre numéro WhatsApp',
        whatsappHint: 'Le numéro sur lequel vous recevez les questions sur les commandes. Distinct du téléphone de votre compte — celui que voient vos clients se règle dans Boutique → Support et contact.',
        role: 'Rôle',
        roleHintLabel: 'À propos de votre rôle',
        roleHint: 'Ce que ce compte peut faire sur la plateforme. Défini par la plateforme, non modifiable.',
        roles: {
            vendor: 'Vendeur',
        },
        updated: 'Profil mis à jour',
    },

    /** Adresses professionnelles (Compte → Adresses). */
    addresses: {
        title: 'Adresses professionnelles',
        blockedByProducts:
            '« {{label}} » sert de point de retrait à {{count}} produit(s)',
        cannotRemove:
            'Suppression impossible : {{list}}. Réattribuez d’abord ces produits.',
    },

    contact: {
        title: 'Identifiants de connexion',
        info: "L'adresse e-mail et le numéro de téléphone avec lesquels vous vous connectez. Chaque modification se fait en deux étapes, et l'ancienne valeur reste valable jusqu'à la confirmation de la nouvelle.",
        emailLabel: 'Adresse e-mail',
        phoneLabel: 'Numéro de téléphone',
        change: 'Modifier',
        cancelChange: 'Annuler la modification',

        newEmailLabel: 'Nouvelle adresse e-mail',
        newEmailPlaceholder: 'vous@exemple.com',
        emailFlowHint:
            "Nous enverrons un lien de confirmation à la nouvelle adresse. Ouvrez-le et confirmez depuis cette page — la modification ne prend effet qu'à ce moment-là. Le lien est valable une heure.",
        sendLink: 'Envoyer le lien de confirmation',
        emailChangeRequested: 'Lien de confirmation envoyé à la nouvelle adresse.',
        emailChangeCancelled: "Modification de l'e-mail annulée.",
        emailPendingNotice:
            "Continuez à vous connecter avec votre e-mail actuel jusqu'à ce que vous confirmiez depuis le lien envoyé.",

        newPhoneLabel: 'Nouveau numéro de téléphone',
        whatsappRequired:
            'Changer votre numéro de téléphone nécessite un compte WhatsApp lié utilisant le nouveau numéro. Un compte Telegram lié ne suffit pas.',
        whatsappNumberMismatch:
            "Votre numéro WhatsApp lié se termine par {{hint}}, ce qui ne correspond pas à celui-ci. Liez WhatsApp avec le nouveau numéro d'abord, sinon la confirmation sera refusée.",
        manageConnections: 'Gérer les connexions',
        phoneFlowHint:
            "Vous confirmerez ensuite depuis cette page — nous vérifions que votre compte WhatsApp lié utilise ce numéro. Aucun code à saisir. Vous avez 24 heures.",
        phoneChangeRequested: 'Confirmez maintenant la modification pour terminer.',
        phoneChangeCancelled: 'Modification du numéro annulée.',
        phoneChanged: 'Votre numéro de téléphone a été modifié.',
        confirmPhone: 'Confirmer la modification',
        phonePendingNotice:
            "Continuez à vous connecter avec votre numéro actuel jusqu'à la confirmation.",

        pendingTarget: 'En attente de passage à {{target}}',
        pendingExpires: 'Expire {{when}}.',
        pendingExpired: 'Cette demande a expiré. Annulez-la et recommencez.',

        // `confirmPage` est SUPPRIMÉ avec la page correspondante — le site
        // principal sert /account/confirm-email pour les quatre applications.

        errors: {
            loadFailed: "Nous n'avons pas pu charger vos identifiants de connexion. Réessayez.",
            actionFailed: "Nous n'avons pas pu effectuer cette action. Réessayez.",
            confirmFailed:
                "Nous n'avons pas pu confirmer cette modification. Le lien a peut-être expiré.",
        },
    },

    security: {
        passwordTitle: 'Changer le mot de passe',
        passwordInfo:
            'Utilisez un mot de passe que vous n’employez nulle part ailleurs. Le changer déconnecte tous les autres appareils et navigateurs — celui-ci reste connecté.',
        currentPassword: 'Mot de passe actuel',
        newPassword: 'Nouveau mot de passe',
        confirmPassword: 'Confirmer le nouveau mot de passe',
        showPassword: 'Afficher le mot de passe',
        hidePassword: 'Masquer le mot de passe',
        passwordHint:
            '8 caractères minimum, avec majuscules et minuscules, un chiffre et un caractère spécial.',
        passwordsDontMatch: 'Les mots de passe ne correspondent pas.',
        updatePassword: 'Mettre à jour le mot de passe',
        updated: 'Mot de passe mis à jour. Tous les autres appareils ont été déconnectés.',
        updateFailed: 'Nous n’avons pas pu changer votre mot de passe. Veuillez réessayer.',
        rules: {
            length: 'Au moins 8 caractères',
            uppercase: 'Au moins une majuscule',
            lowercase: 'Au moins une minuscule',
            number: 'Au moins un chiffre',
            special: 'Au moins un caractère spécial',
        },
        biometricTitle: 'Connexion par empreinte',
        biometricInfo:
            'Connectez-vous sur ce téléphone avec l’empreinte ou le visage qu’il reconnaît déjà, au lieu de saisir votre mot de passe.',
        biometricOn: 'Activée sur ce téléphone',
        biometricOnDesc:
            'Vos identifiants sont conservés dans le stockage sécurisé de ce téléphone et ne sont transmis qu’une fois votre identité confirmée par le téléphone.',
        biometricOffDesc:
            'Activez cette option depuis l’écran de connexion : cochez « La prochaine fois, se connecter avec votre empreinte » au moment de saisir votre mot de passe.',
        biometricTurnOff: 'Désactiver',
        biometricTurnedOff: 'La connexion par empreinte est désactivée sur ce téléphone.',

        twoFactorTitle: 'Authentification à deux facteurs',
        twoFactorInfo:
            'Une seconde étape à la connexion — un code sur votre téléphone en plus de votre mot de passe. Pas encore disponible.',
        twoFactorToggle: 'Activer l’authentification à deux facteurs',
        sessionsTitle: 'Appareils connectés',
        sessionsInfo:
            'La déconnexion des autres appareils passe par le changement de mot de passe : il invalide immédiatement toutes les connexions sauf celle-ci, partout.',
        sessionsHowTo:
            'Changer votre mot de passe ci-dessus déconnecte immédiatement tous les autres appareils et navigateurs. Utilisez-le si vous pensez que quelqu’un d’autre y a accès.',
        notAvailableYet:
            'Pas encore disponible — cette fonctionnalité arrivera dans une prochaine mise à jour.',
    },

    earnings: {
        title: 'Revenus',
        info: {
            balances:
                '<0>Disponible</0> correspond à ce que vous pouvez retirer maintenant. <1>En attente</1> correspond aux commandes non encore réglées, et <2>Demandé</2> est déjà engagé dans un retrait.',
            minimum: 'Le retrait minimum est de {{amount}}.',
            autoThreshold:
                'Si votre solde disponible atteint {{amount}}, nous créons automatiquement une demande de versement pour que vos fonds ne restent pas immobilisés. Veillez à enregistrer un moyen de versement — sinon la demande automatique ne peut pas être créée et votre solde continuera de croître au-delà du seuil jusqu’à ce que vous en ajoutiez un.',
        },
        available: 'Disponible',
        pending: 'En attente',
        requested: 'Demandé',
        requestWithdrawal: 'Demander un retrait',
        nothingAvailable: 'Rien à retirer pour l’instant.',
        belowMinimum: 'Le retrait minimum est de {{amount}}.',
        latestRequest: 'Dernière demande de retrait',
        requestedOn: '{{amount}} · demandé le {{date}}',
        autoOpened:
            'Ouverte automatiquement parce que votre solde disponible a atteint {{amount}}.',
        viewTicket: 'Voir le ticket',
        requestCreated: 'Demande de versement créée.',
        loadFailed: 'Échec du chargement des revenus.',
        requestFailed: 'Échec de la demande de versement.',
        status: {
            pending: 'En cours d’examen',
            paid: 'Payé',
            rejected: 'Refusé',
        },
        origin: {
            manual: 'Demandé par vous',
            auto_threshold: 'Automatique',
        },
        errors: {
            alreadyPending:
                'Vous avez déjà une demande de versement en cours — suivez-la ci-dessous.',
            methodMissing:
                'Ajoutez un moyen de versement ci-dessous avant de demander un retrait.',
            noAvailableBalance: 'Aucun solde disponible à retirer pour l’instant.',
            belowMinimum:
                'Votre solde disponible est inférieur au minimum de {{amount}} requis pour un retrait.',
        },
    },

    localization: {
        title: 'Localisation',
        info: 'Où vous opérez, et la langue dans laquelle tout vous parvient. Votre pays détermine les règles de taxe, de livraison et d’adresse ; votre fuseau horaire est utilisé pour toutes les dates et heures du tableau de bord.',
        country: 'Pays',
        countryHintLabel: 'À propos de votre pays',
        countryHint: "Défini une seule fois lors de l'inscription puis verrouillé — il détermine vos règles de taxe, de livraison et d'adresse, et vos adresses professionnelles doivent s'y trouver. Contactez le support si cela doit changer.",
        countryReadOnly: 'Pays (lecture seule)',
        timezone: 'Fuseau horaire',
        timezoneHintLabel: 'À propos de votre fuseau horaire',
        timezoneHint: 'Toutes les heures de commande, rapports et plannings du tableau de bord sont affichés dans ce fuseau. Le changer ré-étiquette les horodatages existants ; il ne les déplace pas.',
        timezonePlaceholder: 'Sélectionnez votre fuseau horaire',
        language: 'Langue',
        languageHintLabel: 'À propos de votre langue',
        languageHint: 'La langue de ce tableau de bord, ainsi que celle de toutes vos notifications — e-mail, WhatsApp, Telegram et alertes dans l’application. Le tableau de bord bascule dès que vous enregistrez.',
        languagePlaceholder: 'Sélectionnez une langue',
    },
};

export default account;
