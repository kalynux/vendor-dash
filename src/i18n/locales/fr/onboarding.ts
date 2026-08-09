/** Assistant d'inscription vendeur en quatre étapes. */
export const onboarding = {
    stepLabel: 'Étape {{current}} sur {{total}}',
    loading: 'Configuration de votre compte…',

    steps: {
        basicSetup: 'Informations de base',
        deliveryLinking: 'Livraison',
        branding: 'Identité',
        policySetup: 'Politiques',
    },

    stepSublabels: {
        basicSetup: 'Pays, fuseau horaire et versements',
        deliveryLinking: 'Associer une agence de livraison',
        branding: 'Logo et adresses (facultatif)',
        policySetup: 'Retours, annulations et support (facultatif)',
    },

    layout: {
        brand: 'Jovi Mall',
        goBack: 'Retour',
        goBackTo: 'Revenir à {{step}}',
        progress: 'Progression de l’inscription',
        signOut: 'Se déconnecter',
    },

    optional: 'Cette étape est facultative',
    saveAndFinish: 'Enregistrer et terminer',
    continuing: 'Poursuite…',

    basicSetup: {
        heading: 'Informations de base',
        subheading: 'Dites-nous où vous opérez et comment vous souhaitez être payé.',
        saved: 'Informations de base enregistrées !',
        title: 'Dites-nous où vous opérez',
        description: 'Votre pays détermine vos règles de taxe, de livraison et d’adresse. Il ne pourra pas être modifié ensuite.',
        country: 'Pays',
        countryPlaceholder: 'Sélectionnez votre pays',
        countryLocked: 'Choisi une seule fois, puis verrouillé — contactez le support si cela doit changer.',
        timezone: 'Fuseau horaire',
        timezonePlaceholder: 'Sélectionnez votre fuseau horaire',
        payoutTitle: 'Comment souhaitez-vous être payé ?',
        payoutDescription: 'Vous pourrez ajouter d’autres modes plus tard depuis la configuration des versements.',
    },

    deliveryLinking: {
        heading: 'Association de la livraison',
        askProductType: 'Vendez-vous des produits physiques à expédier ?',
        physicalSubheading:
            'Les agences de livraison se connectent indépendamment de la configuration — c’est facultatif.',
        serviceSubheading: 'Aucune livraison nécessaire pour votre activité.',
        physicalOption: 'Oui, je vends des produits physiques',
        physicalOptionHint:
            'J’ai besoin d’une agence de livraison pour expédier les commandes à mes clients.',
        serviceOption: 'Non, je propose uniquement des services',
        serviceOptionHint: 'Mon activité est de service — aucune expédition physique nécessaire.',
        serviceOnlyTitle: 'Vendeur de services uniquement',
        serviceOnlyDescription:
            'Aucune agence de livraison nécessaire. Cette étape sera ignorée et vous pourrez passer ' +
            'à la suivante. Vous pourrez toujours associer une agence plus tard depuis les Paramètres.',
        headStartTitle: 'Prenez de l’avance (facultatif)',
        headStartDescription:
            'Les agences de livraison exigent désormais un accord — demandez une connexion dès ' +
            'maintenant pour que le délai d’approbation se déroule en parallèle du reste de la ' +
            'configuration, ou faites-le plus tard depuis Paramètres → Livraison. Dans tous les cas, ' +
            'ce n’est pas nécessaire pour continuer.',
        switchToService: 'Je ne vends que des services — passer cette étape',
        switchToPhysical: 'En fait, je vends aussi des produits physiques',
        stepComplete: 'Étape terminée !',
        title: 'Choisissez une agence de livraison',
        description: 'Les agences acheminent vos commandes physiques. Vous pourrez en connecter d’autres plus tard, ou passer cette étape.',
        skip: 'Passer pour l’instant',
        selected: 'Sélectionnée',
        noAgencies: 'Aucune agence de livraison n’est encore disponible dans votre zone.',
    },

    branding: {
        heading: 'Identité et adresses',
        subheading:
            'Facultatif — ajoutez votre logo et l’adresse de votre boutique pour offrir une meilleure ' +
            'expérience à vos clients. Vous pourrez toujours le faire plus tard.',
        profileComplete: 'Profil complet ! Bienvenue 🎉',
        setupComplete: 'Configuration terminée ! Bienvenue sur le tableau de bord 🎉',
        title: 'Personnalisez votre boutique',
        description: 'Ajoutez un logo et une bannière pour que vos clients vous reconnaissent.',
        logo: 'Logo',
        banner: 'Bannière',
        businessName: 'Nom de l’entreprise',
        businessDescription: 'Que vendez-vous ?',
        addressTitle: 'Adresse professionnelle',
        addressDescription: 'D’où vous expédiez vos commandes. Elle doit se trouver dans votre pays enregistré.',
    },

    policySetup: {
        heading: 'Configuration des politiques',
        subheading:
            'Définissez les politiques de retour, d’annulation et de support de votre boutique. ' +
            'Toutes les sections sont facultatives et modifiables plus tard depuis votre tableau de bord.',
        setupComplete: 'Configuration terminée ! Bienvenue sur votre tableau de bord.',
        title: 'Définissez vos politiques',
        description: 'Le fonctionnement des retours, des annulations et du support pour vos clients.',
        returnPolicy: 'Politique de retour',
        cancellationPolicy: 'Politique d’annulation',
        supportContact: 'Contact du support',
    },

    guard: {
        checkingSession: 'Vérification de votre session…',
        signInRequired: 'Connectez-vous pour continuer.',
    },

    router: {
        unknownStepTitle: 'État d’inscription inattendu',
        unknownStepDescription:
            'Le serveur a renvoyé une étape d’inscription inconnue ({{step}}). Contactez le support ' +
            'si le problème persiste.',
        unknownStepNone: 'aucune',
    },

    errorBoundary: {
        title: 'Une erreur est survenue',
        description:
            'Une erreur inattendue s’est produite. Votre progression est enregistrée — vous pouvez réessayer en toute sécurité.',
        reload: 'Actualiser',
    },

    errors: {
        continueFailed: 'Impossible de continuer. Réessayez.',
        saveFailed: "Nous n'avons pas pu enregistrer cette étape. Réessayez.",
        skipFailed: 'Impossible de passer cette étape. Réessayez.',
    },

    toast: {
        stepSaved: 'Enregistré',
        completed: 'Votre boutique est prête',
    },

    validation: {
        providerRequired: 'Le fournisseur est obligatoire',
        accountNameRequired: 'Le nom du titulaire est obligatoire',
        bankNameRequired: 'Le nom de la banque est obligatoire',
        accountNumberRequired: 'Le numéro de compte est obligatoire',
        cardBrandRequired: 'Choisissez le réseau de la carte',
        cardLast4: 'Saisissez les 4 derniers chiffres de la carte',
        cardHolderRequired: 'Le nom du titulaire est requis',
        cardExpiryMonthRequired: 'Choisissez le mois d’expiration',
        cardExpiryYearRequired: 'Choisissez l’année d’expiration',
        cardExpired: 'Cette carte est déjà expirée',
        issuingBankMax: 'La banque émettrice doit contenir au plus 100 caractères',
        countryIso2: 'Doit être un code pays valide à 2 lettres',
        countryIso2Letters: 'Doit être un code pays à 2 lettres',
        timezoneRequired: 'Le fuseau horaire est obligatoire',
        payoutMethodMin: 'Au moins un moyen de versement est requis',
        payoutMethodMax: 'Vous pouvez ajouter au maximum 3 moyens de versement',
        labelRequired: 'Le libellé est obligatoire',
        labelMax: 'Le libellé ne doit pas dépasser 50 caractères',
        addressRequired: 'L’adresse est obligatoire',
        addressMax: 'L’adresse ne doit pas dépasser 200 caractères',
        cityRequired: 'La ville est obligatoire',
        cityMax: 'La ville ne doit pas dépasser 100 caractères',
        stateMax: 'La région ne doit pas dépasser 100 caractères',
        min0: 'Doit être supérieur ou égal à 0',
        min1: 'Doit être supérieur ou égal à 1',
        max180Days: 'Doit être inférieur ou égal à 180 jours',
        max30Days: 'Doit être inférieur ou égal à 30 jours',
        max500Chars: 'Ne doit pas dépasser 500 caractères',
        max200Chars: 'Ne doit pas dépasser 200 caractères',
        max50Chars: 'Ne doit pas dépasser 50 caractères',
        refundPercentageRequired:
            'Le pourcentage de remboursement est obligatoire pour un remboursement partiel',
        daysRequired: 'Le nombre de jours est obligatoire',
        feeValueRequired: 'Le montant des frais est obligatoire',
        refundValueRequired: 'Le montant du remboursement est obligatoire',
        contactRequired: 'Le contact est obligatoire',
        maxChannels: 'Vous pouvez ajouter au maximum 4 canaux d’assistance',
        maxLanguages: 'Vous pouvez ajouter au maximum 20 langues',
        maxDocuments: 'Vous pouvez téléverser au maximum 2 documents',
    },
};

export default onboarding;
