import { plural } from '../../types';

/** Compte : profil, identité de la boutique, adresses, sécurité, versements. */
export const account = {
    title: 'Compte',
    subtitle: 'Gérez votre compte personnel, l’identité de votre boutique et vos versements',

    tabSubtitles: {
        profile: 'Vos informations personnelles, votre photo et la langue du tableau de bord',
        store: 'L’identité publique de votre boutique, vos contacts d’assistance et le mode vacances',
        addresses: 'Les adresses professionnelles d’où vos produits sont expédiés et retirés',
        verification: 'Les pièces d’identité qu’un administrateur examine avant de vérifier votre boutique',
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

    /**
     * Vérification d'identité (Compte → Vérification) — `/api/vendor/kyc`.
     *
     * ⚠ Règle de rédaction : rien ici ne doit promettre qu'un dossier complet
     * sera approuvé, ni qu'un dossier incomplet sera refusé. Le backend
     * n'évalue rien ; c'est une personne qui décide. « Obligatoire » signifie
     * toujours « exigé par les vérificateurs » — une indication, pas un blocage.
     */
    verification: {
        title: "Vérification d'identité",
        info1: 'Les boutiques vérifiées inspirent davantage confiance aux acheteurs. Un administrateur examine les documents que vous ajoutez ici et décide de vérifier ou non votre compte.',
        info2: 'Vos documents sont privés. Ils ne sont jamais affichés sur votre boutique, jamais transmis aux clients ni aux agences de livraison, et seuls vous et le vérificateur pouvez les ouvrir.',
        info3: "Rien n'est contrôlé automatiquement — une personne lit vos documents. S'il manque quelque chose ou si un document est illisible, elle vous dira pourquoi et vous pourrez le corriger et le renvoyer.",
        saved: 'Informations de vérification enregistrées',
        submitted: 'Envoyé pour examen',
        uploadsSaveImmediately: "Les documents sont enregistrés dès que vous les ajoutez. Le numéro de pièce d'identité et l'adresse du domicile ci-dessous nécessitent le bouton Enregistrer.",

        status: {
            draft: {
                title: 'Pas encore envoyé',
                body: "Ajoutez vos documents ci-dessous, puis envoyez-les pour examen. Vous pouvez tout modifier tant que vous n'avez pas envoyé.",
            },
            under_review: {
                title: 'En cours d’examen',
                body: "Vos documents sont entre les mains d'un vérificateur. Vous pouvez encore consulter ce que vous avez envoyé, mais vous ne pouvez pas le modifier avant sa décision.",
            },
            verified: {
                title: 'Vérifié',
                body: 'Votre identité a été vérifiée. Ces documents sont désormais verrouillés — contactez le support si quelque chose doit changer.',
            },
            rejected: {
                title: 'Non accepté',
                body: "Un vérificateur n'a pas pu vérifier votre compte. Corrigez ce qu'il indique ci-dessous, puis renvoyez le dossier.",
            },
            rejectionReason: 'Motif',
            submittedOn: 'Envoyé le {{date}}',
            verifiedOn: 'Vérifié le {{date}}',
            lockedHint: 'Ce dossier est verrouillé et ne peut pas être modifié pour le moment.',
        },

        checklist: {
            required: 'Obligatoire',
            optional: 'Facultatif',
            complete: 'Vous avez tout ce que les vérificateurs demandent.',
            remaining: plural({
                one: '{{count}} élément manque encore avant l’envoi.',
                other: '{{count}} éléments manquent encore avant l’envoi.',
            }),
            items: {
                idNumber: "Votre numéro de pièce d'identité",
                idCardFront: "Recto de votre pièce d'identité",
                idCardBack: "Verso de votre pièce d'identité",
                selfieWithId: "Une photo de vous tenant votre pièce d'identité",
                homeAddress: 'Votre adresse de domicile',
                homeAddressSketch: 'Une capture de carte de votre domicile',
                storeAddressSketch: 'Une capture de carte de votre boutique',
            },
        },

        identity: {
            title: 'Votre identité',
            idNumber: "Numéro de pièce d'identité",
            idNumberPlaceholder: "Le numéro imprimé sur votre pièce d'identité",
            idNumberHint: "Saisissez-le exactement tel qu'il apparaît sur la carte. Tous les formats sont acceptés — un vérificateur le compare à vos scans.",
        },

        slots: {
            idCardFront: "Recto de votre pièce d'identité",
            idCardFrontHint: "Une photo ou un scan. JPG, PNG, WebP ou PDF, jusqu'à 10 Mo.",
            idCardBack: "Verso de votre pièce d'identité",
            idCardBackHint: 'Le verso de la même carte.',
            selfieWithId: "Photo de vous tenant votre pièce d'identité",
            selfieWithIdHint: 'Votre visage et la carte doivent être tous les deux bien visibles.',
            homeAddressSketch: 'Carte de votre domicile',
            homeAddressSketchHint: "Une capture de la carte avec votre maison indiquée, ou un croquis de l'itinéraire pour y arriver.",
            storeAddressSketch: 'Carte de votre boutique',
            storeAddressSketchHint: "Une capture de la carte avec votre boutique indiquée, ou un croquis de l'itinéraire pour y arriver.",
        },

        locations: {
            title: 'Vos adresses',
            info: "Les vérificateurs contrôlent que vos adresses sont localisables sur une carte. Les adresses de vos boutiques se modifient sous Adresses — seule l'adresse de votre domicile se saisit ici.",
            homeAddress: 'Adresse du domicile',
            homeAddressPlaceholder: 'Recherchez votre adresse de domicile',
            homeAddressHint: "Choisissez votre adresse dans les résultats de recherche afin qu'elle porte des coordonnées cartographiques. Une adresse saisie à la main qu'un vérificateur ne trouve pas sur une carte ne compte pas.",
            noHomeAddress: 'Aucune adresse de domicile enregistrée.',
            notGeocoded: "« {{address}} » a été enregistrée sans coordonnées cartographiques. Recherchez-la de nouveau et choisissez-la dans la liste.",
        },

        document: {
            pdf: 'PDF',
            view: 'Voir {{label}}',
            remove: 'Supprimer {{label}}',
            unavailable: 'Chargement impossible',
            quotaBlocked: 'Limite de stockage atteinte',
            quotaBlockedLong: "Ce fichier est retenu parce que votre compte dépasse sa limite de stockage. Libérez de l'espace ou passez à une offre supérieure pour le revoir — le fichier n'a pas été supprimé.",
            save: 'Enregistrer une copie',
            saveFailed: "Impossible d'enregistrer le fichier.",
        },

        upload: {
            add: 'Ajouter',
            replace: 'Remplacer',
            remaining: '{{current}} sur {{max}} ajoutés',
            wrongType: "{{name}} n'est pas un fichier pris en charge. Utilisez un JPG, PNG, WebP ou PDF.",
            tooLarge: '{{name}} dépasse 10 Mo. Essayez une photo plus petite ou un scan de moindre qualité.',
            slotFull: "Vous pouvez ajouter jusqu'à {{max}} fichiers ici, et vous en avez déjà {{current}}. Supprimez-en un d'abord.",
            tooMany: 'Vous pouvez ajouter au maximum {{max}} fichiers à la fois.',
        },

        submit: {
            title: 'Envoyer pour examen',
            body: 'Quand vous êtes prêt, envoyez vos documents à un administrateur. Vos informations sont verrouillées pendant son examen.',
            resubmitBody: 'Corrigez ce que le vérificateur a signalé, puis renvoyez vos documents.',
            action: 'Envoyer pour examen',
            resubmitAction: 'Renvoyer',
            confirmTitle: 'Envoyer pour examen ?',
            confirmBody: 'Vos documents seront transmis à un administrateur.',
            confirmIncomplete: plural({
                one: 'Un élément demandé par les vérificateurs manque encore.',
                other: '{{count}} éléments demandés par les vérificateurs manquent encore.',
            }),
            confirmAction: 'Envoyer',
            freezeWarning: 'Une fois envoyés, vos documents ne pourront plus être modifiés avant la décision du vérificateur. Vous pourrez toujours consulter ce que vous avez envoyé.',
            unsavedWarning: "Vous avez des modifications non enregistrées ci-dessus. Enregistrez-les d'abord, sinon elles ne feront pas partie de votre envoi.",
        },
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
        add: 'Ajouter',
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
        phoneFlowHint:
            'Nous enverrons un code à six chiffres au nouveau numéro sur WhatsApp : utilisez donc un numéro qui a WhatsApp. La modification prend effet dès que vous saisissez le code. Vous avez 24 heures pour terminer.',
        phoneChangeCancelled: 'Modification du numéro annulée.',
        phonePendingNotice:
            "Continuez à vous connecter avec votre numéro actuel jusqu'à la confirmation.",

        verify: 'Vérifier',
        verified: 'Vérifié',
        verifyPrompt:
            "Votre numéro n'est pas encore vérifié. Le vérifier nous permet de vous joindre au sujet des commandes et des versements.",
        sendCode: 'Envoyer le code',
        resendCode: 'Envoyer un nouveau code',
        resendIn: 'Nouveau code dans {{seconds}} s',
        codeLabel: 'Code à six chiffres',
        codePlaceholder: '123456',
        codeSentTo: 'Nous avons envoyé un code sur WhatsApp au {{phone}}.',
        codeExpires: 'Il expire {{when}}.',
        codeCompletesChange:
            'En le saisissant, votre numéro de connexion devient le nouveau. Si WhatsApp était lié à votre ancien numéro, le lien passe aussi au nouveau.',
        codeVerifiesCurrent: 'En le saisissant, vous confirmez le numéro déjà associé à votre compte.',
        submitCode: 'Vérifier le numéro',
        attemptsLeft: plural({
            one: 'Il reste {{count}} tentative.',
            other: 'Il reste {{count}} tentatives.',
        }),
        codeSent: 'Code envoyé sur WhatsApp.',
        phoneVerified: 'Votre numéro de téléphone est vérifié.',
        phoneChangedAndVerified: 'Votre numéro de téléphone a été modifié et vérifié.',
        codeDeliveryHint:
            "Le code peut mettre une minute à arriver. S'il n'arrive pas, demandez-en un nouveau.",
        deliverySupportHint:
            'Toujours rien ? Notre équipe de support peut examiner le problème pour vous.',
        contactSupport: 'Contacter le support',

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
        updatedSignInAgain:
            'Mot de passe mis à jour. Reconnectez-vous avec votre nouveau mot de passe.',
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
            processing: 'En cours d’envoi',
            paid: 'Payé',
            rejected: 'Refusé',
            failed: 'Échec du paiement',
            unknown: 'En cours',
            noReason: 'Aucun motif n’a été enregistré. Ouvrez le ticket pour en savoir plus.',
        },
        statusNote: {
            pending:
                'Un administrateur examine votre demande. Le montant est retenu jusqu’à sa résolution.',
            processing:
                'Approuvée et transmise au prestataire de paiement. Le versement n’est pas encore confirmé — cette page se met à jour dès qu’il aboutit.',
            paid: 'Réglée — les fonds ont été envoyés vers votre moyen de versement enregistré.',
            rejected:
                'Cette demande a été clôturée et la totalité du montant est retournée dans votre solde disponible.',
            failed:
                'Le transfert a été refusé. Votre argent est toujours retenu — il n’est pas revenu dans votre solde disponible — et nous examinons la situation.',
            unknown:
                'Cette demande est toujours en cours de traitement. Ouvrez le ticket pour la dernière mise à jour.',
        },
        openRequest: {
            generic: 'Vous avez déjà une demande de retrait en cours — une seule à la fois.',
            failed:
                'Un transfert lié à votre demande en cours a été refusé. Nous examinons la situation — il n’y a rien à redemander.',
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
