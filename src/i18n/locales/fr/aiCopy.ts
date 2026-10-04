import { plural } from '../../types';

/** « Générer » à côté d'une description : l'IA rédige la description, les tags, le SEO et la catégorie. */
export const aiCopy = {
    button: 'Générer',
    buttonLabel: 'Rédiger la description avec l’IA',
    title: 'Rédiger avec l’IA',
    subtitle: 'Ajoutez une photo et quelques détails. L’IA écrit le reste.',

    photos: {
        label: 'Photos',
        hintProduct: 'L’IA s’appuie sur ces photos. Elles deviennent aussi les photos du produit.',
        hintService: 'L’IA s’appuie sur ces photos. Elles deviennent aussi les photos du service.',
        using: plural({
            one: 'Avec la photo du produit',
            other: 'Avec les {{count}} photos du produit',
        }),
        add: 'Ajouter des photos',
        remove: 'Retirer la photo',
        required: 'Ajoutez au moins une photo.',
    },

    name: {
        label: 'Nom',
        placeholder: 'ex. Nike Air Max 90',
        required: 'Saisissez un nom.',
    },

    category: {
        label: 'Catégorie (facultatif)',
    },

    notes: {
        label: 'Détails à mentionner (facultatif)',
        placeholder: 'ex. original, pointures 40 à 45, garantie 1 an, livraison à Douala',
    },

    language: {
        label: 'Langue',
    },

    fields: {
        label: 'À rédiger',
        description: 'Description',
        tags: 'Tags',
        seoTitle: 'Titre SEO',
        seoDescription: 'Description SEO',
        categories: 'Catégorie',
    },

    cost: plural({ one: '{{count}} crédit', other: '{{count}} crédits' }),
    balance: 'Vous avez {{balance}}',
    notEnough: 'Crédits insuffisants.',
    topUp: 'Recharger',
    generate: 'Générer',

    writing: 'Rédaction…',
    writingHint: 'Cela prend quelques secondes.',

    results: {
        regenerate: 'Régénérer',
        regenerateLabel: 'Régénérer : {{field}} ({{cost}})',
        failed: 'Impossible de rédiger cette partie. Rien n’a été débité.',
        newCategory: 'Nouvelle',
        mainCategory: 'Principale',
        keep: 'Utiliser : {{field}}',
        charged: plural({
            one: '{{count}} crédit utilisé · il en reste {{balance}}',
            other: '{{count}} crédits utilisés · il en reste {{balance}}',
        }),
        apply: 'Utiliser la sélection',
        back: 'Modifier les détails',
        nothingSelected: 'Sélectionnez au moins un résultat.',
    },

    errors: {
        failed: 'L’IA n’a pas pu rédiger. Rien n’a été débité. Réessayez.',
        unavailable: 'La rédaction par IA est indisponible pour le moment. Réessayez plus tard.',
        image: 'Une des photos est illisible. Retirez-la ou choisissez-en une autre.',
        insufficient: 'Crédits insuffisants. Rechargez pour continuer.',
        rateLimited: 'Trop d’essais. Patientez une minute puis réessayez.',
    },

    applied: 'Ajouté au formulaire. Relisez avant d’enregistrer.',
} as const;

export default aiCopy;
