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
        identifierLabel: 'Téléphone ou e-mail',
        identifierPlaceholder: 'vous@exemple.com',
        identifierHint: 'Utilisez le numéro de téléphone ou l’e-mail de votre inscription.',
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

    validation: {
        identifierRequired: 'Saisissez votre numéro de téléphone ou votre e-mail.',
        identifierInvalid: 'Saisissez un numéro de téléphone ou une adresse e-mail valide.',
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
