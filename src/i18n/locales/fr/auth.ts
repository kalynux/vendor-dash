/**
 * Les écrans d'authentification intégrés.
 *
 * Ils existent pour les applications natives. Sur le web, le tableau de bord a
 * toujours renvoyé les vendeurs vers le site principal pour la connexion et
 * hérité du cookie de session — une application empaquetée n'a nulle part où
 * revenir, elle se connecte donc elle-même. Voir `src/pages/auth/`.
 */
export const auth = {
    brand: {
        name: 'Wi-Vendor',
        tagline: 'Votre boutique Wi-Mall, dans votre poche.',
    },

    login: {
        title: 'Bon retour',
        subtitle: 'Connectez-vous pour gérer votre boutique, vos commandes et vos paiements.',
        /** The two ways in — labels for the tab strip above the identifier. */
        tabs: {
            phone: 'Téléphone',
            email: 'E-mail',
        },
        phoneLabel: 'Numéro de téléphone',
        phoneHint: 'Le numéro utilisé lors de votre inscription.',
        emailLabel: 'Adresse e-mail',
        emailPlaceholder: 'vous@exemple.com',
        emailHint: 'L’e-mail utilisé lors de votre inscription.',
        passwordLabel: 'Mot de passe',
        passwordPlaceholder: 'Votre mot de passe',
        submit: 'Se connecter',
        submitting: 'Connexion…',
        forgot: 'Mot de passe oublié ?',
        noAccount: 'Nouveau sur Wi-Mall ?',
        createAccount: 'Créer un compte vendeur',
        showPassword: 'Afficher le mot de passe',
        hidePassword: 'Masquer le mot de passe',
    },

    register: {
        title: 'Créez votre compte vendeur',
        subtitle: 'Quelques informations, puis nous configurons votre boutique.',
        nameLabel: 'Votre nom',
        namePlaceholder: 'Amina Nkeng',
        businessLabel: 'Nom de l’entreprise',
        businessPlaceholder: 'Amina Fabrics',
        businessHint:
            'C’est ce que voient vos clients sur votre boutique. Vous pourrez le modifier plus tard.',
        phoneLabel: 'Numéro de téléphone',
        emailLabel: 'E-mail',
        emailPlaceholder: 'vous@exemple.com',
        emailHint:
            'Facultatif, mais c’est ainsi que vous récupérez un mot de passe oublié.',
        passwordLabel: 'Mot de passe',
        passwordHint: 'Au moins 8 caractères.',
        confirmLabel: 'Confirmez le mot de passe',
        submit: 'Créer le compte',
        submitting: 'Création de votre compte…',
        haveAccount: 'Vous avez déjà un compte ?',
        signIn: 'Se connecter',
        terms:
            'En créant un compte, vous acceptez les conditions vendeur de Wi-Mall.',
    },

    forgot: {
        title: 'Réinitialiser votre mot de passe',
        subtitle:
            'Indiquez le numéro de téléphone ou l’e-mail de votre compte et nous vous enverrons un lien.',
        identifierLabel: 'Téléphone ou e-mail',
        submit: 'Envoyer le lien',
        submitting: 'Envoi…',
        sentTitle: 'Consultez vos messages',
        sentBody:
            'Si un compte existe pour {{identifier}}, un lien de réinitialisation est en route. Le lien expire dans une heure.',
        backToLogin: 'Retour à la connexion',
        resend: 'Renvoyer',
    },

    reset: {
        title: 'Choisissez un nouveau mot de passe',
        subtitle: 'Choisissez-en un que vous n’avez pas déjà utilisé ici.',
        passwordLabel: 'Nouveau mot de passe',
        confirmLabel: 'Confirmez le nouveau mot de passe',
        submit: 'Enregistrer le mot de passe',
        submitting: 'Enregistrement…',
        done: 'Mot de passe mis à jour. Connectez-vous avec le nouveau.',
        missingToken: 'Ce lien de réinitialisation est incomplet. Demandez-en un nouveau.',
        requestNew: 'Demander un nouveau lien',
    },

    /**
     * Connexion par empreinte / visage. Uniquement en natif.
     *
     * `{{method}}` reprend toujours le nom que l’appareil donne lui-même à ce
     * qu’il va afficher (`method.*`), pour que notre formulation et l’en-tête de
     * la boîte de dialogue système concordent.
     */
    biometric: {
        method: {
            generic: 'la biométrie',
            touchId: 'Touch ID',
            faceId: 'Face ID',
            fingerprint: 'votre empreinte',
            face: 'la reconnaissance faciale',
            iris: 'la reconnaissance de l’iris',
        },

        signInWith: 'Se connecter avec {{method}}',
        asAccount: 'en tant que {{identifier}}',
        orDivider: 'ou',

        promptTitle: 'Wi-Vendor',
        unlockReason: 'Confirmez {{method}} pour vous connecter.',
        enableReason: 'Confirmez {{method}} pour activer la connexion rapide.',

        optInLabel: 'La prochaine fois, se connecter avec {{method}}',
        optInHint:
            'Vos identifiants sont conservés dans le stockage sécurisé de ce téléphone et ne sont transmis à l’application qu’une fois votre identité confirmée par le téléphone.',

        enabled: 'Vous pouvez désormais vous connecter avec {{method}}.',
        enableFailed:
            'Impossible d’activer cette option. Vous pourrez réessayer à la prochaine connexion.',
        noLongerAvailable:
            'Ce téléphone n’a plus d’empreinte ni de visage enregistré : la connexion rapide a été désactivée.',
        rejected:
            'Votre mot de passe a changé depuis la configuration. Connectez-vous une fois avec votre mot de passe, puis réactivez l’option.',
    },

    validation: {
        identifierRequired: 'Saisissez votre numéro de téléphone ou votre e-mail.',
        identifierInvalid: 'Saisissez un numéro de téléphone ou une adresse e-mail valide.',
        emailRequired: 'Saisissez votre adresse e-mail.',
        passwordRequired: 'Saisissez votre mot de passe.',
        passwordTooShort: 'Utilisez au moins 8 caractères.',
        confirmMismatch: 'Les deux mots de passe ne correspondent pas.',
        nameRequired: 'Saisissez votre nom.',
        businessRequired: 'Saisissez le nom de votre entreprise.',
    },

    errors: {
        loginFailed:
            'Connexion impossible. Vérifiez vos informations et réessayez.',
        registerFailed: 'Impossible de créer votre compte. Veuillez réessayer.',
        forgotFailed: 'Impossible d’envoyer le lien. Veuillez réessayer.',
        resetFailed:
            'Impossible de mettre à jour votre mot de passe. Le lien a peut-être expiré.',
    },

    web: {
        title: 'Wi-Vendor',
        description:
            'Veuillez vous connecter via le site principal pour accéder à votre tableau de bord vendeur.',
        goToLogin: 'Aller à la connexion',
    },
} as const;

export default auth;
