import { plural } from '../../types';

/** "Generate" beside a description: the AI writes the description, tags, SEO and category. */
export const aiCopy = {
    button: 'Generate',
    buttonLabel: 'Write the description with AI',
    title: 'Write with AI',
    subtitle: 'Add a photo and a few details. The AI writes the rest.',

    photos: {
        label: 'Photos',
        hintProduct: 'The AI looks at these. They also become your product photos.',
        hintService: 'The AI looks at these. They also become your service photos.',
        using: plural({
            one: 'Using your product photo',
            other: 'Using your {{count}} product photos',
        }),
        add: 'Add photos',
        remove: 'Remove photo',
        required: 'Add at least one photo.',
    },

    name: {
        label: 'Name',
        placeholder: 'e.g. Nike Air Max 90',
        required: 'Enter a name.',
    },

    category: {
        label: 'Category (optional)',
    },

    notes: {
        label: 'Details to mention (optional)',
        placeholder: 'e.g. original, sizes 40 to 45, 1-year warranty, delivery in Douala',
    },

    language: {
        label: 'Language',
    },

    fields: {
        label: 'What to write',
        description: 'Description',
        tags: 'Tags',
        seoTitle: 'SEO title',
        seoDescription: 'SEO description',
        categories: 'Category',
    },

    cost: plural({ one: '{{count}} credit', other: '{{count}} credits' }),
    balance: 'You have {{balance}}',
    notEnough: 'Not enough credits.',
    topUp: 'Top up',
    generate: 'Generate',

    writing: 'Writing…',
    writingHint: 'This takes a few seconds.',

    results: {
        regenerate: 'Regenerate',
        regenerateLabel: 'Regenerate the {{field}} ({{cost}})',
        failed: "Couldn't write this one. You weren't charged.",
        newCategory: 'New',
        mainCategory: 'Main',
        keep: 'Use the {{field}}',
        charged: plural({
            one: '{{count}} credit used · {{balance}} left',
            other: '{{count}} credits used · {{balance}} left',
        }),
        apply: 'Use selected',
        back: 'Edit details',
        nothingSelected: 'Select at least one result to use.',
    },

    errors: {
        failed: "The AI couldn't write this. You weren't charged. Try again.",
        unavailable: 'Writing with AI is not available right now. Try again later.',
        image: "One of the photos can't be read. Remove it or choose another.",
        insufficient: 'Not enough credits. Top up to continue.',
        rateLimited: 'Too many tries. Wait a minute and try again.',
    },

    applied: 'Added to the form. Read it over before you save.',
} as const;

export default aiCopy;
