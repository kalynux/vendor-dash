import { plural } from '../../types';

/** Bibliothèque de médias et sélecteur de médias. */
export const media = {
    title: 'Bibliothèque de médias',
    subtitle: 'Toutes les images et tous les fichiers que vous avez envoyés',

    empty: {
        title: 'Rien d’envoyé pour le moment',
        description: 'Envoyez des photos de produits, des bannières et des documents pour les réutiliser partout.',
        filtered: 'Aucun fichier ne correspond à vos filtres.',
    },

    upload: {
        title: 'Envoyer des fichiers',
        dropzone: 'Glissez vos fichiers ici, ou cliquez pour parcourir',
        limits: 'Jusqu’à {{maxFiles}} fichiers (500 Mo chacun) ou 3 vidéos (70 Mo chacune)',
        uploading: 'Envoi de {{done}} sur {{total}}…',
        completed: plural({ one: '{{count}} fichier envoyé', other: '{{count}} fichiers envoyés' }),
        failed: plural({ one: '{{count}} fichier en échec', other: '{{count}} fichiers en échec' }),

        validation: {
            tooManyFiles: 'Vous pouvez envoyer au maximum {{max}} fichiers à la fois.',
            tooManyVideos: 'Vous pouvez envoyer au maximum {{max}} vidéos à la fois.',
            fileTooLarge: '« {{name}} » dépasse la limite de 500 Mo.',
            videoTooLarge: '« {{name}} » dépasse la limite de 70 Mo pour les vidéos.',
            videoFormat: '« {{name}} » n’est pas une vidéo prise en charge (utilisez MP4, MOV ou WebM).',
        },

        source: {
            title: 'Ajouter un fichier',
            description: 'Choisissez la provenance de ce fichier.',
            camera: 'Prendre une photo',
            cameraHint: 'Utiliser l’appareil photo maintenant',
            gallery: 'Photothèque',
            galleryHint: 'Choisir parmi vos photos et vidéos',
            files: 'Parcourir les fichiers',
            filesHint: 'Documents et tout le reste',
            openSettings: 'Ouvrir les réglages',
            deniedCamera: 'L’accès à l’appareil photo est nécessaire pour prendre une photo.',
            deniedGallery: 'L’accès aux photos est nécessaire pour choisir dans votre photothèque.',
            blockedCamera: 'L’accès à l’appareil photo est désactivé. Autorisez-le dans les réglages de votre appareil.',
            blockedGallery: 'L’accès aux photos est désactivé. Autorisez-le dans les réglages de votre appareil.',
            noCamera: 'Cet appareil ne dispose d’aucun appareil photo.',
            failed: 'Impossible d’ouvrir. Veuillez réessayer.',
        },
    },

    library: {
        titleShort: 'Médias',
        description: 'Gérez tous les fichiers que vous avez envoyés et voyez exactement où chacun est utilisé.',
        upload: 'Envoyer',
        uploadFiles: 'Envoyer des fichiers',
        uploadingFile: 'Envoi de {{name}}…',
        fileCount: plural({ one: '{{count}} fichier', other: '{{count}} fichiers' }),
        uploaded: plural({
            one: '{{count}} fichier envoyé.',
            other: '{{count}} fichiers envoyés.',
        }),
        dropToUpload: 'Déposez pour envoyer',
        gridView: 'Vue en grille',
        listView: 'Vue en liste',
        searchPlaceholder: 'Rechercher par nom ou type…',
        unused: 'Inutilisé',

        stats: {
            files: 'Fichiers',
            attached: 'Utilisés',
            unused: 'Inutilisés',
            pageScopeHint: 'Compté sur les fichiers chargés dans cette page.',
        },

        emptyFiltered: 'Aucun fichier ne correspond à vos filtres',
        emptyFilteredHint: 'Essayez d’effacer la recherche ou les filtres pour voir plus de fichiers.',
        emptyTitle: 'Votre bibliothèque est vide',
        emptyHint: 'Envoyez des images, des vidéos, de l’audio ou des documents pour commencer à construire votre bibliothèque.',
        clearFilters: 'Effacer les filtres',
        openInNewTab: 'Ouvrir dans un nouvel onglet',
        selectFileHint:
            'Sélectionnez un fichier pour voir ses détails et les endroits où il est utilisé.',
        inspect: 'Inspecter',
        onThisPage: plural({ one: '{{count}} sur cette page', other: '{{count}} sur cette page' }),
    },

    filters: {
        allTypes: 'Tous les types',
        images: 'Images',
        videos: 'Vidéos',
        documents: 'Documents',
        unused: 'Inutilisés uniquement',

        title: 'Filtrer les médias',
        apply: 'Voir les fichiers',
        open: 'Filtrer les fichiers',
        fileType: 'Type de fichier',
        storageProvider: 'Fournisseur de stockage',
        allProviders: 'Tous les fournisseurs',
        sortBy: 'Trier par',
        chipType: 'Type : {{value}}',
        chipProvider: 'Fournisseur : {{value}}',
        chipSort: 'Tri : {{value}}',

        kind: {
            image: 'Images',
            video: 'Vidéo',
            audio: 'Audio',
            document: 'Documents',
        },

        sort: {
            newest: 'Plus récents d’abord',
            oldest: 'Plus anciens d’abord',
            nameAsc: 'Nom A–Z',
            nameDesc: 'Nom Z–A',
            largest: 'Plus volumineux d’abord',
            smallest: 'Plus légers d’abord',
        },
    },

    storageBar: {
        label: 'Stockage des médias',
        of: 'sur {{limit}}',
        percent: '{{percent}} %',
        full: 'Le stockage est plein — supprimez des médias inutilisés pour en envoyer d’autres.',
        nearlyFull: 'Le stockage arrive à saturation. Supprimez des médias inutilisés ou changez de forfait.',
    },

    references: {
        avatar: 'Photo de profil',
        logo: 'Logo de la boutique',
        banner: 'Bannière de la boutique',
        cover: 'Image de couverture',
        attachment: 'Pièce jointe de ticket',
        product: 'Produit',
        variant: 'Variante',
        digitalAsset: 'Fichier numérique',
        ticket: 'Ticket d’assistance',
        store: 'Boutique',
        vendor: 'Votre profil',
        agency: 'Agence',
        customer: 'Client',
        agent: 'Agent',
        admin: 'Administrateur',
        generic: 'Utilisé',
        downloadableFile: 'Fichier téléchargeable',
    },

    details: {
        title: 'Détails du fichier',
        fileName: 'Nom du fichier',
        fileType: 'Type',
        fileSize: 'Taille',
        dimensions: 'Dimensions',
        uploaded: 'Envoyé le',
        checksum: 'Somme de contrôle',
        usedIn: 'Utilisé dans',
        notUsed: 'Utilisé nulle part pour l’instant',
        usageCount: plural({
            one: 'Utilisé à {{count}} endroit',
            other: 'Utilisé à {{count}} endroits',
        }),

        untitled: 'Sans titre',
        mime: 'Type MIME',
        provider: 'Fournisseur',
        references: 'Références',
        whereUsed: 'Où il est utilisé',
        notAttached: 'Rattaché à rien. Ce fichier peut être supprimé sans risque.',
        deleteFile: 'Supprimer le fichier',
        deleteBlocked: 'Détachez ce fichier de tout ce qui l’utilise avant de le supprimer.',
        deleteConfirm: 'Supprimer ce fichier ? Cette action est irréversible.',
    },

    picker: {
        searchPlaceholder: 'Rechercher un fichier…',
        filterTitle: 'Filtrer les fichiers',
        gridView: 'Vue en grille',
        listView: 'Vue en liste',
        fileType: 'Type de fichier',
        sizeMb: 'Taille (Mo)',
        uploadedOn: 'Téléversé le',
        sortBy: 'Trier par',
        uploading: 'Téléversement…',
        noFiles: 'Aucun fichier trouvé',
        clearFilters: 'Effacer les filtres',
        dropToUpload: 'Déposez pour téléverser',
        selectMedia: 'Sélectionner un média',
        selected: plural({ one: '{{count}} sélectionné', other: '{{count}} sélectionnés' }),
        selectedOfMax: '{{count}} sélectionné(s) / {{max}} max',
        selectCount: 'Sélectionner ({{count}})',
        added: 'Ajouté',
        totalFiles: plural({ one: '{{count}} au total', other: '{{count}} au total' }),
        kindNotAllowed:
            '{{kind}} ne peut pas être utilisé ici — seuls les fichiers {{allowed}} sont acceptés.',
        sizeMin: 'Min',
        sizeMax: 'Max',
        sizeAny: 'Indifférent',
        uploadedAfter: 'Après le',
        uploadedBefore: 'Avant le',
    },

    toast: {
        uploaded: 'Envoi terminé',
        deleted: plural({ one: '{{count}} fichier supprimé', other: '{{count}} fichiers supprimés' }),
        copied: 'Lien du fichier copié',
        renamed: 'Fichier renommé.',
        fileDeleted: 'Fichier supprimé.',
    },

    errors: {
        loadFailed: "Nous n'avons pas pu charger vos médias. Réessayez.",
        loadDetailFailed: "Nous n'avons pas pu charger les détails de ce fichier. Réessayez.",
        uploadFailed: "L'envoi a échoué. Réessayez.",
        renameFailed: "Nous n'avons pas pu renommer ce fichier. Réessayez.",
        deleteFailed: "Nous n'avons pas pu supprimer ce fichier. Réessayez.",
        stillReferenced: 'Ce fichier est encore utilisé. Détachez-le avant de le supprimer.',
        detachFirst: 'Détachez ce fichier de tout ce qui l’utilise avant de le supprimer.',
    },
};

export default media;
