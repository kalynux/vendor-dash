import { plural } from '../../types';

/** Catalogue produits : liste, assistant, variantes, médias, livraison numérique. */
export const products = {
    title: 'Produits',
    subtitle: 'Gérez votre catalogue de produits',

    empty: {
        title: 'Aucun produit trouvé',
        description: 'Ajoutez votre premier produit pour commencer à vendre.',
        filtered: 'Aucun produit ne correspond à vos filtres.',
        addFirst: 'Ajoutez votre premier produit',
    },

    search: {
        placeholder: 'Rechercher des produits…',
        filterTitle: 'Filtrer les produits',
        applyLabel: 'Afficher les produits',
    },

    columns: {
        product: 'Produit',
        sku: 'SKU',
        price: 'Prix',
        stock: 'Stock',
        status: 'Statut',
        type: 'Type',
        updated: 'Modifié',
        actions: 'Actions',
        name: 'Nom',
        images: 'Images',
    },

    status: {
        draft: 'Brouillon',
        active: 'Actif',
        published: 'Publié',
        archived: 'Archivé',
        outOfStock: 'Rupture de stock',
        pendingReview: 'En attente de validation',
        suspended: 'Suspendu',
    },

    type: {
        physical: 'Physique',
        digital: 'Numérique',
        service: 'Service',
    },

    actions: {
        addProduct: 'Ajouter un produit',
        addSimple: 'Produit simple',
        addAdvanced: 'Produit avancé',
        editProduct: 'Modifier le produit',
        duplicate: 'Dupliquer',
        publish: 'Publier',
        unpublish: 'Dépublier',
        archive: 'Archiver',
        archiveSelected: 'Archiver la sélection',
        restore: 'Restaurer',
        importCsv: 'Importer un CSV',
        exportCsv: 'Exporter en CSV',
        preview: 'Aperçu',
        convertToAdvanced: 'Convertir en avancé',
        convertToAdvancedEditor: 'Passer à l’éditeur avancé',
        productActions: 'Actions du produit',
        clearFilters: 'Effacer les filtres',
        gridView: 'Vue en grille',
        listView: 'Vue en liste',
    },

    bulk: {
        selected: plural({
            one: '{{count}} produit sélectionné',
            other: '{{count}} produits sélectionnés',
        }),
        archiveTitle: 'Archiver les produits sélectionnés ?',
        archiveDescription:
            'Les produits archivés sont masqués de votre vitrine. Vous pourrez les restaurer plus tard.',
        confirm: plural({
            one: 'Archiver {{count}} produit ?',
            other: 'Archiver {{count}} produits ?',
        }),
        partial:
            '{{success}} produit(s) archivé(s) sur {{total}} — {{failed}} ignoré(s) (seuls les produits en brouillon ou actifs peuvent être archivés).',
        done: plural({
            one: '{{count}} produit archivé.',
            other: '{{count}} produits archivés.',
        }),
    },

    fields: {
        title: 'Titre',
        titlePlaceholder: 'ex. Casque Bluetooth sans fil',
        description: 'Description',
        descriptionPlaceholder: 'Décrivez ce qui rend ce produit intéressant…',
        price: 'Prix',
        compareAtPrice: 'Prix barré',
        cost: 'Coût unitaire',
        sku: 'SKU',
        barcode: 'Code-barres',
        stock: 'Stock',
        lowStockThreshold: 'Seuil de stock faible',
        weight: 'Poids',
        category: 'Catégorie',
        tags: 'Étiquettes',
        images: 'Images',
        pickupLocation: 'Point de retrait',
        deliveryAgency: 'Agence de livraison',
        photos: 'Photos',
        productName: 'Nom du produit',
        namePlaceholder: 'ex. Nike Air Max 90',
        descriptionHelp: 'Décrivez votre produit — matériaux, caractéristiques, usages…',
        descriptionRequired: 'Obligatoire — un produit sans description ne peut pas être publié.',
        categoryPlaceholder: 'ex. Vêtements, Électronique, Chaussures',
        compareAtOptional: 'Facultatif',
        compareAtHigherHint: 'Affiché barré lorsqu’il est supérieur au prix.',
        compareAtTooLowHint:
            'Les clients ne voient une remise que si ce montant est supérieur au prix.',
        bargainMaxPrice: 'Négociable jusqu’à',
        bargainOptional: 'Facultatif — pas de négociation',
        bargainHint:
            'Les acheteurs peuvent proposer un montant entre votre prix et ce plafond. Laissez vide pour désactiver la négociation.',
        bargainInertHint:
            'Les acheteurs peuvent proposer un montant entre votre prix et ce plafond. Cela s’active dès que vous activez la découverte par IA pour ce produit.',
        unlimitedStock: 'Stock illimité',
        unlimitedStockHint: 'Ne s’épuise jamais.',
        unlimitedStockLockedHint:
            'Une agence entrepose ce produit, et un entrepôt détient une quantité chiffrée. Remettez le retrait à votre propre adresse pour utiliser le stock illimité.',
        moreOptions: 'Plus d’options',
        skuPlaceholderEdit: 'SKU du produit',
        skuPlaceholderCreate: 'Laissez vide pour en générer un automatiquement',
        skuHintEdit:
            'Les commandes et votre vitrine référencent ce SKU. Ne le modifiez qu’en connaissance de cause.',
        skuHintCreate: 'Les SKU sont uniques sur toute la plateforme.',
        lowStockAlertAt: 'Alerte de stock faible à',
        noAlert: 'Aucune alerte',
        allowOversell: 'Autoriser la survente',
        allowOversellHint: 'Accepter les commandes au-delà de votre stock.',
        addTagPlaceholder: 'Ajoutez une étiquette, puis Entrée ou virgule',
        dimensionsTitle: 'Poids et dimensions (facultatif)',
        weightG: 'Poids (g)',
        lengthCm: 'Longueur (cm)',
        widthCm: 'Largeur (cm)',
        heightCm: 'Hauteur (cm)',
        seoTitle: 'SEO (facultatif)',
        seoTitleLabel: 'Titre SEO',
        seoTitlePlaceholder: 'Laissez vide pour utiliser le nom du produit',
        seoTitlePlaceholderWizard: 'Laissez vide pour utiliser le titre du produit',
        seoDescriptionLabel: 'Description SEO',
        seoDescriptionPlaceholder: 'Brève description pour les moteurs de recherche',
        charCount: '({{used}}/{{max}})',
        photosHint:
            'Jusqu’à {{max}}. La première est votre vignette — faites glisser pour réorganiser.',
    },

    variants: {
        title: 'Variantes',
        description: 'Des options comme la taille ou la couleur créent une variante par combinaison.',
        addOption: 'Ajouter une option',
        optionName: 'Nom de l’option',
        optionValues: 'Valeurs',
        count: plural({ one: '{{count}} variante', other: '{{count}} variantes' }),
        defaultVariant: 'Variante par défaut',
        empty: 'Aucune variante. Ajoutez une option pour les générer.',
    },

    variantTable: {
        options: 'Options',
        autoSku: 'SKU auto',
        bulkEdit: 'Édition groupée',
        setForAll: 'Appliquer à tout :',
        empty: 'Aucune variante. Modifiez les options pour générer la matrice.',
        saved: '{{count}} enregistrée(s)',
        new: '{{count}} nouvelle(s)',
        modified: '{{count}} modifiée(s)',
        allSaved: 'Tout est enregistré',
        saveChanges: plural({
            one: 'Enregistrer {{count}} modification',
            other: 'Enregistrer {{count}} modifications',
        }),
        more: 'Plus',
        less: 'Moins',
        moreDetails: 'Plus de détails',
        hideDetails: 'Masquer les détails',
        unlimited: 'Illimité (∞)',
        rowStatus: {
            persisted: 'Enregistrée',
            new: 'Nouvelle',
            modified: 'Modifiée',
            removed: 'Supprimée',
        },
        secondary: {
            compareAtPrice: 'Prix barré',
            infiniteStock: 'Stock illimité',
            lowStockAlert: 'Alerte de stock faible',
            allowOversell: 'Autoriser la survente',
            nonePlaceholder: 'Aucune',
        },
    },

    bargain: {
        title: 'Négociation du prix',
        description:
            'Les acheteurs peuvent proposer un montant entre le prix et le plafond que vous fixez ici. Laissez une ligne vide pour désactiver la négociation.',
        ceilingLabel: 'Négociable jusqu’à',
        ceilingPlaceholder: 'Pas de négociation',
        badge: 'Négociable jusqu’à {{max}}',
        inertHint: 'Enregistré, mais actif uniquement si la découverte par IA est activée.',
        clearHint: 'Videz un champ pour retirer la négociation sur cette variante.',
    },

    options: {
        title: 'Options et variantes',
        description:
            'Définissez les options du produit (ex. Taille, Couleur), puis configurez le SKU, le prix et le stock de chaque combinaison.',
        skuPrefix: 'Préfixe SKU',
        skuPrefixPlaceholder: 'ex. TSHIRT',
        skuPrefixHint: 'Les SKU générés automatiquement commenceront par ce préfixe',
        namePlaceholder: 'Nom de l’option (ex. Couleur, Taille)',
        addOption: 'Ajouter une option',
        maxOptions: 'Maximum de {{max}} options par produit',
        valuePlaceholder: 'Ajoutez une valeur, puis Entrée',
        noValues: 'Aucune valeur ajoutée',
        preview: 'Aperçu des variantes',
        willGenerate: plural({
            one: '{{count}} variante sera générée',
            other: '{{count}} variantes seront générées',
        }),
        addValuesToGenerate: 'Ajoutez des valeurs pour générer des variantes',
        exceedsLimit: 'Dépasse le maximum de {{max}} variantes',
        applyAndGenerate: 'Appliquer et générer les variantes',
        renamedUnsaved: 'Renommée (non enregistrée)',
        savedMarker: 'Enregistrée',
    },

    regenerate: {
        titleDestructive: 'Régénérer les variantes ?',
        title: 'Générer les variantes',
        descriptionDestructive:
            'Régénérer la matrice des variantes modifiera les variantes existantes. Vérifiez les changements ci-dessous.',
        description: plural({
            one: '{{count}} variante sera générée à partir de vos options.',
            other: '{{count}} variantes seront générées à partir de vos options.',
        }),
        keep: plural({
            one: 'Conserver {{count}} variante inchangée',
            other: 'Conserver {{count}} variantes inchangées',
        }),
        create: plural({
            one: 'Créer {{count}} nouvelle variante',
            other: 'Créer {{count}} nouvelles variantes',
        }),
        archive: plural({
            one: 'Archiver {{count}} variante',
            other: 'Archiver {{count}} variantes',
        }),
        andMore: 'et {{count}} de plus…',
        savedBadge: 'enregistrée',
        skuHint: '(SKU : {{sku}})',
        archiveNote:
            'Les variantes archivées seront retirées de la vitrine, mais leurs données sont conservées.',
        applying: 'Application…',
        confirmDestructive: 'Confirmer et régénérer',
        confirm: 'Générer les variantes',
    },

    wizard: {
        stepBasics: 'Essentiel',
        stepMedia: 'Médias',
        stepVariants: 'Variantes',
        stepDelivery: 'Livraison',
        stepDigital: 'Fichiers numériques',
        stepReview: 'Vérification',
        stepType: 'Type',
        stepBasicInfo: 'Informations',
        stepFormats: 'Formats',
        createTitle: 'Créer un produit',
        createSubtitle: 'Ajoutez un nouveau produit à votre boutique',
        editTitle: 'Modifier le produit',
        quickBadge: 'Rapide',
        backToProducts: 'Produits',
        saveDraft: 'Enregistrer le brouillon',
        publishNow: 'Publier maintenant',
        reviewTitle: 'Vérifier et publier',
        saveAndContinue: 'Enregistrer et continuer',
        basicsTitle: 'Informations de base',
        basicsDescription:
            'Les détails essentiels de votre produit. Vous pourrez les modifier plus tard.',
        productTitle: 'Titre du produit',
        productTitlePlaceholder: 'ex. T-shirt classique en coton',
        categoryPlaceholder: 'ex. Vêtements, Électronique, Téléchargements numériques',
        modeTitle: 'Comment souhaitez-vous ajouter ce produit ?',
        modeQuick: 'Rapide',
        modeQuickDescription: 'Un prix, un stock. Prêt en une minute.',
        modeAdvanced: 'Avancé',
        modeAdvancedDescription:
            'Options, variantes, images par variante et formats numériques.',
        typeTitle: 'Que vendez-vous ?',
        typePhysicalDescription: 'Un article que vous expédiez au client.',
        typeDigitalDescription: 'Un fichier que le client télécharge après paiement.',
        lockedIndexing:
            'Le produit est en cours d’indexation pour la recherche IA. La modification est temporairement désactivée — allez à l’étape Vérification pour actualiser le statut.',
        suspendedNotice:
            'Ce produit est suspendu à cause d’un problème d’agence de livraison. Vous pouvez toujours le modifier — lui attribuer une agence opérationnelle à l’étape Vérification le rétablit automatiquement.',
    },

    review: {
        title: 'Vérifier et publier',
        description:
            'Vérifiez votre produit avant de le publier. Vous pouvez toujours l’enregistrer en brouillon et le publier plus tard.',
        summaryFormats: 'Formats',
        summaryVariants: 'Variantes',
        summaryImages: 'Images',
        summaryDownloads: 'Téléchargements',
        downloadsPaused: 'En pause',
        downloadsEnabled: 'Activés',
        formatsLive: '{{total}} · {{live}} en ligne',
        tags: 'Étiquettes',
        requirements: 'Conditions de publication',
        requirementsMet: 'Toutes les conditions sont remplies — prêt à publier',
        keepAsDraft: 'Garder en brouillon',
        publishing: 'Publication…',
        vectorisationTitle: 'Activer la vectorisation IA',
        vectorisationDescription:
            'Lorsque cette option est activée et que le produit est complet et actif, ses données sont envoyées pour vectorisation afin que les clients le trouvent via la recherche IA. Le statut et les options de relance sont disponibles depuis la fiche produit.',
        lockedIndexing:
            'Ce produit est en cours d’indexation pour la recherche IA. La modification est temporairement désactivée.',
        archivedNotice:
            'Ce produit est archivé et en lecture seule. Restaurez-le en brouillon depuis la liste des produits pour le modifier ou le publier.',
        pendingReviewNotice:
            'Ce produit attend la validation d’un administrateur et reste en lecture seule jusqu’à la fin de la modération.',
        suspendedNotice:
            'Ce produit est suspendu à cause d’un problème d’agence de livraison. Vous pouvez toujours le modifier — lui attribuer une agence opérationnelle le rétablit automatiquement.',
    },

    activation: {
        notCreated: 'Le produit n’a pas encore été créé',
        noDescription: 'Une description du produit est obligatoire',
        noActiveVariant: 'Au moins une variante active est requise',
        noDigitalAsset: 'Téléversez un fichier pour au moins un format avant de publier',
        zeroPrice: 'Toutes les variantes actives doivent avoir un prix supérieur à 0',
        noDefaultVariant: 'Une variante par défaut doit être définie',
        noAgency: 'Une agence de livraison doit être attribuée avant la publication',
        noPickupLocation: 'Un point de retrait doit être défini avant la publication',
        agencyStorageInfiniteStock:
            'Désactivez le stock illimité sur chaque variante active — un produit entreposé chez une agence a besoin d’une quantité chiffrée',
        cannotPublishTitle: 'Publication impossible pour l’instant',
        cannotPublishDescription: 'Corrigez les points suivants avant de publier <0>{{name}}</0> :',
    },

    blockers: {
        savedAsDraft: 'Enregistré en brouillon',
        demoted: 'Ce produit est repassé en brouillon',
        done: 'Terminé, retour aux produits',
        retryPublish: 'Réessayer de publier',
    },

    transitions: {
        activate: 'Publier le produit',
        demote_to_draft: 'Repasser en brouillon',
        restore: 'Restaurer en brouillon',
        archive: 'Archiver le produit',
        confirmTitle: '{{action}} ?',
        confirm: {
            activate: 'Publier ce produit ? Il sera immédiatement visible dans votre vitrine.',
            demote_to_draft:
                'Repasser ce produit en brouillon ? Il sera retiré de votre vitrine jusqu’à sa republication.',
            restore:
                'Restaurer ce produit depuis les archives ? Il repassera en brouillon pour que vous puissiez le modifier.',
            archive: 'Archiver ce produit ? Il n’apparaîtra plus dans votre boutique.',
            archiveActive:
                'Archiver ce produit en ligne ? Il sera immédiatement retiré de votre vitrine.',
        },
        cta: {
            activate: 'Publier',
            demote_to_draft: 'Repasser en brouillon',
            restore: 'Restaurer',
            archive: 'Archiver',
        },
        confirmBody: '{{name}} — {{message}}',
    },

    archiveDialog: {
        title: 'Archiver le produit ?',
        description: 'Archiver <0>{{name}}</0> ? Il n’apparaîtra plus dans votre boutique.',
        keep: 'Conserver le produit',
        confirm: 'Oui, archiver',
    },

    simple: {
        createTitle: 'Nouveau produit',
        createSubtitle:
            'L’essentiel uniquement. Vous pourrez passer à l’éditeur avancé plus tard.',
        editTitle: 'Modifier le produit',
        savePublish: 'Enregistrer et publier',
        saving: 'Enregistrement…',
        publishing: 'Publication…',
        convertTitle: 'Passer à l’éditeur avancé ?',
        convertDescription:
            'L’éditeur avancé ajoute les options, les variantes et les images par variante. <0>{{name}}</0> conserve tout ce qu’il a déjà, mais le changement est irréversible.',
        convertConfirm: 'Passer en avancé',
        convertSuccess: 'Basculé vers l’éditeur avancé.',
        convertFailed: "Nous n'avons pas pu convertir ce produit. Réessayez.",
        readOnlyIndexing:
            'Ce produit est en cours d’indexation pour la recherche IA : il est en lecture seule un instant.',
        readOnlyArchived:
            'Les produits archivés sont en lecture seule. Restaurez-le en brouillon pour le modifier.',
        readOnlyPendingReview:
            'Ce produit attend une validation et reste en lecture seule jusqu’à la fin de la modération.',
        imageNotYours: 'L’une de ces images ne vous appartient pas.',
        saveDraftInstead: 'Enregistrer en brouillon à la place',
        nothingToSave: 'Rien à enregistrer.',
        aiSearchTitle: 'Recherche IA',
        aiSearchDescription:
            'Indexez ce produit pour que les clients le trouvent via la recherche IA. S’applique une fois le produit actif et complet.',
        suspendedNotice:
            'Ce produit est suspendu à cause d’un problème d’agence de livraison. Vous pouvez toujours le modifier — lui attribuer une agence opérationnelle ci-dessous le rétablit automatiquement.',

        stockQueued:
            'Enregistré. La modification de stock ({{from}} → {{to}}) est en attente de validation de l’agence de stockage.',
        stockQueuedNotice: '{{from}} → {{to}} · en attente de validation de l’agence',
        stockQueuedHint:
            'Une agence entrepose ce produit : la quantité ci-dessus est donc celle qu’elle a enregistrée tant que votre modification n’est pas validée.',
        viewStockRequest: 'Voir la demande',
        withdrawStockRequest: 'Retirer',
        stockRequestWithdrawn: 'Demande retirée — vous pouvez proposer une nouvelle quantité.',
    },

    digital: {
        formatIndex: 'Format {{index}}',
        formatName: 'Nom du format',
        formatNamePlaceholder: 'ex. Édition PDF',
        skuPlaceholder: 'JS-COURSE-PDF',
        generateSku: 'Générer',
        generateSkuHint: 'Générer un SKU à partir du nom du produit et du fichier',
        generateSkuBlocked: 'Renseignez d’abord le nom du produit',
        compareAt: 'Prix barré',
        downloadableFile: 'Fichier téléchargeable',
        uploadToSell: 'Téléversez un fichier pour mettre ce format en vente.',
        previewImage: 'Image d’aperçu (facultatif)',
        previewImageAlt: 'Aperçu du format',
        previewImageHint: 'Une vignette présentée aux acheteurs pour ce format.',
        addPreviewImage: 'Ajouter une image d’aperçu',
        replaceImage: 'Remplacer',
        removeFormat: 'Supprimer le format',
        downloadLimits: 'Limites de téléchargement (facultatif)',
        maxDownloads: 'Téléchargements max.',
        maxDownloadsPlaceholder: 'Illimité',
        expiresAfter: 'Expire après (jours)',
        expiresAfterPlaceholder: 'Jamais',
        active: 'Actif',
        badge: {
            fileReady: 'Fichier prêt',
            needsFile: 'Fichier manquant',
            live: 'En ligne',
            paused: 'En pause',
        },
        toggle: {
            needsFile: 'Téléversez un fichier avant d’activer ce format',
            pause: 'Mettre ce format en pause',
            activate: 'Activer ce format',
        },
        activateNeedsFile: 'Téléversez un fichier avant d’activer ce format.',
        statusUpdateFailed: 'Impossible de mettre à jour le statut du format.',
        addFormat: 'Ajouter un format',
        formatLimit: 'Un produit numérique peut avoir au maximum {{max}} formats.',
        assetDropHint: 'Déposez un fichier ici, ou cliquez pour parcourir',
        assetReplace: 'Remplacer le fichier',
    },

    ai: {
        notIndexed: 'Non indexé',
        indexing: 'Indexation…',
        ready: 'Recherche IA prête',
        failed: 'Échec de l’indexation',
        enable: 'Activer la recherche IA',
        retry: 'Relancer la recherche IA',
        disable: 'Désactiver la recherche IA',
        enabled: 'Recherche IA activée — indexation lancée.',
        disabled: 'Recherche IA désactivée.',
        retryQueued: 'Relance mise en file — indexation lancée.',
        updateFailed: 'Impossible de mettre à jour la recherche IA.',
        editLocked: 'Modifier (verrouillé — indexation)',
        editLockedToast: 'La modification est verrouillée pendant l’indexation IA.',
        indexingToast: 'Le produit est en cours d’indexation, réessayez plus tard',
    },

    delivery: {
        title: 'Livraison',
        agencyLabel: 'Agence de livraison',
        agencyDescription:
            'L’agence qui traitera les commandes de ce produit. Seules les agences avec une connexion active peuvent être attribuées.',
        agencyPlaceholder: 'Sélectionnez une agence',
        agencyDefaultNamed: 'Utiliser mon agence par défaut — {{name}}',
        loadingAgencies: 'Chargement des agences…',
        loadAgenciesFailed: 'Impossible de charger les agences de livraison.',
        noConnections: 'Vous n’avez encore aucune connexion d’agence de livraison active.',
        goToConnections: 'Aller à Agence → Connexion',
        noDefaultAgency:
            'Vous n’avez aucune agence de livraison par défaut. Choisissez-en une pour ce produit, ou définissez une valeur par défaut dans votre profil avant de publier.',
        defaultConnectionLost:
            'La connexion de votre agence par défaut n’est plus active. Choisissez une autre agence ici ou mettez à jour votre valeur par défaut dans les Paramètres.',
        usingDefaultAgency: 'Le système utilisera votre agence par défaut — {{name}}.',
        freeDelivery: 'Livraison offerte',
        freeDeliveryHint:
            'Annoncer ce produit en livraison offerte. Ne modifie ni la résolution d’agence ni le calcul des frais.',
        pickupLabel: 'Point de retrait',
        pickupDescription:
            'Là où l’agence de livraison récupère ce produit. Obligatoire pour publier.',
        pickupNeedsAgency: 'Attribuez d’abord une agence de livraison ci-dessus.',
        pickupPlaceholder: 'Sélectionnez un mode de retrait',
        pickupFromAddress: 'Collecte à mon adresse',
        pickupFromAgency: 'L’agence stocke déjà ma marchandise',
        pickupNoSources:
            '{{name}} ne prend en charge ni la collecte à votre adresse ni le stockage en agence. Choisissez une autre agence.',
        pickupWarehoused: '{{name}} entrepose déjà le stock de ce produit.',
        pickupAddressMissing:
            'L’adresse de collecte de ce produit n’existe plus. Choisissez-en une autre avant de publier.',
        addressPlaceholder: 'Sélectionnez une adresse professionnelle',
        noAddresses: 'Vous n’avez encore aucune adresse professionnelle.',
        goToAddresses: 'Aller à Compte → Adresses',
        depotPlaceholder: 'Quel entrepôt détient ce stock ?',
        depotDefaultSuffix: 'par défaut',
        depotPrimaryName: 'Siège principal',
        depotBranchName: 'Agence {{number}}',
        loadingDepots: 'Chargement des entrepôts…',
        depotsUnavailable:
            'Impossible de charger les entrepôts de cette agence pour le moment. Votre choix actuel reste inchangé — réessayez dans un instant.',
        noDepots: '{{name}} n’a encore aucun entrepôt enregistré.',
        depotRemoved:
            'L’entrepôt que vous aviez choisi n’est plus exploité par cette agence. La collecte se fait désormais depuis son entrepôt principal — choisissez-en un autre si cela ne convient pas.',
        storageNeedsCountableStock:
            'Un entrepôt détient une quantité chiffrée : le stockage en agence est donc indisponible tant que {{skus}} est en stock illimité. Désactivez le stock illimité et saisissez une quantité.',
        storageInfiniteLive:
            'Ce produit est stocké chez une agence mais {{skus}} est en stock illimité. Il ne pourra plus être publié tant que vous ne l’aurez pas désactivé.',
        storageSkusMore: '{{skus}} et {{count}} de plus',
        guidance: {
            multipleAddressesTitle: 'À quelle adresse le coursier doit-il venir ?',
            multipleAddressesBody:
                'Vous avez plusieurs adresses professionnelles et aucune n’est définie par défaut : nous n’avons pas deviné.',
            noAgencyTitle: 'Aucune agence de livraison',
            noAgencyBody:
                'Connectez une agence et définissez-la par défaut pour publier des produits physiques.',
            noAgencyAction: 'Configurer la livraison',
            agencyInactiveTitle: 'Votre agence de livraison n’est pas active',
            agencyInactiveBody: 'Réactivez la connexion, ou connectez une autre agence.',
            agencyInactiveAction: 'Vérifier les connexions',
            noBusinessAddressTitle: 'Ajoutez une adresse professionnelle',
            noBusinessAddressBody:
                'Votre agence ne collecte qu’à une adresse vendeur, et vous n’en avez enregistré aucune.',
            noBusinessAddressAction: 'Ajouter une adresse',
            agencyOffersNeitherTitle: 'Cette agence ne propose aucun des deux modes de retrait',
            agencyOffersNeitherBody:
                'Elle ne propose ni la collecte à votre adresse ni le stockage de votre marchandise. Choisissez une autre agence.',
            agencyOffersNeitherAction: 'Choisir une autre agence',
            resolutionFailedTitle: 'Nous n’avons pas pu déterminer un point de retrait',
            resolutionFailedBody: 'C’est généralement temporaire.',
        },
    },

    media: {
        title: 'Images du produit',
        stepDescriptionSingle: 'Ajoutez une image de couverture pour ce produit.',
        stepDescriptionMany:
            'Ajoutez jusqu’à {{max}} images. La première servira de vignette du produit. Faites glisser les cartes pour réorganiser.',
        stepLibraryNote:
            'Les images proviennent de votre bibliothèque — vous pouvez en téléverser directement depuis le sélecteur.',
        addFromLibrary: 'Ajouter des images depuis votre bibliothèque',
        addFromLibraryHint:
            'Images uniquement · max. {{max}} · {{remaining}} restantes · faites glisser les cartes ci-dessus pour réorganiser',
        replaceImage: 'Remplacer l’image',
        tapToClose: 'Touchez pour fermer',
        thumbnail: 'Vignette',
        skipForNow: 'Passer pour l’instant',
        variantImages: 'Images de la variante',
        addVariantImage: 'Ajouter une image ({{used}}/{{max}})',
        saveVariantFirst: 'Enregistrez la variante pour ajouter des images',
        imageFallback: 'Image',
        variantImageAlt: 'Image de la variante',
        sizeLabel: 'Taille : ',
        typeLabel: 'Type : ',
        delete: 'Supprimer',
    },

    asset: {
        replace: 'Remplacer',
        uploading: 'Téléversement du fichier…',
        dropHere: 'Déposez votre fichier ici',
        dragOrClick: 'Glissez-déposez ou cliquez pour téléverser',
        supported: 'PDF, ZIP, MP4, MP3, images, Word, Excel · max. 500 Mo',
        selectFile: 'Choisir un fichier',
        typeNotAllowed:
            'Le type de fichier « {{type}} » n’est pas autorisé. Formats acceptés : PDF, ZIP, MP4, MP3, images, Word, Excel.',
        tooLarge: 'Fichier trop volumineux ({{size}}). Le maximum est de 500 Mo.',
    },

    formats: {
        title: 'Formats',
        description:
            'Proposez votre produit numérique dans jusqu’à {{max}} formats (ex. PDF, ZIP, EPUB). Chaque format a son propre fichier, son prix et ses règles de téléchargement.',
        downloadsEnabled: 'Téléchargements activés',
        downloadsEnabledHint:
            'Désactivé, tous les formats sont en pause — les achats ne livreront aucun fichier.',
        addFormat: 'Ajouter un format',
        atLimit: 'Maximum de {{max}} formats atteint.',
        count: '{{used}} format(s) sur {{max}}.',
        saveAndContinue: 'Enregistrer et continuer',
        skuRequired: 'Le SKU est obligatoire',
        nameRequired: 'Le nom du format est obligatoire',
        priceRequired: 'Le prix doit être supérieur à 0',
    },

    mode: {
        title: 'Qu’ajoutez-vous ?',
        description:
            'L’ajout rapide couvre la plupart des produits. Choisissez une autre option si vous avez besoin de variantes ou de fichiers téléchargeables — ce choix est définitif après la création.',
        recommended: 'Recommandé',
        simple: 'Ajout rapide',
        simpleDescription: 'Une page, un prix, un stock. Publié dès qu’il est prêt.',
        simpleExamples: 'Une paire de chaussures, un livre, un sac',
        physical: 'Produit physique avec variantes',
        physicalDescription: 'Tailles, couleurs, et stock, images et prix par variante.',
        physicalExamples: 'Un t-shirt en 4 tailles × 3 couleurs',
        digital: 'Produit numérique',
        digitalDescription:
            'Fichiers téléchargeables avec prix et limites de téléchargement par format.',
        digitalExamples: 'Logiciels, e-books, musique, modèles, formations',
    },

    typeSelect: {
        title: 'Choisissez le type de produit',
        description:
            'Le type détermine les champs et les étapes requis. Ce choix est définitif après la création.',
        physical: 'Produit physique',
        physicalDescription: 'Un produit tangible expédié au client.',
        physicalExamples: 'Vêtements, électronique, mobilier, accessoires',
        digital: 'Produit numérique',
        digitalDescription:
            'Un fichier téléchargeable ou une licence logicielle livrée par voie électronique.',
        digitalExamples: 'Logiciels, e-books, musique, modèles, formations',
    },

    convert: {
        title: 'Passer à l’éditeur avancé ?',
        namedLead:
            '« {{name}} » passera à l’éditeur complet, débloquant les variantes, les options et les images par variante.',
        genericLead:
            'Ce produit passera à l’éditeur complet, débloquant les variantes, les options et les images par variante.',
        unchanged:
            'Rien d’autre ne change — votre prix, votre stock et vos images restent exactement tels quels.',
        oneWay: 'C’est irréversible. Il n’y a pas de retour à l’éditeur rapide.',
        confirm: 'Passer à l’éditeur avancé',
        success: 'Basculé vers l’éditeur avancé.',
    },

    quickAdd: {
        title: 'Ajout rapide d’un produit',
        subtitleLead: 'Une page, un prix. Besoin de tailles ou de couleurs ?',
        subtitleLink: 'Utiliser l’éditeur avancé',
        createdPublished: 'Produit créé et publié.',
        savedAsDraft: 'Produit enregistré en brouillon.',
        published: 'Produit publié.',
        viewPlans: 'Voir les formules',
        useGeneratedSku: 'Utiliser un SKU généré automatiquement',
    },

    validation: {
        titleMin: 'Le titre doit contenir au moins 3 caractères',
        titleMax: 'Le titre ne doit pas dépasser 200 caractères',
        categoryRequired: 'La catégorie est obligatoire',
        descriptionRequired: 'La description est obligatoire',
        tagEmpty: 'Une étiquette ne peut pas être vide',
        tagsUnique: 'Les étiquettes doivent être uniques',
        seoTitleMax: 'Le titre SEO ne doit pas dépasser 60 caractères',
        seoDescriptionMax: 'La description SEO ne doit pas dépasser 160 caractères',
        optionNameRequired: 'Le nom de l’option est obligatoire',
        optionNameMax: 'Le nom de l’option ne doit pas dépasser 50 caractères',
        optionValueEmpty: 'Une valeur ne peut pas être vide',
        optionValueMin: 'Au moins une valeur est requise',
        optionValuesUnique: 'Les valeurs d’option doivent être uniques',
        skuRequired: 'Le SKU est obligatoire',
        skuMax: 'Le SKU ne doit pas dépasser 100 caractères',
        priceRequired: 'Le prix est obligatoire',
        priceMin: 'Le prix doit être supérieur ou égal à 0',
        compareAtMin: 'Le prix barré doit être supérieur ou égal à 0',
        bargainMin: 'Le plafond de négociation doit être supérieur ou égal à 0',
        bargainMaxNumber: 'Saisissez un plafond de négociation valide',
        bargainMaxBelowPrice: 'Le plafond de négociation doit être au moins égal au prix',
        stockNumber: 'Le stock doit être un nombre',
        stockInteger: 'Le stock doit être un nombre entier',
        stockMin: 'Le stock ne peut pas être négatif',
        weightMin: 'Le poids doit être supérieur ou égal à 0',
        lengthMin: 'La longueur doit être supérieure ou égale à 0',
        widthMin: 'La largeur doit être supérieure ou égale à 0',
        heightMin: 'La hauteur doit être supérieure ou égale à 0',
        nameRequired: 'Le nom du produit est obligatoire',
        pricePositive: 'Le prix doit être positif',
        priceGreaterThanZero: 'Le prix doit être supérieur à 0',
        skuEmpty: 'Le SKU ne peut pas être vide',
        imageLimit: 'Un produit peut contenir au maximum 7 images',
        lowStockThreshold:
            'Le seuil de stock faible doit être un nombre entier supérieur ou égal à 0',
    },

    toast: {
        created: 'Produit créé',
        updated: 'Produit mis à jour',
        published: 'Produit publié',
        archived: 'Produit archivé',
        archivedMany: plural({
            one: '{{count}} produit archivé',
            other: '{{count}} produits archivés',
        }),
        restored: 'Produit restauré',
        duplicated: 'Produit dupliqué',
        statusChanged: '« {{name}} » est maintenant : {{status}}.',
        infoSaved: 'Informations du produit enregistrées.',
        mediaSaved: 'Médias enregistrés.',
        optionsSaved: 'Options enregistrées.',
        variantsSaved: 'Variantes enregistrées.',
        variantsSavedStockQueued: plural({
            one: 'Variantes enregistrées. {{count}} modification de stock est en attente de validation de l’agence de stockage.',
            other: 'Variantes enregistrées. {{count}} modifications de stock sont en attente de validation de l’agence de stockage.',
        }),
        formatsSaved: 'Formats enregistrés.',
        agencyUpdated: 'Agence de livraison mise à jour.',
        agencyDefault: 'Utilisation de votre agence de livraison par défaut.',
        freeDeliveryEnabled: 'Livraison offerte activée.',
        freeDeliveryDisabled: 'Livraison offerte désactivée.',
        pickupUpdated: 'Point de retrait mis à jour.',
        publishedBang: 'Produit publié !',
        savedAsDraft: 'Produit enregistré en brouillon.',
        changesSaved: 'Modifications enregistrées.',
    },

    errors: {
        loadFailed: "Nous n'avons pas pu charger vos produits. Réessayez.",
        loadOneFailed: "Nous n'avons pas pu charger ce produit. Réessayez.",
        saveFailed: "Nous n'avons pas pu enregistrer ce produit. Réessayez.",
        publishFailed: "Nous n'avons pas pu publier ce produit. Réessayez.",
        archiveFailed: "Nous n'avons pas pu archiver ce produit. Réessayez.",
        deleteFailed: "Nous n'avons pas pu retirer ce produit. Réessayez.",
        bulkArchiveFailed: 'Impossible d’archiver les produits.',
        validateFailed: 'Impossible de valider le produit.',
        statusChangeFailed: 'Impossible de changer le statut du produit.',
        notFound: 'Ce produit n’existe plus.',
        optionsFailed: "Nous n'avons pas pu appliquer vos modifications d’options. Réessayez.",
        variantsFailed: "Nous n'avons pas pu enregistrer vos variantes. Réessayez.",
        formatsFailed: "Nous n'avons pas pu enregistrer vos formats. Réessayez.",
        mediaFailed: "Nous n'avons pas pu enregistrer vos images. Réessayez.",
        agencyFailed: "Nous n'avons pas pu mettre à jour l’agence de livraison. Réessayez.",
        freeDeliveryFailed: "Nous n'avons pas pu mettre à jour la livraison offerte. Réessayez.",
        pickupFailed: "Nous n'avons pas pu mettre à jour le point de retrait. Réessayez.",
        draftFailed: "Nous n'avons pas pu enregistrer votre brouillon. Réessayez.",
        bargainPartial:
            'Nous n’avons pas pu définir le plafond de négociation pour {{variants}}. Rien d’autre n’a été modifié — corrigez ces lignes et réessayez.',
    },
};

export default products;
