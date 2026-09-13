import { plural } from '../../types';

/** Services réservables : catalogue, disponibilités, rendez-vous, agenda. */
export const services = {
    title: 'Réservations',
    subtitle: 'Vos services réservables, vos rendez-vous et votre agenda',

    tabs: {
        services: 'Services',
        appointments: 'Rendez-vous',
        calendar: 'Agenda',
    },

    tabSubtitles: {
        services: 'Vos services réservables et les disponibilités que vos clients réservent',
        appointments: 'Toutes les réservations de vos clients et l’état d’avancement de chacune',
        calendar: 'Connectez un agenda pour synchroniser réservations et disponibilités',
    },

    status: {
        draft: 'Brouillon',
        active: 'Actif',
        archived: 'Archivé',
        pending_review: 'En cours de vérification',
        suspended: 'Suspendu',
    },

    bookingMode: {
        calendar: 'Agenda',
        manual: 'Manuel',
        capacity: 'Capacité',
    },

    bookingModeHelp: {
        calendar: 'Le client choisit un créneau précis dans vos disponibilités.',
        manual: 'Vous convenez de l’horaire avec le client après sa demande.',
        capacity: 'Plusieurs clients peuvent réserver le même créneau.',
    },

    days: {
        sunday: 'Dimanche',
        monday: 'Lundi',
        tuesday: 'Mardi',
        wednesday: 'Mercredi',
        thursday: 'Jeudi',
        friday: 'Vendredi',
        saturday: 'Samedi',
    },

    daysShort: {
        sunday: 'Dim',
        monday: 'Lun',
        tuesday: 'Mar',
        wednesday: 'Mer',
        thursday: 'Jeu',
        friday: 'Ven',
        saturday: 'Sam',
    },

    duration: {
        minutes: '{{minutes}} min',
        hours: '{{hours}} h',
        hoursMinutes: '{{hours}} h {{minutes}}',
        presets: {
            min15: '15 min',
            min30: '30 min',
            min45: '45 min',
            hour1: '1 heure',
            hour1h30: '1 h 30',
            hour2: '2 heures',
        },
    },

    list: {
        newService: 'Nouveau service',
        searchPlaceholder: 'Rechercher un service…',
        filterTitle: 'Filtrer les services',
        applyFilters: 'Afficher les services',
        statusSection: 'Statut',
        allStatuses: 'Tous les statuts',
        statusChip: 'Statut : {{value}}',
        gridView: 'Vue en grille',
        listView: 'Vue en liste',
        rowActions: 'Actions du service',
        columns: {
            service: 'Service',
            duration: 'Durée',
            mode: 'Mode',
            status: 'Statut',
        },
        count: plural({ one: '{{count}} service', other: '{{count}} services' }),
        emptyTitle: 'Aucun service',
        emptyDescription:
            'Créez un service réservable pour commencer à accepter des rendez-vous.',
        emptyFilteredTitle: 'Aucun service correspondant',
        emptyFilteredDescription: 'Ajustez votre recherche ou le filtre de statut.',
    },

    vectorisation: {
        notStarted: 'Non indexé',
        pending: 'Indexation…',
        completed: 'Recherche IA prête',
        failed: 'Échec de l’indexation',
        enable: 'Activer la recherche IA',
        retry: 'Relancer la recherche IA',
        disable: 'Désactiver la recherche IA',
        editLocked: 'Modifier (verrouillé — indexation)',
        editLockedToast: 'La modification est verrouillée pendant l’indexation IA.',
        statusLockedToast:
            'Les changements de statut sont verrouillés pendant l’indexation IA.',
        busyToast: 'La recherche IA est en cours d’indexation — patientez jusqu’à la fin.',
        enabled: 'Recherche IA activée',
        disabled: 'Recherche IA désactivée',
        retryQueued: 'Relance de la recherche IA planifiée',
        updateFailed: 'La recherche IA n’a pas pu être mise à jour.',
        toggleLabel: 'Activer la vectorisation IA',
        toggleHelp:
            'Une fois activée, si le service est complet et actif, ses données sont envoyées pour ' +
            'vectorisation afin que les clients le trouvent via la recherche IA. Le statut et la ' +
            'relance sont disponibles depuis la fiche du service.',
    },

    /**
     * Badge de désynchronisation du calendrier sur la liste des services.
     *
     * La connexion est par VENDEUR, pas par service : le badge lit l'unique
     * indicateur `requiresReauth` du compte et marque tous les services ACTIFS —
     * la synchronisation écrit des plages occupées valables pour tout le compte.
     */
    calendarSync: {
        desynced: 'Calendrier non synchronisé',
        desyncedHint:
            'L’accès à Google Agenda a été révoqué ou a expiré : vos plages occupées ne bloquent ' +
            'plus les créneaux de ce service. Reconnectez-le dans l’onglet Calendrier.',
    },

    transitions: {
        publish: 'Publier le service',
        unpublish: 'Dépublier (brouillon)',
        archive: 'Archiver',
        restore: 'Remettre en brouillon',
        confirmTitle: 'Confirmer',
        confirm: {
            archiveDraft: 'Archiver ce service ? Il ne sera plus réservable.',
            archiveActive:
                'Archiver ce service en ligne ? Il cessera immédiatement d’accepter de nouvelles réservations.',
            unpublish:
                'Dépublier ce service ? Il cessera d’accepter de nouvelles réservations.',
            generic: 'Appliquer ce changement de statut ?',
        },
    },

    wizard: {
        stepDetails: 'Détails',
        stepImages: 'Images',
        stepBooking: 'Réservation',
        stepAvailability: 'Disponibilités',
        stepReview: 'Vérification',
        createTitle: 'Créer un service',
        createSubtitle: 'Ajoutez un nouveau service réservable à votre boutique',
        editTitle: 'Modifier le service',
        backToServices: 'Services',
        saveAndContinue: 'Enregistrer et continuer',
        skipForNow: 'Passer pour l’instant',
    },

    basics: {
        title: 'Détails du service',
        description:
            'Les informations essentielles de votre service réservable. Vous pourrez les modifier plus tard.',
        name: 'Nom du service',
        namePlaceholder: 'ex. Consultation d’une heure',
        category: 'Catégorie',
        categoryPlaceholder: 'ex. Coaching, Conseil, Bien-être',
        descriptionLabel: 'Description',
        descriptionPlaceholder: 'Que comprend cette réservation ?',
        tags: 'Étiquettes',
        tagPlaceholder: 'Ajoutez une étiquette, puis Entrée ou virgule',
        seoSection: 'SEO (facultatif)',
        seoTitle: 'Titre SEO',
        seoTitlePlaceholder: 'Laissez vide pour utiliser le nom du service',
        seoDescription: 'Description SEO',
        seoDescriptionPlaceholder: 'Brève description pour les moteurs de recherche',
        charCount: '({{current}}/{{max}})',
    },

    images: {
        title: 'Images du service',
        description:
            'Ajoutez jusqu’à {{limit}} images. La première servira de miniature. Faites glisser les ' +
            'cartes pour les réordonner. Les images viennent de votre médiathèque — vous pouvez en ' +
            'téléverser directement depuis le sélecteur.',
    },

    config: {
        durationLabel: 'Durée de la séance',
        durationUnit: 'minutes',
        priceLabel: 'Prix de la réservation (XAF)',
        priceHelp:
            'Tarif de base pour une séance ({{duration}} min). Les réservations plus longues sont ' +
            'calculées au prorata ; la majoration heures de pointe s’ajoute par-dessus.',
        modeLabel: 'Mode de réservation',
        seatsLabel: 'Places par créneau',
        seatsPlaceholder: 'ex. 10',
        seatsHelp: 'Combien de clients peuvent réserver le même créneau.',
        bufferBefore: 'Marge avant (min)',
        bufferAfter: 'Marge après (min)',
        peakTitle: 'Majoration heures de pointe',
        peakHelp: 'Facturez un supplément sur les plages chargées.',
        peakDays: 'Jours',
        peakDaysHelp: 'Ne sélectionnez aucun jour pour l’appliquer tous les jours.',
        peakStart: 'Heure de début',
        peakEnd: 'Heure de fin',
        peakType: 'Type de majoration',
        peakTypePercentage: 'Pourcentage (%)',
        peakTypeFixed: 'Montant fixe',
        peakAmount: 'Montant (XAF)',
        peakPercent: 'Pourcentage (%)',
    },

    booking: {
        settingsTitle: 'Paramètres de réservation',
        settingsDescription:
            'Définissez la durée de la séance, le prix et la façon dont les clients réservent ce service.',
        status: {
            pending: 'En attente',
            confirmed: 'Confirmée',
            completed: 'Terminée',
            'no-show': 'Absence',
            cancelled: 'Annulée',
        },
        payment: {
            unpaid: 'Non payée',
            pending: 'Paiement en attente',
            paid: 'Payée',
            disputed: 'Contestée',
            failed: 'Paiement échoué',
            refund_pending: 'Remboursement en attente',
            refunded: 'Remboursée',
        },
        paymentShort: {
            unpaid: 'Non payée',
            pending: 'En attente',
            paid: 'Payée',
            disputed: 'Contestée',
            failed: 'Échoué',
            refund_pending: 'Remb. en attente',
            refunded: 'Remboursée',
        },
        transitions: {
            confirm: 'Confirmer la réservation',
            complete: 'Terminer et régler',
            noShow: 'Marquer comme absence',
            cancel: 'Annuler la réservation',
        },
    },

    bookings: {
        filterTitle: 'Filtrer les réservations',
        applyFilters: 'Afficher les réservations',
        searchPlaceholder: 'Rechercher par service, e-mail client ou ID de réservation',
        searchPlaceholderShort: 'Rechercher…',
        searchScopeNote:
            'La recherche porte sur vos {{count}} réservations les plus récentes. Ajoutez un '
            + 'filtre de statut ou de paiement pour remonter plus loin.',
        statusSection: 'Statut de la réservation',
        anyStatus: 'Tous les statuts',
        paymentSection: 'Statut du paiement',
        anyPayment: 'Tous',
        statusChip: 'Statut : {{value}}',
        paymentChip: 'Paiement : {{value}}',
        viewList: 'Liste',
        viewCalendar: 'Agenda',
        emptyTitle: 'Aucune réservation',
        emptyDescription:
            'Les réservations apparaissent ici dès qu’un client réserve un créneau pour vos services.',
        emptyFilteredTitle: 'Aucune réservation correspondante',
        emptyFilteredDescription:
            'Rien ne correspond à votre recherche ni à vos filtres. Essayez un autre terme ou '
            + 'réinitialisez-les pour voir toutes les réservations.',
        columns: {
            service: 'Service',
            customer: 'Client',
            when: 'Quand',
            status: 'Statut',
            payment: 'Paiement',
            price: 'Prix',
        },
        count: plural({ one: '{{count}} réservation', other: '{{count}} réservations' }),
        untitledService: 'Service',
    },

    detail: {
        title: 'Réservation',
        customer: 'Client',
        payment: 'Paiement',
        paymentRequired: 'Paiement requis',
        paymentNotRequired: 'Aucun paiement requis',
        paidAt: 'payée le {{date}}',
        disputeNotice:
            'Le client a ouvert une contestation sur ce paiement. Stripe la traite — aucune action ' +
            'de votre part. En cas de perte, la réservation est remboursée et annulée.',
        cancellationReason: 'Motif de l’annulation',
        markCashReceived: 'Marquer le paiement en espèces reçu',

        settlement: 'Règlement',
        finalPrice: 'Prix final',
        balanceOutstanding: '{{amount}} encore dû par le client.',
        balanceSettled: 'Solde réglé ({{method}}).',
        creditRecorded: '{{amount}} payé en trop — enregistré, non remboursé automatiquement.',
        settleBalanceInCash: 'Enregistrer {{amount}} reçus en espèces',
        reschedule: 'Reporter',
        statusConfirmDescription:
            'Appliquer ce changement ? Les réservations confirmées sont synchronisées avec votre Google Agenda.',
        cancelTitle: 'Annuler cette réservation ?',
        cancelDescription:
            'L’événement est retiré de l’agenda et le client est prévenu. C’est irréversible.',
        cancelReasonPlaceholder: 'Motif (facultatif)',
        keepBooking: 'Conserver la réservation',
        confirmCancel: 'Annuler la réservation',
    },

    complete: {
        title: 'Terminer et régler',
        description:
            'Choisissez comment régler le prix final. Le montant est recalculé par le système.',
        modes: {
            asBooked: 'Régler comme réservé',
            asBookedHint: 'Facturer la durée initialement réservée.',
            actualEnd: 'Heure de fin réelle',
            actualEndHint: 'Recalculer à partir de la fin réelle du service.',
            extraMinutes: 'Minutes supplémentaires',
            extraMinutesHint: 'Ajouter des minutes au-delà de la fin prévue.',
            fixedPrice: 'Prix fixe',
            fixedPriceHint: 'Facturer un montant final forfaitaire.',
        },
        actualEndLabel: 'Heure de fin réelle',
        extraMinutesLabel: 'Minutes supplémentaires',
        extraMinutesPlaceholder: 'ex. 30',
        fixedPriceLabel: 'Prix final ({{currency}})',
        fixedPriceHelp: 'Montant dans la plus petite unité monétaire.',
        submit: 'Terminer la réservation',
        resultTitle: 'Réservation terminée',
        resultDescription: 'Le prix final a été réglé.',
        originallyBooked: 'Initialement réservé',
        amountPaid: 'Déjà payé',
        finalPrice: 'Prix final',
        peakSurcharge: 'Dont majoration heures de pointe',
        additionalDue: '{{amount}} restant dû',
        additionalDueHelp:
            'Le client a été prévenu et peut payer ce solde en ligne. Si vous l’encaissez en ' +
            'espèces, enregistrez-le sur la réservation pour solder le montant.',
        creditDue: '{{amount}} payé en trop',
        creditDueHelp:
            'Le client a payé plus que le prix final. Ce montant est enregistré, mais pas remboursé ' +
            'automatiquement — utilisez un remboursement si vous souhaitez le lui restituer.',
        errors: {
            actualEndRequired: 'Choisissez l’heure de fin réelle',
            extraMinutesRequired: 'Saisissez les minutes supplémentaires',
            priceInvalid: 'Saisissez un prix valide',
        },
    },

    reschedule: {
        title: 'Reporter la réservation',
        empty:
            'Aucun créneau libre dans les {{days}} prochains jours. Vérifiez les règles de disponibilité du service.',
        heldFor: 'Réservé pour {{time}}',
        confirm: 'Confirmer le nouvel horaire',
        lockExpired: 'La réservation temporaire de ce créneau a expiré. Choisissez à nouveau.',
        lockFailed: 'Impossible de réserver ce créneau',
    },

    availability: {
        stepTitle: 'Choisir les horaires',
        stepDescription:
            'Définissez les horaires hebdomadaires réservables. Ouvrez un jour pour y ajouter des ' +
            'horaires, ou laissez-le fermé — vous pourrez affiner plus tard.',
        closed: 'Fermé',
        open: 'Ouverture',
        close: 'Fermeture',
        removeHours: 'Retirer cette plage horaire',
        addHours: 'Ajouter une plage horaire',
        invalidRange: 'L’heure de fermeture doit suivre l’heure d’ouverture.',
        dayOpen: '{{day}} ouvert',
        dayClosed: '{{day}} fermé',
        fixHoursTitle: 'Corrigez les horaires d’ouverture',
        fixHoursDescription:
            '{{days}} : l’heure de fermeture doit suivre l’heure d’ouverture.',
        partialFailure: 'Certains horaires n’ont pas pu être enregistrés',
        removeFailure: '{{day}} (suppression)',
        dayFailure: '{{day}} ({{reason}})',
        createFailure: 'Nouveaux horaires ({{reason}})',
        overlapReason: 'chevauche des horaires existants',
        genericReason: 'échec de l’enregistrement',
        saved: 'Disponibilités enregistrées',
    },

    review: {
        title: 'Vérifier et publier',
        description:
            'Vérifiez votre service avant de le publier. Vous pouvez toujours l’enregistrer en brouillon et le publier plus tard.',
        indexingNotice:
            'Ce service est en cours d’indexation pour la recherche IA. La modification est temporairement désactivée.',
        archivedNotice:
            'Ce service est archivé et en lecture seule. Remettez-le en brouillon depuis la liste des services pour le modifier ou le publier.',
        pendingReviewNotice:
            'Ce service attend la vérification d’un administrateur et reste en lecture seule jusqu’à la fin de la modération.',
        suspendedNotice:
            'Ce service est suspendu. Vous pouvez toujours le modifier — il est rétabli automatiquement une fois la cause résolue.',
        typeLabel: 'service',
        duration: 'Durée',
        price: 'Prix',
        mode: 'Mode de réservation',
        seats: 'Places par créneau',
        tags: 'Étiquettes',
        requirements: 'Conditions de publication',
        requirementsMet: 'Toutes les conditions sont remplies — prêt à publier',
        keepDraft: 'Garder en brouillon',
        publish: 'Publier',
        publishing: 'Publication…',
    },

    calendarPanel: {
        connectTitle: 'Connecter Google Agenda',
        connectDescription:
            'Vos clients ne peuvent réserver qu’une fois votre agenda connecté — les réservations y ' +
            'sont inscrites comme événements, et vos plages déjà occupées sont exclues des créneaux proposés.',
        connect: 'Connecter Google Agenda',
        connectShort: 'Connecter',
        connected: 'Connecté',
        calendarId: 'Agenda : {{id}}',
        lastSynced: 'Dernière synchronisation {{date}}',
        disconnect: 'Déconnecter',
        permissions: 'Autorisations accordées',
        reauthTitle: 'Reconnexion nécessaire',
        reauthDescription:
            'L’accès à votre Google Agenda a été révoqué ou a expiré. Reconnectez-vous pour continuer à accepter des réservations.',
        reconnect: 'Reconnecter',
        disconnectTitle: 'Déconnecter Google Agenda ?',
        disconnectDescription:
            'Les nouvelles réservations seront bloquées jusqu’à la reconnexion. Les réservations existantes ne sont pas supprimées.',
        keepConnected: 'Rester connecté',
        banner:
            'Connectez votre Google Agenda pour que vos clients puissent réserver. La configuration ' +
            'fonctionne sans, mais les réservations exigent un agenda connecté.',
        connectedToast: 'Google Agenda connecté',
        disconnectedToast: 'Google Agenda déconnecté',
        connectFailed: 'Impossible de connecter Google Agenda.',
        oauth: {
            access_denied: 'Vous n’avez pas autorisé l’accès : rien n’a été connecté.',
            missing_code: 'Google n’a pas renvoyé de code d’autorisation. Réessayez.',
            missing_state: 'La demande de connexion n’avait pas son jeton de sécurité. Réessayez.',
            state_mismatch: 'La connexion n’a pas pu être vérifiée. Réessayez de vous connecter.',
            invalid_state: 'Le lien de connexion a expiré. Réessayez de vous connecter.',
            connection_failed: 'Nous n’avons pas pu finaliser la connexion avec Google. Réessayez.',
        },
    },

    calendarView: {
        previousMonth: 'Mois précédent',
        nextMonth: 'Mois suivant',
        today: 'Aujourd’hui',
        more: '+{{count}} de plus',
    },

    validation: {
        titleMin: 'Le titre doit contenir au moins 3 caractères',
        titleMax: 'Le titre doit contenir au plus 200 caractères',
        categoryRequired: 'La catégorie est obligatoire',
        descriptionRequired: 'La description est obligatoire',
        tagEmpty: 'L’étiquette ne peut pas être vide',
        tagsUnique: 'Les étiquettes doivent être uniques',
        seoTitleMax: 'Le titre SEO doit contenir au plus 60 caractères',
        seoDescriptionMax: 'La description SEO doit contenir au plus 160 caractères',
        durationRequired: 'La durée est obligatoire',
        durationInteger: 'La durée doit être un nombre entier de minutes',
        durationMin: 'La durée doit être d’au moins 1 minute',
        priceRequired: 'Le prix est obligatoire',
        priceMin: 'Le prix doit être supérieur à 0',
        bufferMin: 'La marge ne peut pas être négative',
        seatsInteger: 'Le nombre de places doit être un nombre entier',
        seatsMin: 'Au moins 1 place',
        seatsRequired: 'Indiquez le nombre de places par créneau pour les réservations par capacité',
        surchargeRequired: 'La valeur de la majoration est obligatoire',
        surchargeMin: 'Ne peut pas être négatif',
        timeFormat: 'Utilisez le format 24 h HH:mm',
        timeOrder: 'La fin doit suivre le début',
    },

    activation: {
        notCreated: 'Le service n’a pas encore été créé',
        noDescription: 'Une description du service est obligatoire.',
        noDuration: 'Définissez une durée de séance avant de publier.',
        noPrice: 'Définissez un prix de réservation avant de publier.',
        zeroPrice: 'Le prix de la réservation doit être supérieur à 0.',
        noVariant: 'Un prix de réservation doit être enregistré avant de publier.',
        noCapacity: 'Définissez le nombre de places par créneau (capacité) avant de publier.',
    },

    toast: {
        detailsSaved: 'Détails enregistrés',
        imagesSaved: 'Images enregistrées',
        bookingSettingsSaved: 'Paramètres de réservation enregistrés',
        published: 'Service publié avec succès !',
        savedAsDraft: 'Service enregistré en brouillon.',
        statusUpdated: 'Service mis à jour',
        bookingUpdated: 'Réservation mise à jour',
        bookingCancelled: 'Réservation annulée',
        bookingRescheduled: 'Réservation reportée',
        markedPaid: 'Marquée comme payée',
        balanceSettled: 'Solde enregistré comme payé en espèces',
    },

    errors: {
        loadFailed: "Nous n'avons pas pu charger vos services. Réessayez.",
        loadServiceFailed: "Nous n'avons pas pu charger ce service. Réessayez.",
        loadBookingsFailed: "Nous n'avons pas pu charger vos réservations. Réessayez.",
        loadBookingFailed: "Nous n'avons pas pu charger cette réservation. Réessayez.",
        loadCalendarFailed: "Nous n'avons pas pu charger votre agenda. Réessayez.",
        loadCalendarStatusFailed:
            "Nous n'avons pas pu vérifier la connexion à votre agenda. Réessayez.",
        loadAvailabilityFailed: "Nous n'avons pas pu charger vos disponibilités. Réessayez.",
        loadSlotsFailed: "Nous n'avons pas pu charger les créneaux disponibles. Réessayez.",
        saveDetailsFailed: "Nous n'avons pas pu enregistrer ces détails. Réessayez.",
        saveImagesFailed: "Nous n'avons pas pu enregistrer les images. Réessayez.",
        saveBookingSettingsFailed:
            "Nous n'avons pas pu enregistrer les paramètres de réservation. Réessayez.",
        publishFailed: "Nous n'avons pas pu publier ce service. Réessayez.",
        saveFailed: "Nous n'avons pas pu enregistrer ce service. Réessayez.",
        statusChangeFailed: "Nous n'avons pas pu mettre à jour ce service. Réessayez.",
        bookingUpdateFailed: "Nous n'avons pas pu mettre à jour cette réservation. Réessayez.",
        bookingCancelFailed: "Nous n'avons pas pu annuler cette réservation. Réessayez.",
        markPaidFailed: "Nous n'avons pas pu marquer cette réservation comme payée. Réessayez.",
        settleBalanceFailed: "Nous n'avons pas pu enregistrer ce solde. Réessayez.",
        completeFailed: "Nous n'avons pas pu terminer cette réservation. Réessayez.",
        rescheduleFailed: "Nous n'avons pas pu reporter cette réservation. Réessayez.",
        disconnectFailed: "Nous n'avons pas pu déconnecter Google Agenda. Réessayez.",
    },
};

export default services;
