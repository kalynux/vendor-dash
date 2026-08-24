/** Paramètres : politiques, canaux de notification, préférences de la boutique. */
export const settings = {
    title: 'Paramètres',
    subtitle: 'Configurez les politiques, les notifications et les préférences de votre boutique',

    tabSubtitles: {
        policies: 'Les conditions de retour, d’annulation et d’assistance affichées à vos clients',
        notifications: 'Les événements qui vous sont signalés, et par quel canal',
        preferences:
            'L’apparence du tableau de bord et les règles qui expédient ou annulent vos commandes',
    },

    preferences: {
        appearance: {
            title: 'Apparence',
            info: 'S’applique uniquement à ce tableau de bord, sur ce navigateur. « Système » suit le réglage clair/sombre de votre appareil.',
            theme: 'Thème',
            light: 'Clair',
            dark: 'Sombre',
            system: 'Système',
        },

        orderAutomation: {
            title: 'Automatisation des commandes',
            info: 'Deux règles automatiques qui gardent votre liste de commandes propre : l’une transmet les commandes payées à l’agence de livraison, l’autre annule les commandes jamais payées.',

            autoDispatch: 'Transmission automatique des commandes payées',
            autoDispatchHintLabel: 'À propos de la transmission automatique',
            autoDispatchHint: 'Dès qu’une commande physique est payée, elle part directement à l’agence de livraison concernée au lieu d’attendre dans votre file. Désactivé par défaut — laissez-le désactivé si vous voulez vérifier chaque commande avant expédition.',

            maxOrderTotal: 'Montant maximum de la commande',
            maxOrderTotalHintLabel: 'À propos du montant maximum',
            maxOrderTotalHint: 'Un plafond de sécurité. Réglez-le sur 50 000 et les commandes jusqu’à 50 000 partent seules, tandis qu’une commande de 75 000 reste en attente pour que vous la regardiez d’abord. Laissez-le vide et toutes les commandes payées partent, quel que soit le montant.',
            maxOrderTotalPlaceholder: 'Aucun plafond',

            autoCancel: 'Annulation automatique des commandes impayées',
            autoCancelHintLabel: 'À propos de l’annulation automatique',
            autoCancelHint: 'Les commandes toujours impayées après le nombre de jours ci-dessous sont annulées automatiquement et leur stock réservé est remis dans votre inventaire.',

            daysBeforeCancel: 'Jours avant annulation',
            daysBeforeCancelHintLabel: 'À propos du délai avant annulation',
            daysBeforeCancelHint: 'Combien de temps une commande impayée est conservée avant d’être annulée et son stock libéré. Réglez-le sur 3 et une commande passée lundi est annulée jeudi si elle est toujours impayée. Entre {{min}} et {{max}} jours.',
        },

        saved: 'Préférences enregistrées',
    },

    storefront: {
        title: 'Boutique',
        info: 'L’identité publique de votre boutique et vos contacts d’assistance.',
        loadFailed: 'Impossible de charger votre boutique.',

        bannerAlt: 'Bannière de la boutique',
        changeBanner: 'Changer la bannière',
        removeBanner: 'Supprimer la bannière',
        addBanner: 'Ajouter une bannière',
        addBannerPrompt: 'Cliquez pour ajouter une bannière — elle met votre boutique en valeur',
        logoAlt: 'Logo de la boutique',
        changeLogo: 'Changer le logo',
        removeLogo: 'Supprimer le logo',
        addLogo: 'Ajouter un logo',
        viewStore: 'Voir la boutique',

        preview: {
            action: 'Aperçu client',
            subtitle: 'Ce que voit un client',
            edit: 'Modifier la boutique',
            onVacation:
                'Votre boutique est en vacances — les clients peuvent toujours parcourir vos produits, mais ils voient un avis et ne peuvent pas commander.',
            noStoreTitle: 'Pas encore de boutique',
            noStoreHelp:
                'Votre boutique n’a pas été configurée : il n’existe donc pas de page client à prévisualiser. Renseignez les informations de votre boutique et l’aperçu apparaîtra ici.',
        },

        identity: {
            title: 'Identité de la boutique',
            info: 'Le nom et la description que les clients voient sur la page de votre boutique et dans les résultats de recherche. Changer le nom ici ne change pas l’URL de votre boutique.',
            name: 'Nom de la boutique',
            namePlaceholder: 'Le nom affiché de votre boutique',
            description: 'Description',
            descriptionPlaceholder: 'Dites aux clients ce qu’est votre boutique — ce que vous vendez, ce qui vous distingue',
            counter: '{{current}}/{{max}}',
        },

        support: {
            title: 'Assistance et contact',
            info: 'Comment les clients vous joignent pour des questions sur leurs commandes. Ces coordonnées sont publiées sur votre boutique — laissez un champ vide pour masquer ce canal.',
            email: 'E-mail d’assistance',
            emailPlaceholder: 'support@votreboutique.com',
            phone: 'Téléphone d’assistance',
            whatsapp: 'WhatsApp',
        },

        status: {
            title: 'Statut de la boutique',
            info: 'Fermez temporairement votre boutique sans rien supprimer. Pendant la fermeture, les clients voient un avis de congés, vos produits restent en ligne mais ne peuvent pas être commandés, et les commandes en cours ne sont pas affectées.',
            open: 'Ouverte',
            openTitle: 'Ouverte',
            openBody: 'Visible et acceptant les commandes.',
            closed: 'En congés',
            closedBody: 'Les clients voient un avis de congés ; les nouvelles commandes sont suspendues.',
            toggleLabel: 'Boutique ouverte',
            reopened: 'Boutique rouverte',
            closedToast: 'Mode congés activé — la boutique est maintenant fermée',
        },

        details: {
            title: 'Détails de la boutique',
            info: 'Propriétés fixes de votre boutique. Aucune ne se modifie ici — contactez le support si l’une d’elles est incorrecte.',
            publicUrl: 'URL publique',
            slug: 'Identifiant d’URL',
            slugHint: 'La dernière partie de l’URL de votre boutique. Elle est verrouillée car les liens existants, les QR codes et les publications partagées cesseraient de fonctionner — contactez le support s’il vous en faut une nouvelle.',
            country: 'Pays',
            countryHint: 'Défini une fois lors de la configuration et repris de votre profil vendeur. Il détermine la fiscalité, la livraison et les adresses que vous pouvez enregistrer.',
            lastUpdated: 'Dernière mise à jour',
            hintLabel: 'À propos de : {{label}}',
        },

        validation: {
            nameTooShort: 'Le nom de la boutique doit contenir au moins 2 caractères.',
            nameTooLong: 'Le nom de la boutique doit contenir au plus 100 caractères.',
        },

        saved: 'Boutique mise à jour',
        conflictReload: 'La boutique a été modifiée ailleurs. Données actualisées — veuillez réappliquer vos changements.',
        conflictRetry: 'La boutique a été modifiée ailleurs. Veuillez réessayer.',
        copyUrlFailed: 'Impossible de copier l’URL',
    },

    payout: {
        country: 'Pays',
        countryPlaceholder: 'Choisissez votre pays',
        timezone: 'Fuseau horaire',
        timezonePlaceholder: 'Choisissez votre fuseau horaire',

        methodsTitle: 'Moyens de versement',
        methodsHint:
            'Le premier moyen est utilisé par défaut — jusqu’à 3. Le nom du titulaire doit correspondre à celui enregistré chez le prestataire.',
        preferred: 'Préféré',
        paymentMethod: 'Moyen de paiement',

        mobileMoney: 'Mobile Money',
        bankTransfer: 'Virement bancaire',
        card: 'Carte',

        methodMobileMoney: 'Mobile Money',
        methodBank: 'Banque',
        methodCard: 'Carte',
        mobileMoneyHint: 'Portefeuille mobile',
        bankTransferHint: 'Compte bancaire',
        cardHint: 'Carte bancaire',
        methodSoonNote:
            '{{methods}} ne peuvent pas encore recevoir vos versements — nous y travaillons.',

        provider: 'Opérateur',
        phoneNumber: 'Numéro de téléphone',
        accountName: 'Nom du titulaire',
        mobileAccountNamePlaceholder: 'Nom sur le compte Mobile Money',
        bankAccountNamePlaceholder: 'Nom sur le compte bancaire',
        bankName: 'Nom de la banque',
        bankNamePlaceholder: 'ex. Afriland First Bank',
        accountNumber: 'Numéro de compte',
        accountNumberPlaceholder: 'IBAN ou numéro de compte local',
        bankCountry: 'Pays de la banque',
        bankCountryPlaceholder: 'Pays où la banque opère',

        cardBrand: 'Réseau de la carte',
        cardBrandPlaceholder: 'Choisissez le réseau de la carte',
        cardLast4: '4 derniers chiffres',
        cardLast4Placeholder: '4242',
        cardLast4Hint:
            'Nous ne demandons jamais le numéro complet de la carte ni le cryptogramme (CVV).',
        cardHolderName: 'Nom du titulaire',
        cardHolderPlaceholder: 'Nom tel qu’il figure sur la carte',
        cardExpiryMonth: 'Mois d’expiration',
        cardExpiryYear: 'Année d’expiration',
        cardMM: 'MM',
        cardYYYY: 'AAAA',
        cardCountry: 'Pays d’émission',
        cardCountryPlaceholder: 'Pays qui a émis la carte',
        issuingBank: 'Banque émettrice (facultatif)',
        issuingBankPlaceholder: 'ex. Afriland First Bank',
        cardSettlementNote: 'Traité manuellement, donc plus lent. Mobile Money est le plus rapide.',

        addMethod: 'Ajouter un moyen de versement',
        addTitle: 'Ajouter un moyen de versement',
        addDescription: 'Là où vos retraits sont envoyés.',
        editTitle: 'Modifier le moyen de versement',
        editDescription: 'Changez la destination de ce versement.',

        retired: 'À remplacer',
        retiredHint:
            'Cette destination ne peut plus être enregistrée. Remplacez-la par un compte mobile money — les versements déjà envoyés ne sont pas affectés.',
        replaceTitle: 'Remplacer le moyen de versement',
        replaceDescription:
            'Ce type de destination n’est plus accepté. Saisissez un compte mobile money pour le remplacer.',
        replaceAria: 'Remplacer {{label}}',
        saveMethod: 'Enregistrer le moyen',
        empty: 'Aucun moyen de versement. Ajoutez-en un pour que nous sachions où envoyer vos gains.',
        atLimit: 'Vous pouvez enregistrer jusqu’à {{max}} moyens de versement.',
        setPreferred: 'Définir comme préféré',
        setPreferredAria: 'Définir comme préféré : {{label}}',
        makePreferred: 'Définir comme préféré',
        makePreferredHint: 'Utilisé en premier pour chaque versement.',
        editAria: 'Modifier {{label}}',
        removeAria: 'Retirer {{label}}',
        removeTitle: 'Retirer ce moyen de versement ?',
        removeDescription:
            '{{label}} sera retiré. Rien ne change tant que vous n’enregistrez pas.',
        keepOne: 'Gardez au moins un moyen de versement.',
        incomplete: 'Incomplet',
        incompleteHint: 'Des informations manquent — ouvrez-le pour compléter.',

        paymentMethodsTitle: 'Moyens de paiement',
        paymentMethodsInfo1:
            'Là où vos retraits sont envoyés. Ajoutez jusqu’à 3 moyens — le premier est le moyen préféré, utilisé par défaut ; les autres servent de solutions de repli.',
        paymentMethodsInfo2: 'Le nom du compte doit correspondre à celui du prestataire, sinon le virement est rejeté.',
        saved: 'Configuration de versement mise à jour',
    },

    addresses: {
        title: 'Adresses professionnelles',
        info1:
            'Vos points de retrait physiques. Les clients ne verront aucun point de retrait sur vos produits tant que vous n’en aurez pas ajouté au moins un.',
        info2:
            'Chaque adresse ajoutée ou modifiée doit être choisie depuis la barre de recherche pour que nous puissions la localiser sur la carte, et elle doit se situer dans votre pays d’enregistrement.',
        info3:
            'Supprimer une adresse encore utilisée comme point de retrait par un produit bloquera l’enregistrement tant que ce produit n’aura pas été réaffecté.',
        saved: 'Adresses professionnelles mises à jour',
    },

    cities: {
        douala: 'Douala',
        lagos: 'Lagos',
        abidjan: 'Abidjan',
        dakar: 'Dakar',
        accra: 'Accra',
        nairobi: 'Nairobi',
        darEsSalaam: 'Dar es Salaam',
        kampala: 'Kampala',
        kigali: 'Kigali',
        cairo: 'Le Caire',
        johannesburg: 'Johannesbourg',
        paris: 'Paris',
        london: 'Londres',
        newYork: 'New York',
    },

    branding: {
        title: 'Image de marque',
        removeImage: 'Supprimer {{label}}',
        logo: 'Logo',
        logoHint: 'Image carrée, 200 × 200 px minimum recommandé',
        coverImage: 'Image de couverture',

        addressesTitle: 'Adresses professionnelles',
        addAddress: 'Ajouter une adresse',
        removeAddress: 'Supprimer l’adresse',
        noAddresses: 'Aucune adresse ajoutée. Les clients ne verront aucun point de retrait tant que vous n’en aurez pas ajouté une.',

        primaryAddress: 'Adresse principale',
        otherAddress: 'Adresse {{number}}',

        findAddressHintLabel: 'À propos de la recherche d’adresse',
        findAddressHint: 'Tapez une rue, un quartier ou une ville et choisissez un résultat — cela fixe les coordonnées exactes que nous transmettons aux agences de livraison. Les champs ci-dessous sont remplis pour vous et restent modifiables, mais les modifier sans choisir un nouveau résultat bloquera l’enregistrement.',
        searchPlaceholder: 'Recherchez une rue, un quartier ou une ville…',
        notPinned: 'Pas encore fixé.',

        label: 'Libellé',
        labelHintLabel: 'À propos du libellé d’adresse',
        labelHint: 'Votre propre nom pour cet emplacement, par exemple « Boutique principale » ou « Entrepôt ». C’est ainsi que vous choisissez un point de retrait au moment de publier un produit.',
        labelPlaceholder: 'ex. Boutique principale, Entrepôt',
        street: 'Adresse / point de repère',
        streetPlaceholder: '123 rue du Marché',
        line2: 'Complément d’adresse',
        line2Placeholder: 'Bureau 4B, 2e étage…',
        city: 'Ville',
        cityPlaceholder: 'Douala',
        state: 'Région / département',
        statePlaceholder: 'Littoral',
        fromMapResult: '· d’après le résultat de la carte',
        notNamedByMap: 'non précisé par le résultat de la carte',

        geoRequired: 'Recherchez et sélectionnez cette adresse pour que nous puissions la situer sur la carte.',
        geoCountryMismatch: 'Cette adresse doit se trouver dans votre pays d’enregistrement ({{country}}). Recherchez-la à nouveau à l’intérieur de {{country}}.',
        geoBlocked: 'Certaines adresses ont besoin d’un emplacement valide avant l’enregistrement.',

        removeConfirmTitle: 'Supprimer cette adresse ?',
        removeConfirmBody: 'Si elle est encore définie comme point de retrait sur un produit, l’enregistrement sera bloqué tant que vous n’aurez pas réaffecté ce produit.',

        clearPinTitle: 'Supprimer l’emplacement fixé ?',
        clearPinBody: 'C’est la coordonnée vers laquelle les agences de livraison se dirigent. Vous devrez rechercher l’adresse et la sélectionner à nouveau avant de pouvoir enregistrer.',
        clearPinAction: 'Supprimer l’emplacement',
    },

    policies: {
        tabTitle: 'Conditions',
        tabInfo1:
            'Les règles que voient vos clients sur votre vitrine et sur lesquelles le support s’appuie en cas de litige. Chaque champ ci-dessous a son propre pictogramme d’information expliquant ce qu’il modifie.',
        tabInfo2:
            'Désactiver entièrement une politique la supprime — votre boutique n’affiche alors aucune politique pour ce domaine, ce que les clients interprètent comme « non proposé ».',
        fieldHintLabel: 'Ce que ce champ change',
        enableSection: 'Activer {{title}}',

        return: {
            title: 'Politique de retour',
            subtitle: 'Comment vous gérez les retours et les remboursements',

            accept: 'Accepter les retours',
            acceptHintLabel: 'À propos de l’acceptation des retours',
            acceptHint: 'Activé, les clients voient un bouton « Demander un retour » sur les commandes livrées et les règles ci-dessous s’appliquent. Désactivé, votre boutique affiche « Aucun retour accepté » et tous les champs ci-dessous disparaissent.',

            windowDays: 'Délai de retour (jours)',
            windowDaysHint: 'Combien de temps après l’achat un client peut ouvrir un retour. Réglez-le sur 14 et une commande passée le 1er mars peut être retournée jusqu’au 15 mars — le 16, le bouton de retour a disparu. 0 signifie que les retours ferment immédiatement. Maximum 180.',

            refundType: 'Type de remboursement',
            refundTypeHint: 'Ce que le client récupère sur un retour accepté. Intégral → tout le prix de l’article. Partiel → uniquement le pourcentage défini ci-dessous (80 % d’une commande de 10 000 = 8 000 rendus). Aucun remboursement → le retour est accepté mais aucun argent n’est rendu, par exemple pour les boutiques en échange seulement.',
            refundTypeFull: 'Remboursement intégral',
            refundTypePartial: 'Remboursement partiel',
            refundTypeNone: 'Aucun remboursement',

            refundPercentage: 'Pourcentage remboursé (%)',
            refundPercentageHint: 'La part de la commande remboursée, de 0 à 100. À 80, une commande de 10 000 rembourse 8 000 et vous gardez 2 000 en frais de remise en stock. Obligatoire tant que le type de remboursement est Partiel.',
            refundPercentagePlaceholder: 'ex. 80',

            shippingPayer: 'Frais de retour payés par',
            shippingPayerHint: 'Qui paie le renvoi de l’article. Client → il paie, quelle que soit la raison. Vendeur (vous) → vous payez chaque retour, ce qui rassure sur la boutique mais vous coûte sur les retours pour changement d’avis. Client, remboursé si défectueux → il paie d’avance et vous ne remboursez les frais que si l’article était vraiment défectueux.',
            shippingPayerCustomer: 'Client',
            shippingPayerVendor: 'Vendeur (vous)',
            shippingPayerReimbursed: 'Client (remboursé si défectueux)',

            processingDays: 'Délai de traitement du remboursement (jours)',
            processingDaysHint: 'Jours ouvrés entre la réception de l’article retourné et le versement de l’argent. Réglez 5 et un colis reçu un lundi est remboursé le lundi suivant — c’est cette date qui est montrée au client, prévoyez donc une marge. Maximum 30.',

            conditionNotes: 'Conditions de retour',
            conditionNotesHint: 'Texte libre affiché à côté de votre politique de retour, par exemple « Non utilisé, dans son emballage d’origine, étiquette encore attachée. » Le support cite ce texte lorsqu’un retour est contesté, soyez donc précis. Laissez vide si vous n’avez pas de condition supplémentaire.',
            conditionNotesPlaceholder: 'ex. L’article doit être non utilisé et dans son emballage d’origine.',
        },

        cancellation: {
            title: 'Politique d’annulation',
            subtitle: 'Quand et comment les clients peuvent annuler leurs commandes',

            allow: 'Autoriser les annulations',
            allowHintLabel: 'À propos de l’autorisation des annulations',
            allowHint: 'Activé, les clients peuvent annuler eux-mêmes une commande passée selon les règles ci-dessous. Désactivé, le bouton d’annulation est masqué et ils doivent vous contacter — chaque annulation passe alors par le support.',

            deadline: 'Date limite d’annulation',
            deadlineHint: 'La limite pour une annulation gratuite. « Sous 24 heures » permet à quelqu’un ayant commandé lundi à 9 h d’annuler jusqu’à mardi 9 h ; après cela, les règles d’annulation tardive plus bas prennent le relais. « Avant confirmation du vendeur » ferme la fenêtre dès que vous acceptez la commande, elle se réduit donc à mesure que vous êtes rapide.',
            deadlinePlaceholder: 'Choisissez une date limite…',
            deadline1Hour: 'Dans l’heure suivant la commande',
            deadline24Hours: 'Dans les 24 heures suivant la commande',
            deadlineBeforeConfirmation: 'Avant que le vendeur confirme la commande',
            deadlineBeforeServiceStart: 'Avant la date/heure de début du service',
            deadlineDaysBeforeDelivery: 'À tout moment jusqu’à X jours avant la livraison',

            deadlineDays: 'Jours avant la livraison',
            deadlineDaysHint: 'Combien de jours avant la date de livraison l’annulation reste gratuite. À 3, une commande prévue vendredi peut être annulée jusqu’à mardi ; à partir du mercredi elle compte comme tardive.',
            deadlineDaysPlaceholder: 'ex. 3',

            fee: 'Frais d’annulation',
            feeHint: 'Ce que vous gardez quand un client annule dans les temps. Aucun frais → il récupère tout. Montant fixe → une somme forfaitaire, par exemple 500 sur une commande de 10 000 rembourse 9 500. Pourcentage → une part, par exemple 10 % rembourse 9 000. Montant total → rien n’est remboursé, ce qui n’a de sens que pour du sur-mesure.',
            feeNone: 'Aucun frais',
            feeFixed: 'Montant fixe',
            feePercentage: 'Pourcentage de la commande',
            feeFull: 'Montant total (non remboursable)',

            feeAmount: 'Montant des frais',
            feeAmountHint: 'La somme forfaitaire que vous gardez sur une annulation. À 500, une commande de 10 000 rembourse 9 500 et une commande de 2 000 rembourse 1 500 — les mêmes frais dans les deux cas, gardez-les donc modestes.',
            feeAmountPlaceholder: 'ex. 500',
            feePercentageValue: 'Pourcentage des frais (%)',
            feePercentageHint: 'La part de la commande que vous gardez, de 0 à 100. À 10, une commande de 10 000 rembourse 9 000 et une commande de 2 000 rembourse 1 800 — les frais suivent le montant de la commande.',
            feePercentagePlaceholder: 'ex. 10',

            lateRefund: 'Remboursement en cas d’annulation tardive',
            lateRefundHint: 'Ce qu’un client récupère lorsqu’il annule après la date limite ci-dessus. Laissez sur Aucun et les annulations tardives suivent les mêmes frais que les annulations dans les temps. Aucun remboursement → il ne récupère rien. Pourcentage remboursé → par exemple 50 rend 5 000 sur une commande de 10 000.',
            lateRefundNone: 'Aucun remboursement',
            lateRefundFixed: 'Montant fixe remboursé',
            lateRefundPercentage: 'Pourcentage remboursé',

            lateRefundAmount: 'Montant remboursé',
            lateRefundAmountHint: 'La somme forfaitaire rendue sur une annulation tardive. À 2 000, une commande de 10 000 rend 2 000 et vous gardez 8 000.',
            lateRefundPercentageValue: 'Pourcentage remboursé (%)',
            lateRefundPercentageHint: 'La part rendue sur une annulation tardive, de 0 à 100. À 50, une commande de 10 000 rend 5 000.',
        },

        support: {
            title: 'Politique d’assistance',
            subtitle: 'Comment les clients peuvent vous joindre pour être aidés',

            channels: 'Canaux d’assistance',
            channelsHint: 'Où les clients vous joignent pour être aidés. Ces coordonnées sont publiées sur votre boutique et jointes aux e-mails de commande, n’ajoutez donc que des adresses que vous consultez vraiment. Chaque type ne peut être ajouté qu’une fois, jusqu’à 4 au total.',
            addChannel: 'Ajouter un canal',
            noChannels: 'Aucun canal ajouté pour l’instant. Ajoutez-en au moins un pour que les clients puissent vous joindre.',
            removeChannel: 'Supprimer le canal {{type}}',
            channelEmail: 'E-mail',
            channelPhone: 'Téléphone',
            channelWhatsapp: 'WhatsApp',
            channelTelegram: 'Telegram',

            requiredInfo: 'Exigé du client',
            requiredInfoHint: 'Ce qu’un client doit joindre avant de pouvoir envoyer une demande d’assistance. Cocher « Photo / vidéo du produit » bloque le formulaire tant qu’il n’en a pas envoyé une — utile pour les réclamations de dommages, mais cela ralentit aussi quelqu’un qui pose une simple question.',
            requiredOrderNumber: 'Numéro de commande',
            requiredProductPhoto: 'Photo / vidéo du produit',
            requiredTrackingNumber: 'Numéro de suivi',

            availability: 'Disponibilité',
            availabilityHint: 'Quand vous répondez. Affichée en badge à côté de vos canaux d’assistance, elle fixe le délai de réponse que les clients attendent. Choisissez « Limitée » pour préciser vos horaires exacts dans le champ qui apparaît.',
            availabilityPlaceholder: 'Choisissez une disponibilité…',
            availability247: '24 h/24, 7 j/7',
            availabilityBusinessHours: 'Heures de bureau',
            availabilityLimited: 'Limitée (à préciser ci-dessous)',

            availabilityDescription: 'Description de la disponibilité',
            availabilityDescriptionHint: 'Vos horaires exacts, montrés aux clients mot pour mot — par exemple « Lun–Ven, 10:00–18:00 (WAT), fermé les jours fériés. »',
            availabilityDescriptionPlaceholder: 'ex. Lun–Ven, 10:00–18:00',

            languages: 'Langues',
            languagesHint: 'Les langues dans lesquelles vous pouvez réellement mener une conversation d’assistance. Tapez-en une et appuyez sur Entrée ou +, par exemple English, puis Français. Jusqu’à 20. C’est ce que les clients filtrent, n’indiquez donc pas une langue dans laquelle vous ne pouvez pas répondre.',
            languagesPlaceholder: 'ex. Français',
            removeLanguage: 'Supprimer {{language}}',

            eligibilityNotes: 'Conditions d’éligibilité',
            eligibilityNotesHint: 'Qui a droit à l’assistance, par exemple « Uniquement les commandes des 90 derniers jours » ou « Les commandes en gros sont traitées par votre gestionnaire de compte. » Affiché sous votre politique d’assistance.',
            eligibilityNotesPlaceholder: 'ex. Uniquement les clients avec une commande valide.',
        },

        documents: {
            title: 'Documents de politique',
            subtitle: 'PDF justificatifs facultatifs (2 maximum, 5 Mo chacun)',
            upload: 'Envoyer un document',
            remove: 'Supprimer le document',
            uploadFailed: 'Impossible d’envoyer le document. Veuillez réessayer.',
        },
    },
};

export default settings;
