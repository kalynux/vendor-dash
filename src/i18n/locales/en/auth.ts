/**
 * The in-app authentication screens.
 *
 * These exist for the native builds. On the web the dashboard has always sent
 * vendors to sign in on the main site and inherited the session cookie — there
 * is nowhere for a packaged app to come back to, so it signs in for itself.
 * See `src/pages/auth/`.
 */
export const auth = {
    /** Shared across the four screens. */
    brand: {
        name: 'Wi-Vendor',
        tagline: 'Your Wi-Mall storefront, in your pocket.',
    },

    login: {
        title: 'Welcome back',
        subtitle: 'Sign in to manage your storefront, orders and payouts.',
        identifierLabel: 'Phone or email',
        identifierPlaceholder: 'you@example.com',
        identifierHint: 'Use the phone number or email you signed up with.',
        passwordLabel: 'Password',
        passwordPlaceholder: 'Your password',
        submit: 'Sign in',
        submitting: 'Signing in…',
        forgot: 'Forgot your password?',
        noAccount: 'New to Wi-Mall?',
        createAccount: 'Create a vendor account',
        showPassword: 'Show password',
        hidePassword: 'Hide password',
    },

    register: {
        title: 'Create your vendor account',
        subtitle: 'A few details now, and we will set up your storefront next.',
        nameLabel: 'Your name',
        namePlaceholder: 'Amina Nkeng',
        businessLabel: 'Business name',
        businessPlaceholder: 'Amina Fabrics',
        businessHint: 'This is what customers see on your storefront. You can change it later.',
        phoneLabel: 'Phone number',
        emailLabel: 'Email',
        emailPlaceholder: 'you@example.com',
        emailHint: 'Optional, but it is how you recover a forgotten password.',
        passwordLabel: 'Password',
        passwordHint: 'At least 8 characters.',
        confirmLabel: 'Confirm password',
        submit: 'Create account',
        submitting: 'Creating your account…',
        haveAccount: 'Already have an account?',
        signIn: 'Sign in',
        terms: 'By creating an account you agree to the Wi-Mall vendor terms.',
    },

    forgot: {
        title: 'Reset your password',
        subtitle: 'Tell us the phone number or email on your account and we will send a reset link.',
        identifierLabel: 'Phone or email',
        submit: 'Send reset link',
        submitting: 'Sending…',
        sentTitle: 'Check your messages',
        sentBody:
            'If an account exists for {{identifier}}, a reset link is on its way. The link expires in one hour.',
        backToLogin: 'Back to sign in',
        resend: 'Send it again',
    },

    reset: {
        title: 'Choose a new password',
        subtitle: 'Pick something you have not used here before.',
        passwordLabel: 'New password',
        confirmLabel: 'Confirm new password',
        submit: 'Save new password',
        submitting: 'Saving…',
        done: 'Password updated. Sign in with your new password.',
        missingToken: 'This reset link is incomplete. Request a new one.',
        requestNew: 'Request a new link',
    },

    /**
     * Client-side validation. Keys, not sentences, in the zod schemas — the
     * resolver looks them up so a message follows the vendor's language.
     */
    validation: {
        identifierRequired: 'Enter your phone number or email.',
        identifierInvalid: 'Enter a valid phone number or email address.',
        passwordRequired: 'Enter your password.',
        passwordTooShort: 'Use at least 8 characters.',
        confirmMismatch: 'The two passwords do not match.',
        nameRequired: 'Enter your name.',
        businessRequired: 'Enter your business name.',
    },

    errors: {
        loginFailed: 'Could not sign you in. Check your details and try again.',
        registerFailed: 'Could not create your account. Please try again.',
        forgotFailed: 'Could not send the reset link. Please try again.',
        resetFailed: 'Could not update your password. The link may have expired.',
    },

    /** The web build's redirect card — sign-in lives on the main site there. */
    web: {
        title: 'Wi-Vendor',
        description: 'Please log in via the main site to access your vendor dashboard.',
        goToLogin: 'Go to login',
    },
} as const;

export default auth;
