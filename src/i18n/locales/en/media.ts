import { plural } from '../../types';

/** Media library and the media picker. */
export const media = {
    title: 'Media Library',
    subtitle: 'Every image and file you have uploaded',

    empty: {
        title: 'Nothing uploaded yet',
        description: 'Upload product photos, banners and documents to reuse them anywhere.',
        filtered: 'No files match your filters.',
    },

    upload: {
        title: 'Upload files',
        dropzone: 'Drag files here, or click to browse',
        limits: 'Up to {{maxFiles}} files (500 MB each) or 3 videos (70 MB each)',
        uploading: 'Uploading {{done}} of {{total}}…',
        completed: plural({ one: '{{count}} file uploaded', other: '{{count}} files uploaded' }),
        failed: plural({ one: '{{count}} file failed', other: '{{count}} files failed' }),

        /**
         * Client-side pre-flight checks in `services/files.service.ts`. Resolved
         * with `tStatic` — the service has no React context to hook into.
         */
        validation: {
            tooManyFiles: 'You can upload at most {{max}} files at once.',
            tooManyVideos: 'You can upload at most {{max}} videos at once.',
            fileTooLarge: '“{{name}}” exceeds the 500 MB limit.',
            videoTooLarge: '“{{name}}” exceeds the 70 MB video limit.',
            videoFormat: '“{{name}}” is not a supported video (use MP4, MOV or WebM).',
        },
    },

    /** Desktop page title/description; the mobile header uses the short form. */
    library: {
        titleShort: 'Media',
        description: "Manage every file you've uploaded and see exactly where each one is attached.",
        upload: 'Upload',
        uploadFiles: 'Upload files',
        uploadingFile: 'Uploading {{name}}…',
        /** Progress label when several files go up at once. */
        fileCount: plural({ one: '{{count}} file', other: '{{count}} files' }),
        uploaded: plural({ one: 'Uploaded {{count}} file.', other: 'Uploaded {{count}} files.' }),
        dropToUpload: 'Drop to upload',
        gridView: 'Grid view',
        listView: 'List view',
        searchPlaceholder: 'Search by name or type…',
        unused: 'Unused',

        /** Compact counters in the overview strip — labels sit under the number. */
        stats: {
            files: 'Files',
            attached: 'Attached',
            unused: 'Unused',
            pageScopeHint: 'Counted across the files loaded on this page.',
        },

        emptyFiltered: 'No files match your filters',
        emptyFilteredHint: 'Try clearing the search or filters to see more files.',
        emptyTitle: 'Your library is empty',
        emptyHint: 'Upload images, videos, audio or documents to start building your library.',
        clearFilters: 'Clear filters',
        openInNewTab: 'Open in new tab',
        selectFileHint: "Select a file to inspect its details and see where it's attached.",
        inspect: 'Inspect',
        onThisPage: plural({ one: '{{count}} on this page', other: '{{count}} on this page' }),
    },

    filters: {
        allTypes: 'All types',
        images: 'Images',
        videos: 'Videos',
        documents: 'Documents',
        unused: 'Unused only',

        title: 'Filter media',
        apply: 'Show files',
        open: 'Filter files',
        fileType: 'File type',
        storageProvider: 'Storage provider',
        allProviders: 'All providers',
        sortBy: 'Sort by',
        chipType: 'Type: {{value}}',
        chipProvider: 'Provider: {{value}}',
        chipSort: 'Sort: {{value}}',

        kind: {
            image: 'Images',
            video: 'Video',
            audio: 'Audio',
            document: 'Documents',
        },

        sort: {
            newest: 'Newest first',
            oldest: 'Oldest first',
            nameAsc: 'Name A–Z',
            nameDesc: 'Name Z–A',
            largest: 'Largest first',
            smallest: 'Smallest first',
        },
    },

    /** Storage meter in the overview strip. */
    storageBar: {
        label: 'Media storage',
        of: 'of {{limit}}',
        percent: '{{percent}}%',
        full: 'Storage is full — delete unused media to upload more.',
        nearlyFull: 'Storage is nearly full. Delete unused media or upgrade your plan.',
    },

    /** What a `usage.references[]` entry points at, by slot then entity type. */
    references: {
        avatar: 'Profile avatar',
        logo: 'Store logo',
        banner: 'Store banner',
        cover: 'Cover image',
        attachment: 'Ticket attachment',
        product: 'Product',
        variant: 'Variant',
        digitalAsset: 'Digital asset',
        ticket: 'Support ticket',
        store: 'Storefront',
        vendor: 'Your profile',
        agency: 'Agency',
        customer: 'Customer',
        agent: 'Agent',
        admin: 'Admin',
        generic: 'In use',
        downloadableFile: 'Downloadable file',
    },

    details: {
        title: 'File details',
        fileName: 'File name',
        fileType: 'Type',
        fileSize: 'Size',
        dimensions: 'Dimensions',
        uploaded: 'Uploaded',
        checksum: 'Checksum',
        usedIn: 'Used in',
        notUsed: 'Not used anywhere yet',
        usageCount: plural({ one: 'Used in {{count}} place', other: 'Used in {{count}} places' }),

        untitled: 'Untitled',
        mime: 'MIME',
        provider: 'Provider',
        references: 'References',
        whereUsed: "Where it's used",
        notAttached: 'Not attached to anything. This file can be safely deleted.',
        deleteFile: 'Delete file',
        deleteBlocked: 'Detach this file from everything using it before deleting.',
        deleteConfirm: 'Delete this file? This cannot be undone.',
    },

    picker: {
        searchPlaceholder: 'Search files…',
        filterTitle: 'Filter files',
        gridView: 'Grid view',
        listView: 'List view',
        fileType: 'File type',
        sizeMb: 'Size (MB)',
        uploadedOn: 'Uploaded',
        sortBy: 'Sort by',
        uploading: 'Uploading…',
        noFiles: 'No files found',
        clearFilters: 'Clear filters',
        dropToUpload: 'Drop to upload',
        selectMedia: 'Select media',
        selected: plural({ one: '{{count}} selected', other: '{{count}} selected' }),
        selectedOfMax: '{{count}} selected / {{max}} max',
        selectCount: 'Select ({{count}})',
        added: 'Added',
        totalFiles: plural({ one: '{{count}} total', other: '{{count}} total' }),
        /** Shown when a file outside the slot's accepted kinds is tapped. */
        kindNotAllowed: '{{kind}} can’t be used here — only {{allowed}} files are allowed.',
        sizeMin: 'Min',
        sizeMax: 'Max',
        sizeAny: 'Any',
        uploadedAfter: 'After',
        uploadedBefore: 'Before',
    },

    toast: {
        uploaded: 'Upload complete',
        deleted: plural({ one: '{{count}} file deleted', other: '{{count}} files deleted' }),
        copied: 'File link copied',
        renamed: 'File renamed.',
        fileDeleted: 'File deleted.',
    },

    errors: {
        loadFailed: "We couldn't load your media. Please try again.",
        loadDetailFailed: "We couldn't load this file's details. Please try again.",
        uploadFailed: 'The upload failed. Please try again.',
        renameFailed: "We couldn't rename that file. Please try again.",
        deleteFailed: "We couldn't delete that file. Please try again.",
        stillReferenced: 'This file is still used somewhere. Detach it before deleting.',
        detachFirst: 'Detach this file from everything using it before deleting it.',
    },
} as const;

export default media;
