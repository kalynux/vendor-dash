/**
 * Codes d'erreur du backend → messages destinés au vendeur.
 *
 * Miroir de `locales/en/errors.ts` — la liste des codes vient de
 * `api-doc/error-codes.ts`. Toute clé absente ici retombe automatiquement sur
 * l'anglais, mais l'objectif est une couverture complète.
 */

export const errors = {
    unknown: 'Une erreur est survenue. Veuillez réessayer.',
    network: 'Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.',
    fieldInvalid: 'Veuillez vérifier ce champ.',
    retrying: 'Nouvelle tentative…',

    withRequestId: '{{message}} Référence : {{requestId}}',

    category: {
        authentication: 'Votre session a pris fin. Veuillez vous reconnecter.',
        authorization: "Vous n'avez pas l'autorisation de faire cela.",
        validation: "Certaines informations ne sont pas valides. Vérifiez votre saisie et réessayez.",
        not_found: "Nous n'avons pas trouvé ce que vous cherchiez.",
        conflict: 'Cela a changé pendant que vous y travailliez. Actualisez puis réessayez.',
        business_rule: "Ce n'est pas autorisé pour le moment.",
        rate_limit: 'Trop de requêtes. Patientez un instant puis réessayez.',
        external_service: "Un service dont nous dépendons n'a pas répondu. Veuillez réessayer.",
        internal: 'Une erreur serveur est survenue. Réessayez dans un instant.',
    },

    status: {
        400: "Cette requête n'est pas valide. Vérifiez vos informations et réessayez.",
        401: 'Votre session a expiré. Veuillez vous reconnecter.',
        403: "Vous n'avez pas l'autorisation de faire cela.",
        404: "Nous n'avons pas trouvé ce que vous cherchiez.",
        409: "Cela entre en conflit avec l'état actuel. Actualisez puis réessayez.",
        413: 'Ce fichier est trop volumineux.',
        422: "Nous n'avons pas pu traiter cela. Vérifiez vos informations.",
        429: 'Trop de requêtes. Patientez un instant puis réessayez.',
        500: 'Une erreur serveur est survenue. Réessayez dans un instant.',
        502: 'Le serveur est momentanément indisponible. Réessayez sous peu.',
        503: 'Le service est momentanément indisponible. Réessayez sous peu.',
        504: 'Le serveur a mis trop de temps à répondre. Veuillez réessayer.',
    },

    fields: {
        email: 'Saisissez une adresse e-mail valide.',
        phone: 'Saisissez un numéro de téléphone valide, avec l’indicatif du pays.',
        password: 'Saisissez un mot de passe valide.',
        displayName: 'Saisissez un nom de 2 à 100 caractères.',
        title: 'Saisissez un titre.',
        price: 'Saisissez un prix valide.',
        stock: 'Saisissez une quantité en stock valide.',
        sku: 'Saisissez un SKU valide.',
        quantity: 'Saisissez une quantité valide.',
        country: 'Sélectionnez un pays.',
        timezone: 'Sélectionnez un fuseau horaire.',
        currency: 'Sélectionnez une devise.',
        amount: 'Saisissez un montant valide.',
        slug: 'Saisissez une adresse de boutique valide.',
    },

    /** Rejets fichier par fichier lors d'un envoi (`UPLOAD_POLICY_VIOLATION`). */
    upload: {
        namedFile: '{{name}} {{reason}}.',
        someFile: 'Un fichier {{reason}}.',
        violations: {
            NO_FILES_UPLOADED: "n'a pas été joint — veuillez choisir un fichier",
            FILE_TOO_LARGE: 'est trop volumineux',
            MIME_NOT_ALLOWED: 'a un type de fichier non pris en charge',
            TOO_MANY_FILES: 'dépasse le nombre maximum de fichiers',
            QUOTA_EXCEEDED:
                'dépasserait votre quota de stockage — libérez de la place dans votre bibliothèque de médias ou changez de forfait',
            VIRUS_DETECTED: 'a échoué à l’analyse de sécurité',
            PERMISSION_DENIED: 'ne peut pas être envoyé (accès refusé)',
            TOTAL_SIZE_EXCEEDED: 'fait dépasser la taille totale autorisée',
            DUPLICATE_FILE: 'a déjà été envoyé',
            MIME_TYPE_MISMATCH: 'a un contenu qui ne correspond pas à son extension',
            POLYGLOT_DETECTED: 'ressemble à un fichier déguisé et a été rejeté',
            UNDETECTABLE_TYPE: 'a un type de fichier non reconnu',
            UNKNOWN: 'a été rejeté',
        },
    },

    /** Formulations propres à un écran, consultées avant `codes`. */
    contexts: {
        simpleProduct: {
            VALIDATION_ERROR: 'Certains champs demandent votre attention — vérifiez les champs signalés.',
            CATALOG_IMAGE_LIMIT_EXCEEDED: 'Un produit peut comporter au maximum 7 images.',
            CATALOG_PRODUCT_ACCESS_DENIED:
                "Une des images sélectionnées appartient à un autre compte. Rien n'a été enregistré — retirez-la puis réessayez.",
            BILLING_LIMIT_EXCEEDED:
                "Vous avez atteint la limite de produits actifs de votre forfait. Changez de forfait, ou archivez un autre produit, pour publier celui-ci.",
            CATALOG_PRODUCT_NOT_FOUND: "Ce produit n'existe plus.",
            CATALOG_VARIANT_SKU_EXISTS:
                'Ce SKU est déjà pris. Les SKU sont uniques sur toute la plateforme — choisissez-en un autre, ou laissez le champ vide pour en générer un automatiquement.',
            CATALOG_PRODUCT_SIMPLE_MODE_LOCKED:
                "Ce produit utilise l'éditeur rapide, cette action n'est donc pas disponible. Basculez-le d'abord vers l'éditeur avancé.",
            CATALOG_PRODUCT_NOT_SIMPLE_MODE:
                "Ce produit utilise l'éditeur avancé. Ouvrez-le dans l'éditeur de produit complet.",
            CATALOG_PRODUCT_VECTORISATION_PENDING:
                'Ce produit est en cours d’indexation pour la recherche IA. Réessayez dans quelques secondes.',
            CATALOG_PRODUCT_INVALID_PICKUP_LOCATION:
                "Ce point de retrait n'est pas valide pour l'agence de livraison qui gère ce produit.",
            CATALOG_PRODUCT_NO_DEFAULT_VARIANT:
                "Ce produit a perdu sa variante. Ouvrez-le dans l'éditeur avancé pour la rétablir.",
            CATALOG_PRODUCT_AGENCY_STORAGE_INFINITE_STOCK:
                "Ce produit est stocké chez une agence : il lui faut donc une quantité chiffrée. Désactivez le stock illimité, ou remettez le retrait à votre propre adresse.",
            CATALOG_VARIANT_BARGAIN_RANGE_INVALID:
                'Le plafond de négociation doit être au moins égal au prix.',
            CATALOG_VARIANT_BARGAIN_PRICE_MISMATCH:
                'La fenêtre de négociation ne correspond plus au prix. Rechargez le produit et redéfinissez le plafond.',
        },

        delivery: {
            CATALOG_PRODUCT_INVALID_PICKUP_LOCATION:
                "Ce point de retrait n'est pas valide pour l'agence de livraison assignée, ou son adresse professionnelle n'existe plus.",
            CATALOG_PRODUCT_AGENCY_STORAGE_INFINITE_STOCK:
                "Impossible de stocker ce produit chez l'agence tant qu'une variante est en stock illimité. Désactivez le stock illimité et saisissez une quantité.",
            CATALOG_PRODUCT_VECTORISATION_PENDING:
                'Ce produit fait actuellement l’objet de traitements en arrière-plan. Réessayez dans quelques secondes.',
            CATALOG_PRODUCT_VECTORISATION_NOT_ELIGIBLE:
                "Ce produit n'est pas éligible à l'indexation pour la recherche IA. Il doit être actif, avoir l'indexation activée, et disposer d'un titre, d'une description et d'une catégorie.",
            CONNECTION_NOT_ACTIVE:
                "Vous avez besoin d'une connexion active et approuvée avec cette agence avant de pouvoir l'assigner. Envoyez ou vérifiez d'abord votre demande de connexion.",
        },

        stockRequest: {
            STOCK_REQUEST_NOT_PENDING:
                "Quelqu'un a répondu à cette demande avant vous. Nous l'avons rechargée — vérifiez le résultat avant d'en proposer une autre.",
            STOCK_REQUEST_NOT_YOURS:
                "Ce bouton n'était plus à jour. Nous avons actualisé les actions disponibles ici.",
            STOCK_REQUEST_ALREADY_PENDING:
                "Une demande de stock est déjà ouverte sur ce SKU. Retirez la vôtre, ou répondez à la leur, avant d'en proposer une autre.",
        },

        earnings: {
            EARNINGS_PAYOUT_ALREADY_PENDING:
                'Vous avez déjà une demande de versement en cours — suivez-la ci-dessous.',
            EARNINGS_PAYOUT_METHOD_MISSING:
                'Ajoutez un moyen de versement ci-dessous avant de demander un retrait.',
            EARNINGS_PAYOUT_NO_AVAILABLE_BALANCE:
                'Aucun solde disponible à retirer pour l’instant.',
            EARNINGS_PAYOUT_BELOW_MINIMUM:
                'Votre solde disponible est inférieur au minimum de 10 000 XAF requis pour un retrait.',
        },

        agencyConnection: {
            CONNECTION_NOT_ACTIVE:
                "Vous avez besoin d'une connexion active et approuvée avec cette agence avant de pouvoir l'assigner. Envoyez ou vérifiez d'abord votre demande de connexion.",
            CONNECTION_ALREADY_EXISTS: 'Vous avez déjà une demande de connexion avec cette agence.',
            CONNECTION_NOT_APPROVER: 'Vous ne pouvez pas approuver ou refuser une demande que vous avez envoyée.',
            CONNECTION_NOT_REQUESTER: "Vous ne pouvez pas retirer une demande que vous n'avez pas envoyée.",
            CONNECTION_NOT_PENDING: "Cette demande n'est plus en attente.",
            CONNECTION_INVALID_STATUS_TRANSITION:
                'Cette connexion ne peut pas être modifiée depuis son statut actuel.',
            CONNECTION_WRONG_REAPPROVAL_PARTY:
                "C'est à l'agence de réapprouver cette connexion, pas à vous.",
            CONNECTION_VENDOR_NOT_FOUND:
                "Votre profil vendeur n'a pas pu être identifié. Actualisez puis réessayez.",
            DELIVERY_AGENCY_NOT_FOUND: 'Cette agence de livraison est introuvable.',
        },

        order: {
            ORDER_ITEM_NOT_FOUND: 'Cet article est introuvable sur la commande.',
            ORDER_ITEM_NOT_REASSIGNABLE:
                'Cet article a déjà été expédié et ne peut plus être réattribué à une autre agence.',
            DIGITAL_ENTITLEMENT_NOT_FOUND: 'Ce droit d’accès est introuvable.',
            DIGITAL_ENTITLEMENT_ALREADY_REVOKED: 'Ce droit d’accès a déjà été révoqué.',
            DIGITAL_ENTITLEMENT_NOT_REVOKED: 'Ce droit d’accès n’est pas révoqué actuellement.',
            DIGITAL_ENTITLEMENT_EXPIRED: 'Ce droit d’accès a expiré et ne peut pas être rétabli.',
            DIGITAL_ENTITLEMENT_UNAUTHORIZED: "Vous n'avez pas accès à ce droit d'accès.",
        },

        /** Services réservables — la formulation générique parle de variantes. */
        service: {
            CATALOG_PRODUCT_INVALID_STATE:
                "Ce changement de statut n'est pas autorisé depuis le statut actuel du service.",
            CATALOG_PRODUCT_NO_DESCRIPTION: 'Une description du service est obligatoire.',
            CATALOG_PRODUCT_NO_VARIANTS: 'Définissez un prix de réservation avant de publier.',
            CATALOG_PRODUCT_NO_DEFAULT_VARIANT:
                'Un prix de réservation doit être défini avant de publier.',
            CATALOG_PRODUCT_VARIANT_ZERO_PRICE:
                'Le prix de la réservation doit être supérieur à 0.',
            CATALOG_PRODUCT_SERVICE_NO_CAPACITY:
                'Définissez le nombre de places par créneau (capacité) avant de publier.',
            CATALOG_SERVICE_VARIANT_EXISTS: 'Ce service a déjà sa variante de réservation.',
        },

        /** Paiement d’une formule ou de crédits — dire quoi faire, boîte ouverte. */
        billing: {
            BILLING_PENDING_PLAN_EXISTS:
                'Une formule est déjà en attente pour démarrer à la fin de l’actuelle. Attendez son activation avant d’en acheter une autre.',
            BILLING_PLAN_NOT_PURCHASABLE:
                'La formule Starter gratuite est la formule par défaut et ne peut pas être achetée.',
            BILLING_TOPUP_INVALID_STATE:
                'Ce paiement ne peut pas encore être vérifié. Réessayez dans un instant.',
            BILLING_PURCHASE_INVALID_STATE:
                'Ce paiement ne peut pas encore être vérifié. Réessayez dans un instant.',
            PAYMENT_CARD_DECLINED:
                'Votre carte a été refusée. Vérifiez les informations ou essayez une autre carte.',
        },
    },

    codes: {
        // ── Authentification ──────────────────────────────────────────────────
        AUTH_INVALID_CREDENTIALS: 'Cet e-mail ou ce mot de passe est incorrect.',
        AUTH_TOKEN_EXPIRED: 'Votre session a expiré. Veuillez vous reconnecter.',
        AUTH_TOKEN_INVALID: "Votre session n'est plus valide. Veuillez vous reconnecter.",
        AUTH_MISSING_TOKEN: 'Connectez-vous pour continuer.',
        AUTH_ROLE_NOT_FOUND: "Ce compte n'a pas de profil vendeur.",
        AUTH_ROLE_ALREADY_EXISTS: 'Ce compte possède déjà ce rôle.',
        AUTH_ROLE_REQUIRED: 'Ce compte a besoin du rôle vendeur pour continuer.',
        AUTH_ACCOUNT_NOT_FOUND: 'Ce compte est introuvable.',
        AUTH_PHONE_TAKEN: 'Ce numéro de téléphone est déjà utilisé par un autre compte.',
        AUTH_EMAIL_TAKEN: 'Cette adresse e-mail est déjà utilisée par un autre compte.',
        AUTH_EMAIL_ALREADY_VERIFIED: 'Cette adresse e-mail est déjà vérifiée.',
        AUTH_EMAIL_MISSING: "Ajoutez d'abord une adresse e-mail à votre compte.",
        AUTH_VERIFY_TOKEN_INVALID: 'Ce lien de vérification est invalide ou a expiré.',
        AUTH_WA_ALREADY_VERIFIED: 'Votre numéro WhatsApp est déjà vérifié.',
        AUTH_PROFILE_NOT_FOUND: 'Votre profil est introuvable.',
        AUTH_PHONE_REQUIRED_FOR_WA: 'Ajoutez un numéro de téléphone avant de lier WhatsApp.',
        AUTH_UNSUPPORTED_ROLE: 'Ce type de compte ne peut pas utiliser le tableau de bord vendeur.',
        AUTH_REFRESH_TOKEN_INVALID: 'Votre session a expiré. Veuillez vous reconnecter.',
        AUTH_SESSION_EXPIRED: 'Votre session a expiré. Veuillez vous reconnecter.',
        AUTH_USER_NOT_FOUND: 'Cet utilisateur est introuvable.',
        AUTH_ROLE_PROFILE_NOT_FOUND: 'Le profil de ce rôle est introuvable.',
        AUTH_WA_PHONE_ID_REQUIRED: "WhatsApp n'est pas encore entièrement configuré.",
        AUTH_FORBIDDEN: "Vous n'avez pas l'autorisation de faire cela.",
        AUTH_OAUTH_STATE_INVALID: "Cette tentative de connexion n'a pas pu être vérifiée. Réessayez.",
        AUTH_OAUTH_STATE_EXPIRED: 'Cette tentative de connexion a pris trop de temps. Réessayez.',
        AUTH_PASSWORD_CHANGED:
            'Votre mot de passe a été modifié : toutes les autres sessions ont été déconnectées. Reconnectez-vous — et si ce n’était pas vous, changez-le immédiatement.',
        AUTH_ACCOUNT_SUSPENDED:
            'Ce compte a été suspendu. Contactez le support pour le faire réexaminer.',
        AUTH_VENDOR_SUSPENDED:
            'Votre boutique a été suspendue, le tableau de bord est donc indisponible. Contactez le support pour la faire réexaminer.',
        AUTH_ADMIN_CALLER_NOT_CONFIGURED: "Cette requête n'a pas pu être autorisée.",
        AUTH_ADMIN_CALLER_TOKEN_INVALID: "Cette requête n'a pas pu être autorisée.",
        AUTH_ADMIN_CALLER_ACTOR_MISSING: "Cette requête n'a pas pu être autorisée.",

        // ── Paiements ─────────────────────────────────────────────────────────
        PAYMENT_ORDER_NOT_FOUND: 'Cette commande est introuvable.',
        PAYMENT_ORDER_ALREADY_PAID: 'Cette commande a déjà été payée.',
        PAYMENT_INVALID_ORDER_STATUS: "Le statut de cette commande ne permet pas de paiement pour l'instant.",
        PAYMENT_GATEWAY_NOT_SUPPORTED: "Ce moyen de paiement n'est pas pris en charge ici.",
        PAYMENT_INITIATION_FAILED: "Nous n'avons pas pu démarrer le paiement. Réessayez.",
        PAYMENT_VERIFICATION_FAILED: "Nous n'avons pas pu confirmer ce paiement. Réessayez.",
        PAYMENT_BOOKING_NOT_FOUND: 'Cette réservation est introuvable.',
        PAYMENT_BOOKING_CANCELLED: 'Cette réservation a été annulée et ne peut pas être payée.',
        PAYMENT_BOOKING_NO_PAYMENT_REQUIRED: 'Cette réservation ne nécessite aucun paiement.',
        PAYMENT_BOOKING_ALREADY_PAID: 'Cette réservation a déjà été payée.',
        PAYMENT_BOOKING_IN_PROGRESS: 'Un paiement est déjà en cours pour cette réservation.',
        PAYMENT_TRANSACTION_NOT_FOUND: 'Cette transaction est introuvable.',
        PAYMENT_WEBHOOK_INVALID_PAYLOAD: "Le prestataire de paiement a envoyé un contenu illisible.",
        PAYMENT_MISSING_BOOKING_ID: 'Il manque la référence de réservation pour ce paiement.',
        PAYMENT_GATEWAY_NOT_IMPLEMENTED: "Ce moyen de paiement n'est pas encore disponible.",
        PAYMENT_CARD_DECLINED: 'La carte a été refusée. Essayez un autre moyen de paiement.',
        PAYMENT_OPERATOR_UNDETERMINED:
            "Nous n'avons pas pu déterminer l'opérateur mobile money de ce numéro. Choisissez-le manuellement.",
        PAYMENT_CURRENCY_NOT_SUPPORTED: 'Ce moyen de paiement n’accepte pas cette devise.',
        PAYMENT_WEBHOOK_AMOUNT_MISMATCH:
            "Le montant confirmé par le prestataire de paiement ne correspond pas à celui débité. Le paiement n'a pas été accepté.",
        PAYMENT_OTP_INVALID: 'Ce code est incorrect. Vérifiez-le et réessayez.',
        PAYMENT_OTP_NOT_REQUIRED: 'Ce paiement n’attend aucun code.',
        PAYMENT_OTP_ATTEMPTS_EXCEEDED:
            'Trop de codes incorrects. Relancez le paiement pour en obtenir un nouveau.',
        PAYMENT_CART_NOT_FOUND: 'Ce panier est introuvable.',
        PAYMENT_CART_NO_PAYABLE_ORDERS: "Il n'y a rien à payer dans ce panier.",
        PAYMENT_CART_MIXED_CURRENCY: 'Tous les articles d’un même paiement doivent utiliser la même devise.',
        PAYMENT_REFERENCE_REQUIRED: 'Une référence de paiement est obligatoire.',
        PAYMENT_ORDER_IS_COD: 'Cette commande est en paiement à la livraison.',
        STRIPE_WEBHOOK_SIGNATURE_INVALID: "Nous n'avons pas pu vérifier cette notification de paiement.",
        WEBHOOK_SECRET_INVALID:
            "Nous n'avons pas pu vérifier cette notification. Contactez le support.",
        NOTCHPAY_REQUEST_FAILED:
            'Le prestataire de paiement a rejeté cette demande. Réessayez.',
        NOTCHPAY_UNREACHABLE:
            "Nous n'avons pas pu joindre le prestataire de paiement. Réessayez dans quelques minutes.",
        MYCOOLPAY_REQUEST_FAILED:
            'Le prestataire de paiement a rejeté cette demande. Réessayez.',
        MYCOOLPAY_UNREACHABLE:
            "Nous n'avons pas pu joindre le prestataire de paiement. Réessayez dans quelques minutes.",
        PAYMENT_METHOD_NOT_FOUND: 'Ce moyen de paiement est introuvable.',
        PAYMENT_METHOD_LIMIT_REACHED:
            'Vous avez atteint le nombre maximum de moyens de paiement enregistrés. Supprimez-en un pour en ajouter un autre.',

        // ── Remboursements ────────────────────────────────────────────────────
        REFUND_NOT_ELIGIBLE: "Cette commande n'est pas éligible à un remboursement.",
        REFUND_WINDOW_EXPIRED: 'Le délai de remboursement de cette commande est écoulé.',
        REFUND_POLICY_DISABLED: 'Les remboursements sont désactivés dans votre politique de retour.',
        REFUND_AMOUNT_EXCEEDS_MAX: 'Ce remboursement dépasse le montant encore remboursable sur cette commande.',
        REFUND_ALREADY_FULLY_REFUNDED: 'Cette commande a déjà été intégralement remboursée.',
        REFUND_PAYMENT_NOT_FOUND: 'Le paiement de cette commande est introuvable.',
        REFUND_ORDER_NOT_PAID: "Cette commande n'a pas été payée, il n'y a donc rien à rembourser.",
        REFUND_GATEWAY_FAILED: "Le prestataire de paiement n'a pas pu traiter le remboursement. Réessayez.",
        REFUND_GATEWAY_NOT_SUPPORTED: 'Les remboursements ne sont pas pris en charge pour ce moyen de paiement.',
        REFUND_ORDER_NOT_FOUND: "Nous n'avons pas trouvé cette commande.",
        REFUND_ORDER_IS_COD:
            "Cette commande a été payée en espèces à la livraison : il n'y a aucun paiement à rembourser. Réglez cela directement avec le client.",
        REFUND_POLICY_OVERRIDE_REQUIRED: 'Ce remboursement sort de votre politique de retour.',
        ORDER_DISPUTE_NOT_ACTIVE: "Aucun litige n'est ouvert sur cette commande.",

        // ── Tickets ───────────────────────────────────────────────────────────
        TICKET_NOT_FOUND: 'Ce ticket est introuvable.',
        TICKET_UPDATE_FAILED: "Nous n'avons pas pu mettre à jour le ticket. Réessayez.",
        TICKET_ASSIGN_FAILED: "Nous n'avons pas pu attribuer le ticket. Réessayez.",
        TICKET_PRIORITY_UPDATE_FAILED: "Nous n'avons pas pu changer la priorité. Réessayez.",
        TICKET_CLOSE_FAILED: "Nous n'avons pas pu fermer le ticket. Réessayez.",
        TICKET_REOPEN_FAILED: "Nous n'avons pas pu rouvrir le ticket. Réessayez.",
        TICKET_GENERAL_UPDATE_FAILED: "Nous n'avons pas pu enregistrer vos modifications. Réessayez.",
        TICKET_ACCESS_DENIED: "Vous n'avez pas accès à ce ticket.",
        TICKET_FOLLOWER_LIMIT_EXCEEDED: 'Ce ticket a déjà atteint le nombre maximum d’abonnés.',
        TICKET_ATTACHMENT_LIMIT_EXCEEDED: 'Ce ticket a déjà atteint le nombre maximum de pièces jointes.',
        TICKET_ATTACHMENT_MISSING: "Joignez un fichier avant d'envoyer.",
        TICKET_PRIORITY_LOCKED: 'La priorité de ce ticket est fixée par le support et ne peut pas être modifiée.',
        TICKET_INVALID_STATUS_TRANSITION: 'Ce ticket ne peut pas passer à ce statut depuis son état actuel.',
        TICKET_CLOSED: 'Ce ticket est fermé. Rouvrez-le pour continuer.',
        TICKET_WAITING_TARGET_NOT_PARTICIPANT: 'Vous ne pouvez attendre que la réponse d’un participant à ce ticket.',
        TICKET_CUSTOMER_PRIVATE_NOTE_FORBIDDEN: 'Les notes privées ne sont pas visibles par les clients.',
        TICKET_REQUIRED_INFO_MISSING: 'Des informations obligatoires manquent sur ce ticket.',
        TICKET_ENTITY_NOT_FOUND: "L'élément auquel ce ticket fait référence est introuvable.",

        // ── Livraison numérique ───────────────────────────────────────────────
        DIGITAL_INVALID_ENTITLEMENT_ID: "Cette référence de téléchargement n'est pas valide.",
        DIGITAL_ENTITLEMENT_NOT_FOUND: 'Ce téléchargement est introuvable.',
        DIGITAL_ENTITLEMENT_UNAUTHORIZED: "Vous n'avez pas accès à ce téléchargement.",
        DIGITAL_ENTITLEMENT_REVOKED: 'L’accès à ce téléchargement a été révoqué.',
        DIGITAL_ENTITLEMENT_EXPIRED: 'Ce lien de téléchargement a expiré.',
        DIGITAL_ENTITLEMENT_ALREADY_REVOKED: 'Ce téléchargement a déjà été révoqué.',
        DIGITAL_ENTITLEMENT_NOT_REVOKED: "Ce téléchargement n'est pas révoqué.",
        DIGITAL_DOWNLOAD_LIMIT_EXCEEDED: 'La limite de téléchargements de cet achat est atteinte.',
        DIGITAL_TOKEN_INVALID: "Ce lien de téléchargement n'est pas valide.",
        DIGITAL_ENTITLEMENT_CONFIG_MISSING: 'Les paramètres de livraison numérique manquent pour ce produit.',
        DIGITAL_ENTITLEMENT_CONFIG_INACTIVE: 'La livraison numérique est désactivée pour ce produit.',
        DIGITAL_ASSET_NOT_FOUND: 'Ce fichier numérique est introuvable.',
        DIGITAL_ASSET_ACCESS_DENIED: "Vous n'avez pas accès à ce fichier numérique.",
        DIGITAL_ASSET_IN_USE: 'Ce fichier numérique est rattaché à un produit et ne peut pas être supprimé.',

        // ── Canaux de messagerie ──────────────────────────────────────────────
        WHATSAPP_ROLE_NOT_SUPPORTED: "WhatsApp n'est pas disponible pour ce type de compte.",
        WHATSAPP_NOT_LINKED: "Liez d'abord votre numéro WhatsApp.",
        WHATSAPP_LINK_FAILED: "Nous n'avons pas pu lier WhatsApp. Réessayez.",
        WHATSAPP_INVALID_PAYLOAD: "Nous n'avons pas pu envoyer ce message WhatsApp.",
        WHATSAPP_POLICY_VIOLATION: "Ce message ne respecte pas les règles de messagerie de WhatsApp.",
        WHATSAPP_PROVIDER_REJECTED: 'WhatsApp a rejeté ce message. Réessayez plus tard.',
        WHATSAPP_VALIDATION_ERROR: "Ce message WhatsApp n'a pas pu être validé.",
        WHATSAPP_IDEMPOTENCY_REQUIRED: 'Il manque une référence à cette requête WhatsApp.',
        WHATSAPP_DUPLICATE_MESSAGE: 'Ce message a déjà été envoyé.',
        WHATSAPP_UNSUPPORTED_MESSAGE_TYPE: "Ce type de message n'est pas pris en charge sur WhatsApp.",
        TELEGRAM_NOT_LINKED: "Liez d'abord votre compte Telegram.",
        TELEGRAM_LINK_FAILED: "Nous n'avons pas pu lier Telegram. Réessayez.",
        TELEGRAM_LINK_NOT_FOUND: 'Ce lien Telegram a expiré. Générez-en un nouveau.',

        // ── Google / agendas ──────────────────────────────────────────────────
        GOOGLE_MISSING_CLIENT_ID: "La connexion Google n'est pas configurée. Contactez le support.",
        GOOGLE_MISSING_CLIENT_SECRET: "La connexion Google n'est pas configurée. Contactez le support.",
        GOOGLE_MISSING_REDIRECT_URI: "La connexion Google n'est pas configurée. Contactez le support.",
        GOOGLE_PROFILE_FETCH_FAILED: "Nous n'avons pas pu lire votre profil Google. Réessayez.",
        GOOGLE_NO_ACCESS_TOKEN: "Google n'a pas accordé l'accès. Reconnectez-vous.",
        GOOGLE_NO_REFRESH_TOKEN: "L'accès Google n'a pas pu être conservé. Reconnectez-vous.",
        GOOGLE_CALENDAR_NOT_CONNECTED: "Connectez d'abord votre agenda Google.",
        GOOGLE_EVENT_MISSING_ID: 'Il manque la référence de cet événement d’agenda.',
        GOOGLE_EVENT_MISSING_DATETIME: "Cet événement d'agenda n'a ni date ni heure.",
        GOOGLE_TOKEN_ENCRYPTION_KEY_MISSING: "La synchronisation d'agenda n'est pas configurée. Contactez le support.",
        GOOGLE_TOKEN_INVALID_FORMAT: 'Votre connexion à l’agenda est invalide. Reconnectez-vous.',
        INTEGRATION_UNSUPPORTED_CALENDAR_PROVIDER: "Ce fournisseur d'agenda n'est pas pris en charge.",
        BOOKING_CALENDAR_SYNC_FAILED: "La réservation a été enregistrée, mais la synchronisation de l'agenda a échoué.",

        // ── Base de données / infrastructure ──────────────────────────────────
        DATABASE_UNAVAILABLE: 'Le service est momentanément indisponible. Réessayez sous peu.',
        DATABASE_CONNECTION_ERROR: 'Le service est momentanément indisponible. Réessayez sous peu.',
        DATABASE_UNIQUE_CONSTRAINT_VIOLATION: 'Cette valeur est déjà utilisée.',
        COMMAND_ALREADY_REGISTERED: 'Une erreur est survenue de notre côté. Réessayez.',
        COMMAND_NOT_FOUND: 'Une erreur est survenue de notre côté. Réessayez.',
        MAIL_TEMPLATE_NOT_FOUND: "Nous n'avons pas pu envoyer cet e-mail. Réessayez.",

        // ── Commandes ─────────────────────────────────────────────────────────
        ORDER_NOT_FOUND: 'Cette commande est introuvable.',
        ORDER_PAYMENT_FAILED: 'Le paiement de cette commande a échoué.',
        ORDER_TERMINAL_STATE: 'Cette commande est terminée et ne peut plus être modifiée.',
        ORDER_INVALID_TRANSITION: 'Cette commande ne peut pas passer à ce statut depuis son état actuel.',
        ORDER_PAYMENT_REQUIRED: 'Cette commande doit être payée avant de poursuivre.',
        ORDER_PAYMENT_FAILED_STATE: 'Cette commande est en attente car son paiement a échoué.',
        ORDER_DISPUTE_HOLD: 'Cette commande est bloquée le temps qu’un litige soit résolu.',
        ORDER_WRONG_TYPE: "Cette action ne s'applique pas à ce type de commande.",
        ORDER_DELIVERY_AGENCY_NOT_FOUND: 'Cette agence de livraison est introuvable.',
        ORDER_ITEM_NOT_FOUND: 'Cet article de commande est introuvable.',
        ORDER_ITEM_NOT_REASSIGNABLE: 'Cet article est trop avancé pour être réattribué.',
        ORDER_ALREADY_CANCELLED: 'Cette commande est déjà annulée.',
        ORDER_NOT_CANCELLABLE: 'Cette commande ne peut plus être annulée.',
        ORDER_CANCEL_REQUIRES_REFUND: "Remboursez cette commande avant de l'annuler.",
        CANCELLATION_NOT_ALLOWED: "Votre politique d'annulation ne permet pas d'annuler cela.",
        ORDER_CART_EMPTY: 'Ce panier est vide.',
        ORDER_CART_INVALID: "Ce panier n'est plus valide. Reconstituez-le.",
        ORDER_DELIVERY_ADDRESS_REQUIRED:
            'Cette commande a besoin d’une adresse de livraison pour continuer.',
        ORDER_PRODUCT_NOT_FOUND: 'Un des produits de cette commande est introuvable.',
        ORDER_VENDOR_NOT_FOUND: 'Le vendeur de cette commande est introuvable.',
        ORDER_NO_DELIVERY_AGENCY:
            "Aucune agence de livraison n'est définie pour cette commande. Connectez une agence puis réessayez.",

        // ── Expéditions ───────────────────────────────────────────────────────
        SHIPMENT_NOT_FOUND: 'Cette expédition est introuvable.',
        SHIPMENT_INVALID_STATUS_TRANSITION: 'Cette expédition ne peut pas passer à ce statut depuis son état actuel.',
        SHIPMENT_REJECTION_NOT_ALLOWED: 'Cette expédition ne peut plus être refusée.',
        SHIPMENT_AGENT_NOT_IN_AGENCY: "Ce livreur n'appartient pas à cette agence.",
        SHIPMENT_ACCESS_DENIED: "Vous n'avez pas accès à cette expédition.",
        SHIPMENT_ALREADY_CONFIRMED: 'Cette expédition a déjà été confirmée.',
        SHIPMENT_CONFIRMATION_NOT_ALLOWED: 'Cette expédition ne peut pas encore être confirmée.',
        SHIPMENT_TRACKING_NUMBER_GENERATION_FAILED:
            "Nous n'avons pas pu générer un numéro de suivi. Réessayez.",
        SHIPMENT_OFFER_NOT_FOUND: 'Cette proposition de livraison est introuvable.',
        SHIPMENT_OFFER_NOT_PENDING: 'Cette proposition de livraison a déjà reçu une réponse.',
        SHIPMENT_OFFER_EXPIRED: 'Cette proposition de livraison a expiré.',
        SHIPMENT_NOT_OFFERABLE: "Cette expédition ne peut pas être proposée à un livreur pour l'instant.",
        SHIPMENT_ALREADY_HAS_AGENT: 'Un livreur est déjà affecté à cette expédition.',
        SHIPMENT_ALREADY_HAS_PENDING_OFFER: 'Une proposition est déjà en attente de réponse pour cette expédition.',
        SHIPMENT_NO_ELIGIBLE_AGENTS: "Aucun livreur n'est disponible pour cette expédition actuellement.",
        SHIPMENT_AGENT_NOT_ASSIGNED: "Aucun livreur n'a encore accepté cette expédition.",
        SHIPMENT_NOT_REASSIGNABLE: 'Cette expédition ne peut plus être réattribuée.',
        SHIPMENT_REASSIGNMENT_NOT_ALLOWED: 'Vous ne pouvez pas réattribuer cette expédition.',
        SHIPMENT_REASSIGN_SAME_AGENT: 'Cette expédition est déjà chez ce livreur.',
        SHIPMENT_REASSIGN_REQUIRES_MANUAL_AGENT: 'Choisissez le livreur à qui réattribuer cette expédition.',
        SHIPMENT_REASSIGNMENT_CONFLICT: 'Cette expédition a changé pendant la réattribution. Actualisez puis réessayez.',
        SHIPMENT_CANCEL_NOT_ALLOWED: 'Cette expédition ne peut plus être annulée.',
        SHIPMENT_CANCEL_CONFLICT: "Cette expédition a changé pendant l'annulation. Actualisez puis réessayez.",
        SHIPMENT_STATUS_CONFLICT: 'Cette expédition a été mise à jour ailleurs. Actualisez puis réessayez.',
        SHIPMENT_PROOF_NOT_ALLOWED: 'La preuve de livraison ne peut être ajoutée qu’une fois la livraison terminée.',
        SHIPMENT_PROOF_NOT_FOUND: 'Cette preuve de livraison est introuvable.',
        SHIPMENT_PROOF_FILE_REQUIRED: 'Joignez une photo comme preuve de livraison.',

        // ── Configuration / stockage ──────────────────────────────────────────
        CONFIG_MISSING_WA_ACCESS_TOKEN: "WhatsApp n'est pas configuré. Contactez le support.",
        CONFIG_MISSING_WA_PHONE_ID: "WhatsApp n'est pas configuré. Contactez le support.",
        CONFIG_MISSING_STORAGE_PROVIDER: "Le stockage de fichiers n'est pas configuré. Contactez le support.",
        CONFIG_NOTIFICATION_CATALOG_INCOMPLETE: 'Les paramètres de notification sont indisponibles. Contactez le support.',
        CONFIG_INVALID_STORAGE_PROVIDER: 'Le stockage de fichiers est mal configuré. Contactez le support.',
        CONFIG_INVALID_GEO_PROVIDER: "La recherche d'adresse est mal configurée. Contactez le support.",
        CONFIG_INVALID_UPLOAD_SCANNER:
            'L’analyse des fichiers est mal configurée. Contactez le support.',
        STORAGE_UPLOAD_FAILED: "L'envoi a échoué. Réessayez.",
        UPLOAD_POLICY_VIOLATION: "Certains fichiers n'ont pas pu être envoyés car ils ne respectent pas les règles d'envoi.",
        STORAGE_FILE_NOT_FOUND: 'Ce fichier est introuvable.',
        STORAGE_DELETE_FAILED: "Nous n'avons pas pu supprimer ce fichier. Réessayez.",
        STORAGE_QUOTA_EXCEEDED: 'Vous avez utilisé tout votre espace de stockage. Libérez de la place ou changez de forfait.',
        STORAGE_CLEANUP_FAILED: "Nous n'avons pas pu nettoyer ces fichiers. Réessayez.",
        // Le stockage ne peut pas servir les octets de ce fichier directement.
        STORAGE_DOWNLOAD_NOT_SUPPORTED: 'Ce fichier ne peut pas être téléchargé ici.',
        // Les trois codes PAYMENT_LINK_* relèvent du paiement par lien côté client.
        PAYMENT_LINK_NOT_FOUND: 'Ce lien de paiement n’est pas valide.',
        PAYMENT_LINK_NOT_APPLICABLE: 'Un lien de paiement ne s’applique pas à cette commande.',
        PAYMENT_LINK_NOT_PAYABLE: 'Ce lien de paiement ne peut plus être payé.',

        // ── Adresses & géocodage ──────────────────────────────────────────────
        GEO_PROVIDER_NOT_CONFIGURED: "La recherche d'adresse est indisponible. Saisissez l'adresse manuellement.",
        GEO_PROVIDER_UNAVAILABLE: "La recherche d'adresse est momentanément indisponible. Réessayez sous peu.",
        GEO_SEARCH_FAILED: "Nous n'avons pas pu rechercher cette adresse. Réessayez.",
        ADDRESS_GEO_REQUIRED: 'Choisissez une adresse dans les résultats pour la situer sur la carte.',
        ADDRESS_COUNTRY_MISMATCH: 'Cette adresse se trouve en dehors de votre pays enregistré.',
        PROFILE_COUNTRY_IMMUTABLE:
            "Votre pays a été défini lors de l'inscription et ne peut plus être modifié. Contactez le support si besoin.",

        // ── Profil vendeur & inscription ──────────────────────────────────────
        VENDOR_UNSUPPORTED_FISCAL_CALENDAR: "Ce calendrier fiscal n'est pas pris en charge.",
        VENDOR_FISCAL_CALENDAR_INVALID: "Ce calendrier fiscal n'est pas valide.",
        VENDOR_BUSINESS_ADDRESS_IN_USE:
            "Cette adresse sert de point de retrait à un ou plusieurs produits. Réattribuez-les d'abord.",
        VENDOR_NOTIFICATION_NOT_FOUND: 'Cette notification est introuvable.',
        VENDOR_NOTIFICATION_CHANNEL_NOT_VERIFIED: "Vérifiez ce canal avant d'y activer les notifications.",
        VENDOR_NOTIFICATION_DELIVERY_FAILED: "Nous n'avons pas pu remettre cette notification.",
        VENDOR_ONBOARDING_CONCURRENT_MODIFICATION:
            'Votre profil a été modifié dans une autre session. Actualisez puis réessayez.',
        VENDOR_ONBOARDING_STEP_INCOMPLETE: 'Terminez l’étape en cours avant de continuer.',
        VENDOR_ONBOARDING_STEP_INVALID: "Cette étape n'est pas valide.",
        VENDOR_ONBOARDING_ALREADY_COMPLETED: 'Votre configuration est déjà terminée.',
        VENDOR_CUSTOMER_NOT_FOUND: 'Ce client est introuvable.',
        VENDOR_CUSTOMER_FLAG_NOT_FOUND: 'Cette étiquette client est introuvable.',
        VENDOR_CUSTOMER_FLAG_DUPLICATE: 'Ce client porte déjà cette étiquette.',
        VENDOR_POLICY_DOCUMENT_MISSING: "Envoyez d'abord le document de politique.",
        VENDOR_POLICY_DOCUMENT_TYPE_INVALID: "Ce type de fichier n'est pas accepté pour un document de politique.",

        // ── Catalogue : stock & opérations en lot ─────────────────────────────
        CATALOG_INSUFFICIENT_STOCK: "Le stock est insuffisant pour cela.",
        CATALOG_OVERSALE_NOT_ALLOWED: 'La vente au-delà du stock disponible est désactivée pour ce produit.',
        CATALOG_INVALID_CSV_FORMAT: "Ce fichier CSV n'a pas le format attendu.",
        CATALOG_INVALID_CSV: "Nous n'avons pas pu lire ce fichier CSV. Vérifiez les colonnes puis réessayez.",
        CATALOG_BULK_VALIDATION_FAILED: "Certaines lignes n'ont pas pu être importées. Corrigez-les puis réessayez.",
        CATALOG_RESERVATION_EXPIRED: 'Cette réservation de stock a expiré.',
        CATALOG_TRANSACTION_LIMIT_EXCEEDED: 'Cela dépasse ce qui peut être traité en une fois. Procédez par lots plus petits.',
        CATALOG_BULK_LIMIT_EXCEEDED: 'Cela dépasse le nombre de lignes traitables en une fois. Procédez par lots plus petits.',
        CATALOG_BULK_EMPTY: "Il n'y a rien à mettre à jour.",
        CATALOG_BULK_TRANSACTION_LIMIT: 'Trop de modifications à la fois. Procédez par lots plus petits.',
        CATALOG_BULK_UPDATE_FAILED: 'La mise à jour groupée a échoué. Aucune modification enregistrée.',

        // ── Catalogue : produits ──────────────────────────────────────────────
        CATALOG_PRODUCT_NOT_FOUND: 'Ce produit est introuvable.',
        CATALOG_PRODUCT_ACCESS_DENIED: "Vous n'avez pas accès à ce produit.",
        CATALOG_PRODUCT_INVALID_STATE: 'Le statut de ce produit ne permet pas cette action.',
        CATALOG_PRODUCT_INVALID_TITLE: 'Saisissez un titre de produit valide.',
        CATALOG_PRODUCT_NO_DESCRIPTION: 'Ajoutez une description avant de publier.',
        CATALOG_PRODUCT_ALREADY_PUBLISHED: 'Ce produit est déjà publié.',
        CATALOG_PRODUCT_NO_VARIANTS: 'Ajoutez au moins une variante avant de publier.',
        CATALOG_PRODUCT_NO_DEFAULT_VARIANT: 'Choisissez une variante par défaut avant de publier.',
        CATALOG_PRODUCT_DIGITAL_NO_ASSET: 'Joignez le fichier que les acheteurs téléchargeront avant de publier.',
        CATALOG_PRODUCT_SERVICE_NO_DURATION: 'Indiquez la durée de ce service avant de publier.',
        CATALOG_PRODUCT_SERVICE_NO_CAPACITY: 'Indiquez combien de réservations vous pouvez accepter avant de publier.',
        CATALOG_PRODUCT_SERVICE_NO_AVAILABILITY: 'Ajoutez des horaires de disponibilité avant de publier.',
        CATALOG_PRODUCT_VARIANT_ZERO_PRICE: 'Chaque variante doit avoir un prix supérieur à zéro avant publication.',
        CATALOG_PRODUCT_NOT_DIGITAL: "Ce n'est pas un produit numérique.",
        CATALOG_PRODUCT_NO_DIGITAL_CONFIG: "Configurez d'abord la livraison numérique de ce produit.",
        CATALOG_PRODUCT_NO_DELIVERY_AGENCY: 'Choisissez une agence de livraison pour ce produit avant de publier.',
        CATALOG_PRODUCT_NO_PICKUP_LOCATION: 'Choisissez un point de retrait pour ce produit avant de publier.',
        CATALOG_PRODUCT_INVALID_PICKUP_LOCATION: "Ce point de retrait ne fait plus partie de vos adresses.",
        CATALOG_PRODUCT_VECTORISATION_PENDING: "Ce produit est encore en cours d'indexation. Réessayez sous peu.",
        CATALOG_PRODUCT_VECTORISATION_NOT_ELIGIBLE: 'Ce produit ne peut pas être indexé pour la recherche.',
        CATALOG_PRODUCT_SIMPLE_MODE_LOCKED:
            'Ceci est un produit simple. Convertissez-le en produit avancé pour utiliser des options et plusieurs variantes.',
        CATALOG_PRODUCT_NOT_SIMPLE_MODE: "Ceci est un produit avancé et ne peut pas être modifié comme un produit simple.",
        CATALOG_PRODUCT_INVALID_TYPE: "Cela ne s'applique pas à ce type de produit.",
        CATALOG_PRODUCT_VENDOR_SUSPENDED:
            'Votre boutique est suspendue : ses annonces ne peuvent pas être remises en vente. Contactez le support pour la faire réexaminer.',
        VENDOR_PRODUCT_NOT_SUSPENDABLE: 'Seul un produit en vente peut en être retiré.',
        VENDOR_PRODUCT_NOT_OVERSIGHT_SUSPENDED:
            "Ce produit a été suspendu par quelqu'un d'autre : c'est à l'auteur de la suspension de le rétablir.",
        VENDOR_PRODUCT_UNSUSPEND_BLOCKED:
            'Ce produit ne peut pas être remis en vente tant que les problèmes signalés ne sont pas corrigés.',

        // ── Catalogue : variantes ─────────────────────────────────────────────
        CATALOG_VARIANT_NOT_FOUND: 'Cette variante est introuvable.',
        CATALOG_VARIANT_ACCESS_DENIED: "Vous n'avez pas accès à cette variante.",
        CATALOG_VARIANT_ARCHIVED: 'Cette variante est archivée.',
        CATALOG_VARIANT_INVALID_STOCK: 'Saisissez une quantité en stock valide.',
        CATALOG_VARIANT_INVALID_PRICE: 'Saisissez un prix valide.',
        CATALOG_VARIANT_COMPARE_PRICE_INVALID: 'Le prix barré doit être supérieur au prix de vente.',
        CATALOG_VARIANT_BARGAIN_NOT_SUPPORTED:
            'La négociation du prix n’est pas disponible pour ce type de produit.',
        CATALOG_VARIANT_BARGAIN_PRICE_MISMATCH:
            'La fenêtre de négociation ne correspond plus au prix de « {{variant}} ». Rechargez la page et redéfinissez le plafond.',
        CATALOG_VARIANT_BARGAIN_RANGE_INVALID:
            'Le plafond de négociation de « {{variant}} » doit être au moins égal à son prix.',
        CATALOG_VARIANT_LIMIT_EXCEEDED: 'Ce produit a atteint son nombre maximum de variantes.',
        CATALOG_VARIANT_NO_OPTIONS: 'Ajoutez au moins une option avant de créer des variantes.',
        CATALOG_VARIANT_OPTION_EMPTY: 'Chaque option doit avoir au moins une valeur.',
        CATALOG_VARIANT_INSUFFICIENT_STOCK: 'Le stock de cette variante est insuffisant.',
        CATALOG_VARIANT_UNSUPPORTED_TYPE: "Ce type de variante n'est pas pris en charge.",
        CATALOG_VARIANT_NO_DIGITAL_ASSET: 'Joignez un fichier à cette variante numérique.',
        CATALOG_DIGITAL_VARIANT_LIMIT_EXCEEDED: 'Ce produit a atteint son nombre maximum de variantes numériques.',
        CATALOG_SERVICE_VARIANT_EXISTS: "Un service ne peut avoir qu'une seule variante.",
        CATALOG_VARIANT_INVALID_QUANTITY: 'Saisissez une quantité valide.',
        CATALOG_VARIANT_STOCK_ONLY_PHYSICAL: 'Seuls les produits physiques suivent un stock.',
        CATALOG_VARIANT_RESERVATION_CONFLICT: 'Ce stock a changé pendant votre modification. Actualisez puis réessayez.',
        CATALOG_VARIANT_RESERVATION_NOT_FOUND: 'Cette réservation de stock est introuvable.',
        CATALOG_VARIANT_SKU_EXISTS: 'Ce SKU est déjà utilisé par une autre variante.',

        // ── Stockage en agence : produits entreposés et demandes de stock ─────
        INVENTORY_STOCK_LEVEL_NOT_FOUND: "Aucun stock enregistré pour cet article.",
        INVENTORY_LOCATION_UNKNOWN: "Cet entrepôt n'est pas exploité par l'agence.",
        INVENTORY_PRODUCT_NOT_SUSPENDABLE: 'Seul un produit en vente peut en être retiré.',
        INVENTORY_PRODUCT_NOT_AGENCY_SUSPENDED:
            "Ce produit n'a pas été suspendu par l'agence de stockage : elle ne peut donc pas le rétablir.",
        INVENTORY_PRODUCT_UNSUSPEND_BLOCKED:
            'Ce produit ne peut pas être remis en vente tant que les problèmes signalés ne sont pas corrigés.',
        INVENTORY_PRODUCT_NOT_STORED_HERE:
            "Ce produit n'est pas entreposé par une agence de livraison : son stock se modifie directement.",
        STOCK_REQUEST_NOT_FOUND: 'Cette demande de stock est introuvable.',
        STOCK_REQUEST_ALREADY_PENDING: 'Une demande de stock est déjà ouverte pour cette variante.',
        STOCK_REQUEST_NOT_PENDING: 'Cette demande de stock a déjà été traitée.',
        STOCK_REQUEST_NOT_YOURS: "Vous ne pouvez pas effectuer cette action sur cette demande de stock.",
        STOCK_REQUEST_STALE:
            "Ce produit n'est plus entreposé par cette agence : la demande ne s'applique plus.",
        STOCK_REQUEST_NO_CHANGE: 'C’est déjà la quantité enregistrée.',
        CATALOG_PRODUCT_AGENCY_STORAGE_INFINITE_STOCK:
            "Un produit entreposé chez une agence a besoin d'une quantité chiffrée. Désactivez le stock illimité sur chaque variante active.",

        // ── Catalogue : options ───────────────────────────────────────────────
        CATALOG_OPTION_NOT_FOUND: 'Cette option est introuvable.',
        CATALOG_OPTION_ACCESS_DENIED: "Vous n'avez pas accès à cette option.",
        CATALOG_OPTION_LIMIT_EXCEEDED: 'Ce produit a atteint son nombre maximum d’options.',
        CATALOG_OPTION_DUPLICATE_NAME: 'Une option portant ce nom existe déjà sur ce produit.',
        CATALOG_OPTION_REQUIRES_VALUES: 'Ajoutez au moins une valeur à cette option.',
        CATALOG_OPTION_DUPLICATE_VALUE: 'Cette valeur figure déjà dans cette option.',
        CATALOG_OPTION_VALUES_EXIST: 'Supprimez les valeurs de cette option avant de la supprimer.',
        CATALOG_OPTION_REQUIRES_NO_OPTIONS: "Ce produit ne peut pas avoir d'options.",
        CATALOG_INVALID_OPTION_ID: "Cette référence d'option n'est pas valide.",

        // ── Catalogue : fichiers & contenus numériques ────────────────────────
        CATALOG_DIGITAL_ASSET_ALREADY_EXISTS: 'Cette variante possède déjà un fichier numérique.',
        CATALOG_DIGITAL_ASSET_MISSING: "Joignez d'abord un fichier numérique.",
        CATALOG_DIGITAL_ASSET_MISSING_FILE: "Joignez d'abord un fichier numérique.",
        CATALOG_DIGITAL_ASSET_NOT_FOUND: 'Ce fichier numérique est introuvable.',
        CATALOG_DIGITAL_ASSET_ACCESS_DENIED: "Vous n'avez pas accès à ce fichier numérique.",
        CATALOG_DIGITAL_CONFIG_MISSING: "Configurez d'abord la livraison numérique de ce produit.",
        CATALOG_FILE_TOO_LARGE: 'Ce fichier est trop volumineux.',
        CATALOG_FILE_TYPE_INVALID: "Ce type de fichier n'est pas accepté.",
        CATALOG_FILE_NOT_FOUND: 'Ce fichier est introuvable.',
        CATALOG_FILE_ALREADY_ATTACHED: 'Ce fichier est déjà rattaché ici.',
        CATALOG_FILE_STILL_REFERENCED: 'Ce fichier est encore utilisé. Détachez-le avant de le supprimer.',
        CATALOG_IMAGE_LIMIT_EXCEEDED: 'Ce produit a atteint son nombre maximum d’images.',
        CATALOG_SHIPPING_NOT_FOUND: "Ces paramètres d'expédition sont introuvables.",
        CATALOG_SHIPPING_ACCESS_DENIED: "Vous n'avez pas accès à ces paramètres d'expédition.",

        // ── Catalogue : réservations & services ───────────────────────────────
        CATALOG_BOOKING_PRODUCT_NOT_FOUND: 'Ce service est introuvable.',
        CATALOG_BOOKING_INVALID_PRODUCT_TYPE: 'Seuls les services peuvent être réservés.',
        CATALOG_BOOKING_MISSING_SERVICE_CONFIG: 'Les paramètres de réservation manquent pour ce service.',
        CATALOG_BOOKING_PRODUCT_NOT_ACTIVE: "Ce service n'est pas actif et ne peut pas être réservé.",
        CATALOG_BOOKING_INVALID_PRICE: "Ce prix de réservation n'est pas valide.",
        CATALOG_BOOKING_NOT_IMPLEMENTED: "La réservation n'est pas encore disponible pour ce service.",

        // ── Statistiques ──────────────────────────────────────────────────────
        ANALYTICS_INVALID_DATE_RANGE: "Cette période n'est pas valide. La date de fin doit suivre la date de début.",
        ANALYTICS_UNSUPPORTED_TIMEZONE: "Ce fuseau horaire n'est pas pris en charge pour les rapports.",
        ANALYTICS_AGGREGATION_NOT_READY: 'Vos chiffres pour cette période ne sont pas encore prêts. Revenez bientôt.',
        ANALYTICS_DATE_RANGE_EXCEEDED: 'Cette période est trop longue. Choisissez un intervalle plus court.',

        // ── Agences de livraison ──────────────────────────────────────────────
        DELIVERY_AGENCY_NOT_FOUND: 'Cette agence de livraison est introuvable.',
        AGENCY_COVERAGE_AREA_INVALID: "Cette zone de couverture n'est pas valide.",
        DELIVERY_AGENT_NOT_FOUND: 'Ce livreur est introuvable.',
        DELIVERY_AGENCY_ALREADY_EXISTS: 'Cette agence de livraison existe déjà.',
        DELIVERY_ONBOARDING_STEP_INVALID: "Cette étape n'est pas valide.",
        DELIVERY_ONBOARDING_STEP_INCOMPLETE: 'Terminez l’étape en cours avant de continuer.',
        DELIVERY_ONBOARDING_ALREADY_COMPLETED: 'Cette configuration est déjà terminée.',
        DELIVERY_ONBOARDING_CONCURRENT_MODIFICATION: 'Ceci a été modifié dans une autre session. Actualisez puis réessayez.',
        DELIVERY_POLICY_DOCUMENT_MISSING: "Envoyez d'abord le document de politique.",
        DELIVERY_POLICY_DOCUMENT_TYPE_INVALID: "Ce type de fichier n'est pas accepté pour un document de politique.",
        DELIVERY_AGENT_ALREADY_IN_AGENCY: 'Ce livreur appartient déjà à cette agence.',
        DELIVERY_AGENT_NOT_IN_AGENCY: "Ce livreur n'appartient pas à cette agence.",
        DELIVERY_AGENT_HAS_ACTIVE_SHIPMENTS: 'Ce livreur a encore des livraisons en cours.',
        DELIVERY_AGENCY_NOTIFICATION_NOT_FOUND: 'Cette notification est introuvable.',
        DELIVERY_AGENCY_NOTIFICATION_CHANNEL_NOT_VERIFIED: "Vérifiez ce canal avant d'y activer les notifications.",
        DELIVERY_AGENCY_NOTIFICATION_DELIVERY_FAILED: "Nous n'avons pas pu remettre cette notification.",
        DELIVERY_AGENT_NOTIFICATION_NOT_FOUND: 'Cette notification est introuvable.',
        DELIVERY_AGENT_NOTIFICATION_CHANNEL_NOT_VERIFIED: "Vérifiez ce canal avant d'y activer les notifications.",
        DELIVERY_AGENT_NOTIFICATION_DELIVERY_FAILED: "Nous n'avons pas pu remettre cette notification.",

        // ── Livreurs ──────────────────────────────────────────────────────────
        AGENT_NOT_FOUND: 'Ce livreur est introuvable.',
        AGENT_NOT_ACTIVE: "Ce livreur n'est pas actif.",
        AGENT_SUSPENDED: 'Ce livreur est suspendu.',
        AGENT_ONBOARDING_ALREADY_COMPLETED: 'Cette configuration est déjà terminée.',
        AGENT_MEMBERSHIP_NOT_FOUND: "Cette adhésion à l'agence est introuvable.",
        AGENT_MEMBERSHIP_ALREADY_EXISTS: 'Cette adhésion existe déjà.',
        AGENT_MEMBERSHIP_NOT_PENDING: "Cette demande d'adhésion a déjà reçu une réponse.",
        AGENT_MEMBERSHIP_NOT_APPROVED: "Cette adhésion n'a pas été approuvée.",
        AGENT_MEMBERSHIP_ALREADY_APPROVED: 'Cette adhésion est déjà approuvée.',
        AGENT_MEMBERSHIP_SUSPENDED: 'Cette adhésion est suspendue.',
        AGENT_MEMBERSHIP_NOT_SUSPENDED: "Cette adhésion n'est pas suspendue.",
        AGENT_MEMBERSHIP_INVALID_TRANSITION: 'Cette adhésion ne peut pas passer à cet état depuis son état actuel.',
        AGENT_MEMBERSHIP_LIMIT_REACHED: 'Cette agence a atteint son nombre maximum de livreurs.',
        AGENT_MEMBERSHIP_HAS_ACTIVE_SHIPMENTS: 'Ce livreur a encore des livraisons en cours.',
        AGENT_TRANSFER_SAME_AGENCY: 'Ce livreur est déjà dans cette agence.',
        AGENT_AVAILABILITY_INVALID_TRANSITION: "Ce changement de disponibilité n'est pas autorisé actuellement.",
        AGENT_AT_CAPACITY: 'Ce livreur est à pleine capacité.',
        AGENT_TRACKING_NOT_ALLOWED: "Le suivi de position n'est pas activé pour ce livreur.",
        AGENT_DEVICE_LOCATION_DISABLED: 'La localisation est désactivée sur l’appareil de ce livreur.',
        AGENT_DEVICE_STATE_UNKNOWN: "Nous ne connaissons pas l'état de l'appareil de ce livreur.",
        AGENT_NOT_ELIGIBLE_FOR_ASSIGNMENT: 'Ce livreur ne peut pas prendre en charge cette expédition.',
        AGENT_COD_THRESHOLD_OUT_OF_BOUNDS: 'Cette limite de paiement à la livraison est hors des bornes autorisées.',
        AGENT_COD_THRESHOLD_BELOW_ALLOCATED: 'Cette limite de paiement à la livraison est inférieure au montant déjà alloué.',
        AGENT_CAPACITY_OUT_OF_BOUNDS: 'Cette capacité est hors des bornes autorisées.',
        AGENT_CAPACITY_BELOW_IN_USE: 'Cette capacité est inférieure à ce qui est déjà utilisé.',
        AGENT_KYC_NOT_VERIFIED: "L'identité de ce livreur n'a pas encore été vérifiée.",
        AGENT_TRUST_OVERRIDE_OUT_OF_BOUNDS:
            'Un score de confiance doit être compris entre 0 et 100.',
        AGENT_PLATFORM_BANNED: 'Ce livreur est banni de la plateforme.',
        AGENT_PAYOUT_DETAILS_MISSING: "Ce livreur n'a aucune coordonnée de versement enregistrée.",
        AGENT_SERVICE_TOKEN_INVALID: 'Une connexion entre services a échoué. Réessayez.',
        AGENT_SERVICE_TOKEN_NOT_CONFIGURED: "Une connexion entre services n'est pas configurée. Contactez le support.",

        // ── Contrats de livraison ─────────────────────────────────────────────
        CONTRACT_NOT_FOUND: 'Ce contrat est introuvable.',
        CONTRACT_INVALID_TRANSITION: 'Ce contrat ne peut pas passer à cet état depuis son état actuel.',
        CONTRACT_HAS_OUTSTANDING_COD: 'Des espèces restent dues au titre de ce contrat.',
        CONTRACT_HAS_UNPAID_EARNINGS: 'Des gains restent impayés au titre de ce contrat.',
        CONTRACT_TRANSITION_NOT_PERMITTED: 'Vous ne pouvez pas apporter cette modification à ce contrat.',
        CONTRACT_STATUS_REQUEST_NOT_FOUND: 'Cette demande est introuvable.',
        CONTRACT_STATUS_REQUEST_NOT_PENDING: 'Cette demande a déjà reçu une réponse.',
        CONTRACT_STATUS_REQUEST_ALREADY_PENDING: 'Une demande est déjà en attente de réponse.',
        CONTRACT_STATUS_REQUEST_NOT_YOURS: "Cette demande appartient à quelqu'un d'autre.",
        CONTRACT_COVERAGE_OUTSIDE_AGENT_RADIUS: 'Cette zone est en dehors du rayon de livraison du livreur.',
        CONTRACT_COVERAGE_REGION_NOT_COVERED: "Cette région n'est pas couverte par ce contrat.",
        CONTRACT_SHIPMENT_VALUE_EXCEEDED: 'Cette expédition dépasse la valeur maximale prévue au contrat.',
        CONTRACT_FEE_SPLIT_INVALID: "Cette répartition des frais n'est pas valide.",
        CONTRACT_TERMS_REQUIRED: 'Les conditions du contrat sont obligatoires.',
        CONTRACT_TERMS_NOT_PROPOSED: "Aucune condition n'a encore été proposée.",
        CONTRACT_TERMS_NOT_NEGOTIABLE: 'Les conditions de ce contrat ne sont pas négociables.',
        CONTRACT_TERMS_LIVE_EDIT_NOT_ALLOWED: 'Les conditions d’un contrat actif ne peuvent pas être modifiées directement.',
        CONTRACT_TERMS_PROPOSAL_NOT_FOUND: 'Cette proposition est introuvable.',
        CONTRACT_TERMS_PROPOSAL_NOT_PENDING: 'Cette proposition a déjà reçu une réponse.',
        CONTRACT_TERMS_PROPOSAL_ALREADY_PENDING: 'Une proposition est déjà en attente de réponse.',
        CONTRACT_TERMS_PROPOSAL_NOT_YOURS: "Cette proposition appartient à quelqu'un d'autre.",
        CONTRACT_SETTLEMENT_EXCEEDS_OUTSTANDING: 'Cela dépasse le montant encore dû.',
        CONTRACT_COD_THRESHOLD_OUT_OF_BOUNDS: 'Cette limite de paiement à la livraison est hors des bornes autorisées.',
        CONTRACT_COD_THRESHOLD_EXCEEDS_HEADROOM: 'Cette limite dépasse le plafond restant du livreur.',
        CONTRACT_COD_THRESHOLD_BELOW_OUTSTANDING: 'Cette limite est inférieure aux espèces déjà dues.',

        // ── Connexions vendeur ↔ agence ───────────────────────────────────────
        CONNECTION_NOT_FOUND: 'Cette connexion est introuvable.',
        CONNECTION_VENDOR_NOT_FOUND: 'Ce vendeur est introuvable.',
        CONNECTION_ALREADY_EXISTS: 'Vous êtes déjà connecté à cette agence.',
        CONNECTION_INVALID_STATUS_TRANSITION: 'Cette connexion ne peut pas passer à cet état depuis son état actuel.',
        CONNECTION_NOT_PENDING: 'Cette demande a déjà reçu une réponse.',
        CONNECTION_NOT_PAUSED: "Cette connexion n'est pas en pause.",
        CONNECTION_NOT_REQUESTER: 'Seule la partie qui a envoyé la demande peut faire cela.',
        CONNECTION_NOT_APPROVER: 'Seule la partie qui a reçu la demande peut faire cela.',
        CONNECTION_WRONG_REAPPROVAL_PARTY: "L'autre partie doit d'abord approuver.",
        CONNECTION_NOT_ACTIVE: "Cette connexion n'est pas active.",

        // ── Clients ───────────────────────────────────────────────────────────
        CUSTOMER_NOT_FOUND: 'Ce client est introuvable.',
        CUSTOMER_ADDRESS_NOT_FOUND: 'Cette adresse est introuvable.',
        CUSTOMER_PAYMENT_METHOD_NOT_FOUND: 'Ce moyen de paiement est introuvable.',
        USER_NOT_FOUND: 'Cet utilisateur est introuvable.',
        USER_INVALID_PASSWORD: 'Ce mot de passe est incorrect.',
        USER_CHANNEL_UNAVAILABLE: 'Ce compte n’a aucune adresse sur le canal choisi.',
        USER_CREDENTIAL_LINK_THROTTLED: 'Trop de demandes. Patientez un moment et réessayez.',
        USER_LOGIN_LINK_ROLE_UNSUPPORTED:
            'Les liens de connexion ne sont disponibles que pour les comptes clients.',

        // ── Boutique ──────────────────────────────────────────────────────────
        STORE_NOT_FOUND: 'Votre boutique est introuvable.',
        STORE_SLUG_TAKEN: 'Cette adresse de boutique est déjà prise. Essayez-en une autre.',
        MAGAZIN_NOT_FOUND: 'Ce magasin est introuvable.',
        MAGAZIN_CONFLICT: 'Ce magasin entre en conflit avec un magasin existant.',

        // ── Panier ────────────────────────────────────────────────────────────
        CART_VARIANT_REQUIRED: "Choisissez d'abord une variante.",
        CART_PRODUCT_NOT_FOUND: 'Ce produit est introuvable.',
        CART_SERVICE_PRODUCT_NOT_ALLOWED: 'Les services se réservent, ils ne s’ajoutent pas au panier.',
        CART_VARIANT_NOT_FOUND: 'Cette variante est introuvable.',
        CART_VARIANT_PRODUCT_MISMATCH: 'Cette variante appartient à un autre produit.',
        CART_DIGITAL_QUANTITY_MUST_BE_ONE: 'Les produits numériques ne peuvent être achetés qu’à l’unité.',
        CART_MIXED_PRODUCT_TYPES: 'Les produits physiques et numériques doivent être achetés séparément.',
        CART_DIGITAL_LIMIT_REACHED: 'Vous avez atteint le maximum de produits numériques par commande.',
        CART_NOT_FOUND: 'Ce panier est introuvable.',
        CART_EMPTY_CHECKOUT: 'Ce panier est vide.',
        CART_ITEM_NOT_FOUND:
            'Cet article ne figure plus dans le panier. Actualisez et réessayez.',
        WISHLIST_ITEM_NOT_FOUND: 'Cet article ne figure pas dans la liste d’envies.',

        // ── Réservations ──────────────────────────────────────────────────────
        BOOKING_PRODUCT_NOT_FOUND: 'Ce service est introuvable.',
        BOOKING_USER_NOT_FOUND: 'Ce client est introuvable.',
        BOOKING_NOT_FOUND: 'Cette réservation est introuvable.',
        BOOKING_UNAUTHORIZED: "Vous n'avez pas accès à cette réservation.",
        BOOKING_ALREADY_CANCELLED: 'Cette réservation est déjà annulée.',
        BOOKING_INVALID_STATUS_TRANSITION: 'Cette réservation ne peut pas passer à ce statut depuis son état actuel.',
        BOOKING_PAYMENT_NOT_REQUIRED: 'Cette réservation ne nécessite aucun paiement.',
        BOOKING_ALREADY_PAID: 'Cette réservation a déjà été payée.',
        BOOKING_INVALID_PAYMENT_METHOD: 'Ce moyen de paiement ne peut pas être utilisé pour cette réservation.',
        BOOKING_TERMINAL_STATE: 'Cette réservation est terminée et ne peut plus être modifiée.',
        BOOKING_SLOT_NOT_LOCKED: "Ce créneau n'est plus réservé. Sélectionnez-en un à nouveau.",
        BOOKING_SLOT_LOCKED: 'Quelqu’un réserve ce créneau en ce moment. Essayez-en un autre.',
        BOOKING_FORBIDDEN: "Vous n'avez pas l'autorisation de faire cela.",
        BOOKING_INVALID_SLOT_ID: "Ce créneau n'est pas valide.",
        BOOKING_NOT_RESCHEDULABLE: 'Cette réservation ne peut plus être reportée.',
        BOOKING_SLOT_FULL: 'Ce créneau est complet. Choisissez-en un autre.',
        BOOKING_NOT_CANCELLABLE: "Cette réservation ne peut plus être annulée.",
        BOOKING_SLOT_UNAVAILABLE: 'Ce créneau a été pris pendant la réservation. Choisissez-en un autre.',
        BOOKING_NOT_COMPLETED: 'Terminez cette réservation avant de régler son solde.',
        BOOKING_NO_BALANCE_DUE: "Aucun solde n'est dû sur cette réservation.",
        BOOKING_BALANCE_ALREADY_SETTLED: 'Ce solde a déjà été réglé.',
        BOOKING_BALANCE_PAYMENT_IN_PROGRESS:
            'Le client est en train de payer ce solde. Attendez la fin du paiement avant de l’enregistrer vous-même.',

        // ── Règles de disponibilité ───────────────────────────────────────────
        AVAILABILITY_PRODUCT_NOT_FOUND: 'Ce service est introuvable.',
        AVAILABILITY_RULE_NOT_FOUND: 'Cette règle de disponibilité est introuvable.',
        AVAILABILITY_INVALID_PRODUCT_TYPE: 'Seuls les services ont des horaires de disponibilité.',
        AVAILABILITY_INVALID_TIME_RANGE: "L'heure de fin doit suivre l'heure de début.",
        AVAILABILITY_TIME_OVERLAP: 'Cela chevauche une autre règle de disponibilité.',
        AVAILABILITY_FORBIDDEN: "Vous n'avez pas l'autorisation de modifier cette disponibilité.",
        AVAILABILITY_INVALID_TIMEZONE: 'Choisissez un fuseau horaire dans la liste.',

        // ── Administration ────────────────────────────────────────────────────
        ADMIN_NOT_FOUND: 'Cet administrateur est introuvable.',
        ADMIN_FORBIDDEN: "Vous n'avez pas l'autorisation de faire cela.",

        // ── Facturation : forfaits & crédits ──────────────────────────────────
        BILLING_PLAN_NOT_FOUND: 'Ce forfait est introuvable.',
        BILLING_PLAN_INACTIVE: "Ce forfait n'est plus disponible.",
        BILLING_PLAN_ROLE_MISMATCH: "Ce forfait n'est pas disponible pour un compte vendeur.",
        BILLING_PLAN_CODE_EXISTS: 'Ce code de forfait est déjà utilisé.',
        BILLING_PENDING_PLAN_EXISTS: 'Un changement de forfait est déjà en attente de traitement.',
        BILLING_INSUFFICIENT_CREDITS: 'Vous n’avez pas assez de crédits. Rechargez puis réessayez.',
        BILLING_LIMIT_EXCEEDED: 'Vous avez atteint la limite de votre forfait. Passez à un forfait supérieur pour continuer.',
        BILLING_WALLET_CONFLICT: 'Votre portefeuille a changé pendant le traitement. Réessayez.',
        BILLING_TOPUP_NOT_FOUND: 'Cette recharge est introuvable.',
        BILLING_TOPUP_PACK_NOT_FOUND: 'Ce pack de crédits est introuvable.',
        BILLING_TOPUP_INVALID_STATE: 'Le statut de cette recharge ne permet pas cette action.',
        BILLING_PLAN_PURCHASE_NOT_FOUND: 'Cet achat est introuvable.',
        BILLING_PLAN_NOT_PURCHASABLE: 'Ce forfait ne peut pas être acheté actuellement.',
        BILLING_PURCHASE_INVALID_STATE: 'Le statut de cet achat ne permet pas cette action.',

        // ── Gains & versements ────────────────────────────────────────────────
        EARNINGS_INVALID_SPLIT: "Cette répartition des gains n'est pas valide.",
        EARNINGS_ALLOCATION_NOT_FOUND: 'Cet enregistrement de gains est introuvable.',
        EARNINGS_ALREADY_COMPLETED: 'Ces gains ont déjà été réglés.',
        EARNINGS_ORDER_NOT_CONFIRMABLE: 'Cette commande ne peut pas encore être confirmée.',
        EARNINGS_FORBIDDEN: "Vous n'avez pas l'autorisation de faire cela.",
        EARNINGS_PAYOUT_ALREADY_PENDING: 'Un retrait est déjà en cours de traitement.',
        EARNINGS_PAYOUT_METHOD_MISSING: 'Renseignez vos coordonnées de versement avant de demander un retrait.',
        EARNINGS_PAYOUT_NO_AVAILABLE_BALANCE: "Vous n'avez aucun solde disponible à retirer.",
        EARNINGS_PAYOUT_BELOW_MINIMUM: 'Votre solde disponible est inférieur au minimum requis pour un retrait.',
        EARNINGS_PAYOUT_REQUEST_NOT_FOUND: 'Cette demande de retrait est introuvable.',
        EARNINGS_PAYOUT_REQUEST_NOT_PENDING: 'Ce retrait a déjà été traité.',

        // ── Paiement à la livraison ───────────────────────────────────────────
        COD_NOT_AVAILABLE_FOR_DIGITAL: "Le paiement à la livraison n'est pas disponible pour les produits numériques.",
        COD_AGENCY_NOT_SUPPORTED: 'Cette agence de livraison ne gère pas le paiement à la livraison.',
        COD_ORDER_AMOUNT_EXCEEDS_LIMIT: 'Cette commande dépasse la limite du paiement à la livraison.',
        COD_COLLECTION_NOT_FOUND: 'Cet encaissement est introuvable.',
        COD_COLLECTION_ALREADY_COLLECTED: 'Ces espèces ont déjà été encaissées.',
        COD_COLLECTION_NOT_COLLECTIBLE: 'Ces espèces ne peuvent pas encore être encaissées.',
        COD_INVALID_CODE: 'Ce code de confirmation est incorrect.',
        COD_CODE_ATTEMPTS_EXCEEDED: 'Trop de codes erronés. Demandez-en un nouveau.',
        COD_CODE_RESEND_TOO_SOON: 'Patientez un instant avant de demander un nouveau code.',
        COD_AGENT_NOT_ASSIGNED: "Aucun livreur n'est chargé de cet encaissement.",
        COD_AGENT_EXPOSURE_EXCEEDED: 'Ce livreur détient déjà le montant maximum d’espèces.',
        COD_AGENT_TRUST_TOO_LOW: "Ce livreur n'est pas habilité à transporter ce montant.",
        COD_AGENT_HAS_OUTSTANDING_CASH: 'Ce livreur a encore des espèces à remettre.',
        COD_DEPOSIT_INVALID_AMOUNT: 'Saisissez un montant de dépôt valide.',
        COD_DEPOSIT_EXCEEDS_BALANCE: 'Cela dépasse les espèces en main.',
        COD_DEPOSIT_NOT_FOUND: 'Ce dépôt est introuvable.',
        COD_DEPOSIT_ALREADY_RESOLVED: 'Ce dépôt a déjà été réglé.',
        COD_DEPOSIT_REFERENCE_REQUIRED: 'Une référence de dépôt est obligatoire.',
        COD_DEPOSIT_AGENCY_ALREADY_SETTLED: "L'agence a déjà remis ces espèces.",
        COD_DEPOSIT_WRONG_RECIPIENT: 'Ce dépôt a été envoyé au mauvais destinataire.',
        COD_REMITTANCE_INVALID_AMOUNT: 'Saisissez un montant de remise valide.',
        COD_REMITTANCE_EXCEEDS_LIABILITY: 'Cela dépasse le montant dû.',
        COD_REMITTANCE_NOT_FOUND: 'Cette remise est introuvable.',
        COD_REMITTANCE_ALREADY_RESOLVED: 'Cette remise a déjà été réglée.',
        COD_DISCREPANCY_NOT_FOUND: 'Cet écart est introuvable.',
        COD_DISCREPANCY_ALREADY_RESOLVED: 'Cet écart a déjà été résolu.',

        // ── Comptes & boutiques (relayé depuis la console admin) ──────────────
        USER_STATUS_CONFLICT: 'Ce compte a changé pendant que vous le consultiez. Actualisez puis réessayez.',
        USER_CONTACT_REQUIRED: 'Un compte doit conserver au moins une adresse e-mail ou un numéro de téléphone.',
        VENDOR_NOT_FOUND: 'Cette boutique est introuvable.',
        VENDOR_STATUS_CONFLICT: 'Cette boutique a changé pendant que vous la consultiez. Actualisez puis réessayez.',
        VENDOR_KYC_STATUS_CONFLICT: 'Cette vérification a déjà été tranchée.',

        // ── Vérification d'identité (`/api/vendor/kyc`) ───────────────────────
        // ⚠ Aucun de ces codes ne signifie « vos documents ont été refusés » :
        // un refus est un verdict rédigé par une personne et arrive sur le
        // dossier sous `rejectionReason`, jamais sous forme de code d'erreur.
        KYC_SLOT_UNKNOWN: "Ce n'est pas un document que nous collectons. Actualisez la page et réessayez.",
        KYC_FILE_REQUIRED: 'Aucun fichier joint. Choisissez un fichier et réessayez.',
        KYC_SUBJECT_NOT_FOUND: 'Nous ne trouvons pas votre dossier de vérification. Actualisez la page et réessayez.',
        KYC_DOCUMENT_NOT_FOUND: "Ce document n'est plus là. Actualisez la page pour voir ce que vous avez.",
        KYC_LOCKED:
            'Vos documents ne peuvent pas être modifiés pour le moment : ils sont en cours d’examen ou déjà vérifiés. Contactez le support si quelque chose doit changer.',
        KYC_SLOT_FULL: 'Vous avez ajouté le maximum de fichiers autorisé dans cette section. Supprimez-en un d’abord.',

        // ── Agences & contrats ────────────────────────────────────────────────
        DELIVERY_AGENCY_STATUS_CONFLICT:
            'Cette agence a changé pendant que vous la consultiez. Actualisez puis réessayez.',
        CONTRACT_COVERAGE_REGION_INVALID: "Ce n'est pas une région de ce pays.",
        MAGAZIN_LOCATION_IN_USE:
            "Cet entrepôt contient encore des produits : il ne peut pas être supprimé. Sortez d'abord le stock.",

        // ── Notifications client (relayé) ─────────────────────────────────────
        CUSTOMER_NOTIFICATION_NOT_FOUND: 'Cette notification est introuvable.',
        CUSTOMER_NOTIFICATION_CHANNEL_NOT_VERIFIED: "Ce canal de contact n'a pas encore été vérifié.",
        CUSTOMER_NOTIFICATION_DELIVERY_FAILED: "Nous n'avons pas pu délivrer cette notification.",

        // ── Blog / éditorial ──────────────────────────────────────────────────
        BLOG_ARTICLE_NOT_FOUND: 'Cet article est introuvable.',
        BLOG_ARTICLE_MOVED: 'Cet article a été déplacé.',
        BLOG_ARTICLE_GONE: "Cet article n'est plus publié.",
        BLOG_SLUG_RESERVED: 'Cette adresse web est réservée. Choisissez-en une autre.',
        BLOG_SLUG_TAKEN: 'Un autre article utilise déjà cette adresse web.',
        BLOG_ARTICLE_KEY_TAKEN: 'Un autre article utilise déjà cet identifiant.',
        BLOG_ARTICLE_ALREADY_PUBLISHED: 'Cet article est déjà publié.',
        BLOG_ARTICLE_DELETE_NOT_ALLOWED:
            'Cet article a été en ligne : il ne peut pas être supprimé. Archivez-le plutôt.',
        BLOG_ARTICLE_NOT_PUBLISHABLE: "Cet article n'est pas encore prêt à être publié.",
        BLOG_AUTHOR_NOT_FOUND: 'Cet auteur est introuvable.',
        BLOG_AUTHOR_KEY_TAKEN: 'Un autre auteur utilise déjà cet identifiant.',
        BLOG_AUTHOR_IN_USE:
            "Cet auteur est crédité sur des articles publiés. Réattribuez-les avant de supprimer la signature.",

        // ── Exploitation de la plateforme ─────────────────────────────────────
        SYSTEM_MAINTENANCE_ACTIVE: 'La plateforme est en maintenance. Réessayez sous peu.',
        SYSTEM_LOGS_UNAVAILABLE: 'Cette information est indisponible pour le moment.',
        SYSTEM_DB_INSPECT_UNAVAILABLE: 'Cette information est indisponible pour le moment.',
        SYSTEM_CONFIG_EXPOSURE_UNSAFE: 'Cette information ne peut pas être affichée.',
        SYSTEM_REDIS_COMMAND_REFUSED: 'Cette opération a été refusée.',
        SYSTEM_MAINTENANCE_REASON_REQUIRED: 'Un motif est requis.',
        INTEGRATION_PROBE_FAILED: "Ce service n'a pas pu être joint.",
        CONFIG_INVALID_ENV: 'Le service est mal configuré. Contactez le support.',
        CONFIG_MISSING_JWT_SECRET: 'Le service est mal configuré. Contactez le support.',
        CONFIG_CACHE_POLICY_MISSING: 'Le service est mal configuré. Contactez le support.',
        CONFIG_METRICS_CARDINALITY_UNBOUNDED: 'Le service est mal configuré. Contactez le support.',
        DEV_TOOLS_WORKER_UNKNOWN: 'Cette opération a été refusée.',
        DEV_TOOLS_WORKER_BUSY: 'Cette tâche est déjà en cours. Attendez qu’elle se termine.',
        DEV_TOOLS_CACHE_UNAVAILABLE: 'Cette opération a été refusée.',
        DEV_TOOLS_CACHE_DB_UNKNOWN: 'Cette opération a été refusée.',
        DEV_TOOLS_CACHE_FLUSH_REFUSED: 'Cette opération a été refusée.',
        DEV_TOOLS_OUTBOX_PRUNE_REFUSED: 'Cette opération a été refusée.',

        // ── Repli global ──────────────────────────────────────────────────────
        INTERNAL_SERVER_ERROR: 'Une erreur serveur est survenue. Réessayez dans un instant.',
        REQUEST_BODY_INVALID: "Cette requête n'a pas pu être lue. Veuillez réessayer.",
        REQUEST_BODY_TOO_LARGE: 'Cette requête est trop volumineuse. Envoyez moins de données à la fois.',
        REQUEST_MEDIA_TYPE_UNSUPPORTED: "Cette requête n'a pas pu être lue. Veuillez réessayer.",
        RATE_LIMIT_EXCEEDED: 'Trop de requêtes. Patientez un instant puis réessayez.',
        NOT_FOUND: "Nous n'avons pas trouvé ce que vous cherchiez.",
        VALIDATION_ERROR: 'Certaines informations ne sont pas valides. Vérifiez les champs signalés.',

        // ── Codes émis par le tableau de bord ─────────────────────────────────
        AUTH_SESSION_CAP_REACHED:
            'Cela fait un moment — veuillez vous reconnecter.',
        AUTH_ACCOUNT_CLOSED: 'Ce compte a été fermé.',
        AUTH_RESET_TOKEN_INVALID:
            'Ce lien de réinitialisation n’est plus valide. Demandez-en un nouveau.',

        CONNECTION_CODE_INVALID:
            'Ce code n’est pas valide. Renvoyez la commande au bot pour en obtenir un nouveau.',
        CONNECTION_CODE_EXPIRED:
            'Ce code a expiré. Renvoyez la commande au bot pour en obtenir un nouveau.',
        CONNECTION_CODE_ATTEMPTS_EXCEEDED:
            'Trop de tentatives. Réessayez dans quelques minutes.',
        CONNECTION_CODE_GENERATION_FAILED:
            'Nous n’avons pas pu créer de code pour l’instant. Réessayez dans un moment.',
        MESSAGING_IDENTITY_ALREADY_LINKED:
            'Ce compte est déjà lié à un autre compte Wi-Mall. Obtenez un nouveau code et utilisez-en un autre.',
        MESSAGING_CONNECTION_NOT_FOUND: 'Ce canal n’est pas connecté.',
        MESSAGING_IDENTITY_UNRESOLVED:
            'Nous n’avons pas pu identifier ce compte de messagerie. Réessayez la connexion.',
        MESSAGING_DELIVERY_FAILED:
            'Nous n’avons pas pu délivrer ce message. Réessayez dans un moment.',

        // ── Connexion par lien magique ────────────────────────────────────────
        // 🔴 Un seul message couvre « inconnu », « déjà utilisé » et « mauvaise
        // personne » : le backend les confond volontairement pour que le point
        // de terminaison ne devienne pas un oracle d’inscription. Ne pas préciser.
        MAGIC_LINK_INVALID: 'Ce lien de connexion n’est pas valide. Demandez-en un nouveau.',
        MAGIC_LINK_EXPIRED: 'Ce lien de connexion a expiré. Demandez-en un nouveau.',
        MAGIC_CODE_INVALID: 'Ce code de connexion n’est pas valide. Demandez-en un nouveau.',
        MAGIC_CODE_EXPIRED: 'Ce code de connexion a expiré. Demandez-en un nouveau.',
        MAGIC_ATTEMPTS_EXCEEDED: 'Trop de tentatives. Demandez un nouveau code de connexion.',
        MAGIC_CONTACT_UNVERIFIED:
            'Ce contact n’a pas encore été vérifié : il ne peut pas servir à se connecter.',
        MAGIC_SESSION_GENERATION_FAILED:
            "Nous n'avons pas pu finaliser cette connexion. Réessayez.",

        PRODUCT_SHARE_CHANNEL_NOT_CONNECTED:
            'Ce canal n’est pas encore lié à votre compte. Connectez-le, puis réessayez.',
        PRODUCT_SHARE_WINDOW_CLOSED:
            'WhatsApp ne nous autorise pas à vous écrire pour le moment. Envoyez n’importe quel message à notre bot, puis réessayez.',
        PRODUCT_SHARE_SEND_FAILED:
            'Nous n’avons pas pu l’envoyer pour l’instant. Réessayez dans un moment.',

        CONTACT_CHANGE_SAME_IDENTIFIER: 'C’est déjà votre valeur actuelle.',
        CONTACT_CHANGE_IDENTIFIER_TAKEN: 'Un autre compte utilise déjà cette valeur.',
        CONTACT_CHANGE_NOT_PENDING: 'Aucune modification n’est en attente de confirmation.',
        CONTACT_CHANGE_EXPIRED: 'Cette demande a expiré. Veuillez recommencer.',
        CONTACT_CHANGE_TOKEN_INVALID:
            'Ce lien de confirmation n’est plus valide. Veuillez recommencer.',
        CONTACT_CHANGE_PHONE_UNPROVEN:
            'Connectez d’abord WhatsApp avec le nouveau numéro, ou vérifiez-le plutôt avec un code.',

        PHONE_VERIFICATION_NO_TARGET:
            'Aucun numéro de téléphone n’est encore associé à votre compte. Ajoutez-en un, puis vérifiez-le.',
        PHONE_VERIFICATION_CODE_INVALID:
            'Ce code n’est pas correct. Vérifiez-le et réessayez.',
        PHONE_VERIFICATION_CODE_EXPIRED:
            'Ce code a expiré. Demandez-en un nouveau et saisissez-le dans les 10 minutes.',
        PHONE_VERIFICATION_TOO_MANY_ATTEMPTS:
            'Trop de codes incorrects : celui-ci ne fonctionne plus. Demandez un nouveau code.',
        PHONE_VERIFICATION_RESEND_TOO_SOON:
            'Un code vient d’être envoyé. Patientez un instant avant d’en demander un autre.',
        PHONE_VERIFICATION_DELIVERY_FAILED:
            'Nous n’avons pas pu envoyer le code sur WhatsApp. Envoyez un message à notre bot depuis ' +
            'ce numéro, puis redemandez le code.',

        ACCOUNT_CLOSURE_ROLE_NOT_ELIGIBLE:
            'Votre compte vendeur doit être fermé par le support avant de pouvoir fermer ce compte.',
        ACCOUNT_CLOSURE_ORDERS_IN_FLIGHT:
            'Des commandes sont encore en cours. Elles doivent d’abord se terminer.',

        REVIEW_NOT_FOUND: 'Cet avis n’existe plus.',
        REVIEW_ALREADY_EXISTS: 'Vous avez déjà évalué cette livraison.',
        REVIEW_NOT_ELIGIBLE: 'Cette livraison ne peut pas encore être évaluée.',
        REVIEW_SUBJECT_NOT_FOUND: 'Nous n’avons pas trouvé cette livraison.',
        REVIEW_SUBJECT_NOT_REVIEWABLE:
            'Aucun agent n’est affecté à cette livraison : il n’y a personne à évaluer.',
        REVIEW_NOT_PENDING: 'Cet avis a déjà été modéré.',
        REVIEW_ROLE_NOT_ALLOWED: 'Ce n’est pas quelque chose que vous pouvez évaluer.',

        STORAGE_INVOICE_NOT_FOUND: 'Nous n’avons pas trouvé ce relevé de stockage.',
        STORAGE_INVOICE_NOT_OPEN: 'Ce relevé de stockage n’est plus ouvert.',

        INVENTORY_INSUFFICIENT_STOCK: 'Le stock est insuffisant pour cette opération.',
        INVENTORY_TRANSFER_SAME_LOCATION:
            'Choisissez une autre destination — le stock s’y trouve déjà.',
        INVENTORY_DEPOT_CHANGE_HOLDS_STOCK:
            'Ce dépôt contient encore du stock. Sortez-le avant de changer de dépôt.',

        UPLOAD_VIRUS_SCAN_UNAVAILABLE:
            'Nous n’avons pas pu analyser ce fichier pour l’instant. Réessayez dans un moment.',

        GEO_PROVIDER_RATE_LIMITED:
            'La recherche d’adresse est saturée pour le moment. Réessayez dans un instant.',

        REFRESH_FAILED: 'Votre session a expiré. Veuillez vous reconnecter.',
        INIT_FAILED: "Nous n'avons pas pu charger votre session. Actualisez la page.",
        SUBMIT_FAILED: "Nous n'avons pas pu enregistrer cette étape. Réessayez.",
        UPDATE_FAILED: "Nous n'avons pas pu enregistrer vos modifications. Réessayez.",
    },
};

export default errors;
