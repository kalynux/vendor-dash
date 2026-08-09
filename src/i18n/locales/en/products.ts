import { plural } from '../../types';

/** Product catalog: list, wizard, variants, media, digital delivery. */
export const products = {
    title: 'Products',
    subtitle: 'Manage your product catalog',

    empty: {
        title: 'No products found',
        description: 'Add your first product to start selling.',
        filtered: 'No products match your filters.',
        addFirst: 'Add your first product',
    },

    search: {
        placeholder: 'Search products…',
        filterTitle: 'Filter products',
        applyLabel: 'Show products',
    },

    columns: {
        product: 'Product',
        sku: 'SKU',
        price: 'Price',
        stock: 'Stock',
        status: 'Status',
        type: 'Type',
        updated: 'Updated',
        actions: 'Actions',
        name: 'Name',
        images: 'Images',
    },

    status: {
        draft: 'Draft',
        active: 'Active',
        published: 'Published',
        archived: 'Archived',
        outOfStock: 'Out of stock',
        pendingReview: 'Pending review',
        suspended: 'Suspended',
    },

    type: {
        physical: 'Physical',
        digital: 'Digital',
        service: 'Service',
    },

    actions: {
        addProduct: 'Add product',
        addSimple: 'Simple product',
        addAdvanced: 'Advanced product',
        editProduct: 'Edit product',
        duplicate: 'Duplicate',
        publish: 'Publish',
        unpublish: 'Unpublish',
        archive: 'Archive',
        archiveSelected: 'Archive selected',
        restore: 'Restore',
        importCsv: 'Import CSV',
        exportCsv: 'Export CSV',
        preview: 'Preview',
        convertToAdvanced: 'Convert to advanced',
        convertToAdvancedEditor: 'Convert to advanced editor',
        productActions: 'Product actions',
        clearFilters: 'Clear filters',
        gridView: 'Grid view',
        listView: 'List view',
    },

    bulk: {
        selected: plural({ one: '{{count}} product selected', other: '{{count}} products selected' }),
        archiveTitle: 'Archive the selected products?',
        archiveDescription: 'Archived products are hidden from your storefront. You can restore them later.',
        confirm: plural({
            one: 'Archive {{count}} product?',
            other: 'Archive {{count}} products?',
        }),
        partial:
            'Archived {{success}} of {{total}} — {{failed}} skipped (only draft or active products can be archived).',
        done: plural({ one: '{{count}} product archived.', other: '{{count}} products archived.' }),
    },

    fields: {
        title: 'Title',
        titlePlaceholder: 'e.g. Wireless Bluetooth Headphones',
        description: 'Description',
        descriptionPlaceholder: 'Describe what makes this product worth buying…',
        price: 'Price',
        compareAtPrice: 'Compare-at price',
        cost: 'Cost per item',
        sku: 'SKU',
        barcode: 'Barcode',
        stock: 'Stock',
        lowStockThreshold: 'Low-stock threshold',
        weight: 'Weight',
        category: 'Category',
        tags: 'Tags',
        images: 'Images',
        pickupLocation: 'Pickup location',
        deliveryAgency: 'Delivery agency',
        photos: 'Photos',
        productName: 'Product name',
        namePlaceholder: 'e.g. Nike Air Max 90',
        descriptionHelp: 'Describe your product — materials, features, use cases…',
        descriptionRequired: 'Required — a product with no description cannot be published.',
        categoryPlaceholder: 'e.g. Apparel, Electronics, Footwear',
        compareAtOptional: 'Optional',
        compareAtHigherHint: 'Shown struck through when higher than the price.',
        compareAtTooLowHint: 'Customers only see a discount when this is higher than the price.',
        unlimitedStock: 'Unlimited stock',
        unlimitedStockHint: 'Never runs out.',
        /** Shown instead of the hint when the product is warehoused by an agency. */
        unlimitedStockLockedHint:
            'An agency warehouses this product, and a warehouse holds a countable quantity. Move pickup back to your own address to use unlimited stock.',
        moreOptions: 'More options',
        skuPlaceholderEdit: 'Product SKU',
        skuPlaceholderCreate: 'Leave blank to generate one automatically',
        skuHintEdit: 'Orders and your storefront reference this SKU. Change it only if you are sure.',
        skuHintCreate: 'SKUs are unique across the whole platform.',
        lowStockAlertAt: 'Low-stock alert at',
        noAlert: 'No alert',
        allowOversell: 'Allow overselling',
        allowOversellHint: 'Accept orders past your stock count.',
        addTagPlaceholder: 'Add tag, press Enter or comma',
        dimensionsTitle: 'Weight & dimensions (optional)',
        weightG: 'Weight (g)',
        lengthCm: 'Length (cm)',
        widthCm: 'Width (cm)',
        heightCm: 'Height (cm)',
        seoTitle: 'SEO (optional)',
        seoTitleLabel: 'SEO title',
        seoTitlePlaceholder: 'Leave blank to use the product name',
        seoTitlePlaceholderWizard: 'Leave blank to use product title',
        seoDescriptionLabel: 'SEO description',
        seoDescriptionPlaceholder: 'Brief description for search engines',
        charCount: '({{used}}/{{max}})',
        photosHint: 'Up to {{max}}. The first one is your thumbnail — drag to reorder.',
    },

    variants: {
        title: 'Variants',
        description: 'Options like size or colour create one variant per combination.',
        addOption: 'Add option',
        optionName: 'Option name',
        optionValues: 'Values',
        count: plural({ one: '{{count}} variant', other: '{{count}} variants' }),
        defaultVariant: 'Default variant',
        empty: 'No variants yet. Add an option to generate them.',
    },

    /** The variant matrix editor (advanced products). */
    variantTable: {
        options: 'Options',
        autoSku: 'Auto SKU',
        bulkEdit: 'Bulk Edit',
        setForAll: 'Set for all:',
        empty: 'No variants. Edit options to generate the variant matrix.',
        saved: '{{count}} saved',
        new: '{{count}} new',
        modified: '{{count}} modified',
        allSaved: 'All saved',
        saveChanges: plural({ one: 'Save {{count}} change', other: 'Save {{count}} changes' }),
        more: 'More',
        less: 'Less',
        moreDetails: 'More details',
        hideDetails: 'Hide details',
        unlimited: 'Unlimited (∞)',
        rowStatus: {
            persisted: 'Saved',
            new: 'New',
            modified: 'Modified',
            removed: 'Removed',
        },
        secondary: {
            compareAtPrice: 'Compare at Price',
            infiniteStock: 'Infinite Stock',
            lowStockAlert: 'Low Stock Alert',
            allowOversell: 'Allow Oversell',
            nonePlaceholder: 'None',
        },
    },

    /** The option builder that generates the variant matrix. */
    options: {
        title: 'Options & Variants',
        description:
            'Define product options (e.g. Size, Color) then configure SKU, price and stock per combination.',
        skuPrefix: 'SKU Prefix',
        skuPrefixPlaceholder: 'e.g. TSHIRT',
        skuPrefixHint: 'Auto-generated SKUs will start with this prefix',
        namePlaceholder: 'Option name (e.g. Color, Size)',
        addOption: 'Add Option',
        maxOptions: 'Maximum of {{max}} options per product',
        valuePlaceholder: 'Add value, press Enter',
        noValues: 'No values added yet',
        preview: 'Variant Preview',
        willGenerate: plural({
            one: '{{count}} variant will be generated',
            other: '{{count}} variants will be generated',
        }),
        addValuesToGenerate: 'Add values to generate variants',
        exceedsLimit: 'Exceeds maximum of {{max}} variants',
        applyAndGenerate: 'Apply & Generate Variants',
        renamedUnsaved: 'Renamed (unsaved)',
        savedMarker: 'Saved',
    },

    /** The confirm-before-regenerating dialog. */
    regenerate: {
        titleDestructive: 'Regenerate Variants?',
        title: 'Generate Variants',
        descriptionDestructive:
            'Regenerating the variant matrix will modify existing variants. Review the changes below.',
        description: plural({
            one: '{{count}} variant will be generated from your options.',
            other: '{{count}} variants will be generated from your options.',
        }),
        keep: plural({
            one: 'Keep {{count}} unchanged variant',
            other: 'Keep {{count}} unchanged variants',
        }),
        create: plural({
            one: 'Create {{count}} new variant',
            other: 'Create {{count}} new variants',
        }),
        archive: plural({ one: 'Archive {{count}} variant', other: 'Archive {{count}} variants' }),
        andMore: 'and {{count}} more…',
        savedBadge: 'saved',
        skuHint: '(SKU: {{sku}})',
        archiveNote: 'Archived variants will be removed from the storefront but data is preserved.',
        applying: 'Applying…',
        confirmDestructive: 'Confirm & Regenerate',
        confirm: 'Generate Variants',
    },

    wizard: {
        stepBasics: 'Basics',
        stepMedia: 'Media',
        stepVariants: 'Variants',
        stepDelivery: 'Delivery',
        stepDigital: 'Digital files',
        stepReview: 'Review',
        stepType: 'Type',
        stepBasicInfo: 'Basic Info',
        stepFormats: 'Formats',
        createTitle: 'Create Product',
        createSubtitle: 'Add a new product to your store',
        editTitle: 'Edit Product',
        /** Badge marking a product that is on the quick (simple-mode) editor. */
        quickBadge: 'Quick',
        backToProducts: 'Products',
        saveDraft: 'Save draft',
        publishNow: 'Publish now',
        reviewTitle: 'Review and publish',
        saveAndContinue: 'Save & Continue',
        basicsTitle: 'Basic information',
        basicsDescription: 'Core details about your product. You can update these later.',
        productTitle: 'Product title',
        productTitlePlaceholder: 'e.g. Classic Cotton T-Shirt',
        categoryPlaceholder: 'e.g. Apparel, Electronics, Digital Downloads',
        modeTitle: 'How do you want to add this product?',
        modeQuick: 'Quick',
        modeQuickDescription: 'One price, one stock count. Ready in a minute.',
        modeAdvanced: 'Advanced',
        modeAdvancedDescription: 'Options, variants, per-variant images and digital formats.',
        typeTitle: 'What are you selling?',
        typePhysicalDescription: 'Something you ship to the customer.',
        typeDigitalDescription: 'A file the customer downloads after paying.',
        lockedIndexing:
            'Product is being indexed for AI search. Editing is temporarily disabled — head to the Review step to refresh status.',
        suspendedNotice:
            'This product is suspended because of a delivery-agency issue. You can still edit it — assigning a working delivery agency on the Review step restores it automatically.',
    },

    /** Step 6 — review and publish. */
    review: {
        title: 'Review & publish',
        description:
            'Review your product before publishing. You can always save as draft and publish later.',
        summaryFormats: 'Formats',
        summaryVariants: 'Variants',
        summaryImages: 'Images',
        summaryDownloads: 'Downloads',
        downloadsPaused: 'Paused',
        downloadsEnabled: 'Enabled',
        formatsLive: '{{total}} · {{live}} live',
        tags: 'Tags',
        requirements: 'Publishing requirements',
        requirementsMet: 'All requirements met — ready to publish',
        keepAsDraft: 'Keep as draft',
        publishing: 'Publishing…',
        vectorisationTitle: 'Enable AI vectorisation',
        vectorisationDescription:
            'When enabled and the product is complete and active, product data is sent for vectorisation so customers can find it via AI search. Status and retry options are available from the product card.',
        lockedIndexing: 'This product is being indexed for AI search. Editing is temporarily disabled.',
        archivedNotice:
            'This product is archived and read-only. Restore it to draft from the products list to edit or publish it.',
        pendingReviewNotice:
            'This product is awaiting admin review and is read-only until moderation completes.',
        suspendedNotice:
            'This product is suspended because of a delivery-agency issue. You can still edit it — assigning a working delivery agency restores it automatically.',
    },

    /** Client-side pre-flight blockers, and the dialog that reports them. */
    activation: {
        notCreated: 'Product has not been created yet',
        noDescription: 'A product description is required',
        noActiveVariant: 'At least one active variant is required',
        noDigitalAsset: 'Upload a file for at least one format before publishing',
        zeroPrice: 'All active variants must have a price greater than 0',
        noDefaultVariant: 'A default variant must be set',
        noAgency: 'A delivery agency must be assigned before publishing',
        noPickupLocation: 'A pickup location must be set before publishing',
        // Not a `stock > 0` rule — a warehoused product may legitimately be at
        // zero. It is unlimited stock specifically that a warehouse cannot hold.
        agencyStorageInfiniteStock:
            'Turn off unlimited stock on every active variant — a product stored in an agency warehouse needs a countable quantity',
        cannotPublishTitle: 'Cannot publish yet',
        cannotPublishDescription: 'Fix the following before publishing <0>{{name}}</0>:',
    },

    /** The "saved as a draft, here's what's missing" panel after a failed publish. */
    blockers: {
        savedAsDraft: 'Saved as a draft',
        demoted: 'This product was moved back to draft',
        done: 'Done, back to products',
        retryPublish: 'Try publishing again',
    },

    /** Status transitions offered on the list and the quick editor. */
    transitions: {
        activate: 'Publish Product',
        demote_to_draft: 'Demote to Draft',
        restore: 'Restore to Draft',
        archive: 'Archive Product',
        confirmTitle: '{{action}}?',
        confirm: {
            activate: 'Publish this product? It will become visible in your storefront immediately.',
            demote_to_draft:
                'Move this product back to draft? It will be removed from your storefront until you republish.',
            restore: 'Restore this product from archive? It will be set back to draft so you can edit it.',
            archive: 'Archive this product? It will no longer appear in your store.',
            archiveActive: 'Archive this live product? It will be removed from your storefront immediately.',
        },
        cta: {
            activate: 'Publish',
            demote_to_draft: 'Demote to draft',
            restore: 'Restore',
            archive: 'Archive',
        },
        /** "<name> — <explanation>" as rendered in the confirm dialog body. */
        confirmBody: '{{name}} — {{message}}',
    },

    archiveDialog: {
        title: 'Archive Product?',
        description: 'Archive <0>{{name}}</0>? It will no longer appear in your store.',
        keep: 'Keep Product',
        confirm: 'Yes, Archive',
    },

    /** The quick (simple-mode) editor. */
    simple: {
        createTitle: 'New product',
        createSubtitle: 'The essentials only. You can switch to the advanced editor later.',
        editTitle: 'Edit product',
        savePublish: 'Save & publish',
        saving: 'Saving…',
        publishing: 'Publishing…',
        convertTitle: 'Switch to the advanced editor?',
        convertDescription:
            'The advanced editor adds options, variants and per-variant images. <0>{{name}}</0> keeps everything it already has, but the switch cannot be undone.',
        convertConfirm: 'Switch to advanced',
        convertSuccess: 'Switched to the advanced editor.',
        convertFailed: "We couldn't switch this product. Please try again.",
        readOnlyIndexing: 'This product is being indexed for AI search, so it is read-only for a moment.',
        readOnlyArchived: 'Archived products are read-only. Restore it to draft to make changes.',
        readOnlyPendingReview: 'This product is awaiting review and is read-only until moderation completes.',
        imageNotYours: 'One of these images is not yours.',
        saveDraftInstead: 'Save as draft instead',
        nothingToSave: 'Nothing to save.',
        aiSearchTitle: 'AI search',
        aiSearchDescription:
            'Index this product so customers can find it through AI search. Applies once the product is active and complete.',
        suspendedNotice:
            'This product is suspended because of a delivery-agency issue. You can still edit it — assigning a working delivery agency below restores it automatically.',

        // ── Agency-warehoused stock ───────────────────────────────────────────
        // The quantity was NOT written: an agency holds these goods, so the
        // number needs its countersignature. The form is rebased on what the
        // server actually stored, and this explains the difference.
        stockQueued:
            'Saved. The stock change ({{from}} → {{to}}) is awaiting the storage agency’s approval.',
        stockQueuedNotice: '{{from}} → {{to}} · awaiting the agency’s approval',
        stockQueuedHint:
            'An agency warehouses this product, so the quantity above is what it has on record until your change is approved.',
        viewStockRequest: 'View request',
        withdrawStockRequest: 'Withdraw',
        stockRequestWithdrawn: 'Request withdrawn — you can propose a new quantity.',
    },

    /** Digital products — one card per downloadable format. */
    digital: {
        formatIndex: 'Format {{index}}',
        formatName: 'Format name',
        formatNamePlaceholder: 'e.g. PDF Edition',
        skuPlaceholder: 'JS-COURSE-PDF',
        generateSku: 'Generate',
        generateSkuHint: 'Generate a SKU from the product name and file',
        generateSkuBlocked: 'Set the product name first',
        compareAt: 'Compare at',
        downloadableFile: 'Downloadable file',
        uploadToSell: 'Upload a file to make this format available for sale.',
        previewImage: 'Preview image (optional)',
        previewImageAlt: 'Format preview',
        previewImageHint: 'A thumbnail shown to buyers for this format.',
        addPreviewImage: 'Add preview image',
        replaceImage: 'Replace',
        removeFormat: 'Remove format',
        downloadLimits: 'Download limits (optional)',
        maxDownloads: 'Max downloads',
        maxDownloadsPlaceholder: 'Unlimited',
        expiresAfter: 'Expires after (days)',
        expiresAfterPlaceholder: 'Never',
        active: 'Active',
        badge: {
            fileReady: 'File ready',
            needsFile: 'Needs file',
            live: 'Live',
            paused: 'Paused',
        },
        toggle: {
            needsFile: 'Upload a file before activating this format',
            pause: 'Pause this format',
            activate: 'Activate this format',
        },
        activateNeedsFile: 'Upload a file before activating this format.',
        statusUpdateFailed: 'Could not update the format status.',
        addFormat: 'Add format',
        formatLimit: 'A digital product can have at most {{max}} formats.',
        assetDropHint: 'Drop a file here, or click to browse',
        assetReplace: 'Replace file',
    },

    /** AI search / vectorisation. */
    ai: {
        notIndexed: 'Not indexed',
        indexing: 'Indexing…',
        ready: 'AI search ready',
        failed: 'Indexing failed',
        enable: 'Enable AI search',
        retry: 'Retry AI search',
        disable: 'Disable AI search',
        enabled: 'AI search enabled — indexing started.',
        disabled: 'AI search disabled.',
        retryQueued: 'Retry queued — indexing started.',
        updateFailed: 'Could not update AI search.',
        editLocked: 'Edit (locked — indexing)',
        editLockedToast: 'Editing is locked while AI indexing is in progress.',
        indexingToast: 'Product is being indexed, please try again later',
    },

    /** Delivery agency + pickup location picker on the review step. */
    delivery: {
        title: 'Delivery',
        agencyLabel: 'Delivery agency',
        agencyDescription:
            'The agency that will fulfill orders for this product. Only agencies with an active connection can be assigned.',
        agencyPlaceholder: 'Select an agency',
        agencyDefaultNamed: 'Use my default — {{name}}',
        loadingAgencies: 'Loading agencies…',
        loadAgenciesFailed: 'Could not load delivery agencies.',
        noConnections: 'You have no active delivery-agency connections yet.',
        goToConnections: 'Go to Agency → Connection',
        noDefaultAgency:
            'You have no default delivery agency. Pick one for this product or set a default in your profile before publishing.',
        defaultConnectionLost:
            'Your default agency’s connection is no longer active. Pick another agency here or update your default in Settings.',
        usingDefaultAgency: 'The system will use your default agency — {{name}}.',
        freeDelivery: 'Free delivery',
        freeDeliveryHint:
            'Advertise this product as free delivery. Does not change agency resolution or fee calculation.',
        pickupLabel: 'Pickup location',
        pickupDescription:
            'Where the delivery agency collects this product from. Required to publish.',
        pickupNeedsAgency: 'Assign a delivery agency above first.',
        pickupPlaceholder: 'Select a pickup method',
        pickupFromAddress: 'Collect from my address',
        pickupFromAgency: 'Agency already stores my stock',
        pickupNoSources:
            '{{name}} doesn’t support pickup from your address or agency storage. Choose a different agency.',
        pickupWarehoused: '{{name}} already warehouses this product’s stock.',
        pickupAddressMissing:
            'The address this product was collected from no longer exists. Pick another one before publishing.',
        addressPlaceholder: 'Select a business address',
        noAddresses: 'You have no business addresses yet.',
        goToAddresses: 'Go to Account → Addresses',
        depotPlaceholder: 'Which warehouse holds this stock?',
        depotDefaultSuffix: 'default',
        depotPrimaryName: 'Primary headquarters',
        depotBranchName: 'Branch {{number}}',
        loadingDepots: 'Loading warehouses…',
        depotsUnavailable:
            'We could not load this agency’s warehouses right now. Your current choice is unchanged — try again in a moment.',
        noDepots: '{{name}} has no warehouse on file yet.',
        depotRemoved:
            'The warehouse you chose is no longer operated by this agency. Collection has fallen back to their main one — pick another if that is wrong.',
        /** Agency storage is unavailable because a variant has unlimited stock. */
        storageNeedsCountableStock:
            'A warehouse holds a countable quantity, so agency storage is unavailable while {{skus}} has unlimited stock. Turn unlimited stock off and enter a quantity.',
        /** Already warehoused AND unlimited — a live product that predates the rule. */
        storageInfiniteLive:
            'This product is stored at an agency but {{skus}} has unlimited stock. It will not publish again until you turn that off.',
        storageSkusMore: '{{skus}} and {{count}} more',
        guidance: {
            multipleAddressesTitle: 'Which address should the courier collect from?',
            multipleAddressesBody:
                'You have several business addresses and none is set as the default, so we did not guess.',
            noAgencyTitle: 'No delivery agency yet',
            noAgencyBody:
                'Connect an agency and set it as your default to publish physical products.',
            noAgencyAction: 'Set up delivery',
            agencyInactiveTitle: 'Your delivery agency is not active',
            agencyInactiveBody: 'Reactivate the connection, or connect a different agency.',
            agencyInactiveAction: 'Review connections',
            noBusinessAddressTitle: 'Add a business address',
            noBusinessAddressBody:
                'Your agency only collects from a vendor address, and you have none saved.',
            noBusinessAddressAction: 'Add an address',
            agencyOffersNeitherTitle: 'This agency supports neither pickup model',
            agencyOffersNeitherBody:
                'It offers neither collection from your address nor storage of your stock. Choose a different agency.',
            agencyOffersNeitherAction: 'Choose another agency',
            resolutionFailedTitle: 'We could not work out a pickup location',
            resolutionFailedBody: 'This is usually temporary.',
        },
    },

    /** Image upload / gallery inside the product editors. */
    media: {
        title: 'Product images',
        stepDescriptionSingle: 'Add a cover image for this product.',
        stepDescriptionMany:
            'Add up to {{max}} images. The first image will be used as the product thumbnail. Drag cards to reorder.',
        stepLibraryNote: 'Images come from your media library — upload new ones right inside the picker.',
        addFromLibrary: 'Add images from your library',
        addFromLibraryHint:
            'Images only · max {{max}} · {{remaining}} remaining · drag cards above to reorder',
        replaceImage: 'Replace image',
        tapToClose: 'Tap to close',
        thumbnail: 'Thumbnail',
        skipForNow: 'Skip for now',
        variantImages: 'Variant images',
        addVariantImage: 'Add image ({{used}}/{{max}})',
        saveVariantFirst: 'Save the variant to add images',
        imageFallback: 'Image',
        variantImageAlt: 'Variant image',
        sizeLabel: 'Size: ',
        typeLabel: 'Type: ',
        delete: 'Delete',
    },

    /** The downloadable-asset dropzone on a digital format. */
    asset: {
        replace: 'Replace',
        uploading: 'Uploading asset…',
        dropHere: 'Drop your file here',
        dragOrClick: 'Drag & drop or click to upload',
        supported: 'PDF, ZIP, MP4, MP3, images, Word, Excel · max 500MB',
        selectFile: 'Select File',
        typeNotAllowed:
            'File type “{{type}}” is not allowed. Supported: PDF, ZIP, MP4, MP3, images, Word, Excel.',
        tooLarge: 'File too large ({{size}}). Maximum is 500MB.',
    },

    /** The digital-formats wizard step. */
    formats: {
        title: 'Formats',
        description:
            'Offer your digital product in up to {{max}} formats (e.g. PDF, ZIP, EPUB). Each format has its own file, price, and download rules.',
        downloadsEnabled: 'Downloads enabled',
        downloadsEnabledHint: 'When off, all formats are paused — purchases won’t deliver files.',
        addFormat: 'Add format',
        atLimit: 'Maximum {{max}} formats reached.',
        count: '{{used}} of {{max}} formats.',
        saveAndContinue: 'Save & continue',
        skuRequired: 'SKU is required',
        nameRequired: 'Format name is required',
        priceRequired: 'Price must be greater than 0',
    },

    /** Step 0 — pick quick-add vs. the full wizard. */
    mode: {
        title: 'What are you adding?',
        description:
            'Quick add covers most products. Pick one of the others if you need variants or downloadable files — this cannot be changed after creation.',
        recommended: 'Recommended',
        simple: 'Quick add',
        simpleDescription: 'One page, one price, one stock count. Publishes as soon as it is ready.',
        simpleExamples: 'A single pair of shoes, one book, one bag',
        physical: 'Physical with variants',
        physicalDescription: 'Sizes, colours and per-variant stock, images and pricing.',
        physicalExamples: 'A t-shirt in 4 sizes × 3 colours',
        digital: 'Digital product',
        digitalDescription: 'Downloadable files with per-format pricing and download limits.',
        digitalExamples: 'Software, e-books, music, templates, courses',
    },

    /** Step 1 — physical or digital, inside the full wizard. */
    typeSelect: {
        title: 'Choose product type',
        description:
            'The type determines which fields and steps are required. This cannot be changed after creation.',
        physical: 'Physical Product',
        physicalDescription: 'A tangible product that gets shipped to the customer.',
        physicalExamples: 'Clothing, electronics, furniture, accessories',
        digital: 'Digital Product',
        digitalDescription: 'A downloadable file or software license delivered electronically.',
        digitalExamples: 'Software, e-books, music, templates, courses',
    },

    /** The one-way switch from the quick editor to the full one. */
    convert: {
        title: 'Switch to the advanced editor?',
        namedLead:
            '“{{name}}” will move to the full editor, unlocking variants, options and per-variant images.',
        genericLead:
            'This product will move to the full editor, unlocking variants, options and per-variant images.',
        unchanged:
            'Nothing else changes — your existing price, stock and images stay exactly as they are.',
        oneWay: 'This is one-way. There is no way back to the quick editor.',
        confirm: 'Switch to the advanced editor',
        success: 'Switched to the advanced editor.',
    },

    /** The quick-add create page. */
    quickAdd: {
        title: 'Quick add product',
        subtitleLead: 'One page, one price. Need sizes or colours?',
        subtitleLink: 'Use the advanced editor',
        createdPublished: 'Product created and published.',
        savedAsDraft: 'Product saved as a draft.',
        published: 'Product published.',
        viewPlans: 'View plans',
        useGeneratedSku: 'Use an auto-generated SKU instead',
    },

    /** Field-level validation. Referenced by the zod schemas via key. */
    validation: {
        titleMin: 'Title must be at least 3 characters',
        titleMax: 'Title must be 200 characters or less',
        categoryRequired: 'Category is required',
        descriptionRequired: 'Description is required',
        tagEmpty: 'Tag cannot be empty',
        tagsUnique: 'Tags must be unique',
        seoTitleMax: 'SEO title must be 60 characters or less',
        seoDescriptionMax: 'SEO description must be 160 characters or less',
        optionNameRequired: 'Option name is required',
        optionNameMax: 'Option name must be 50 characters or less',
        optionValueEmpty: 'Value cannot be empty',
        optionValueMin: 'At least one value is required',
        optionValuesUnique: 'Option values must be unique',
        skuRequired: 'SKU is required',
        skuMax: 'SKU must be 100 characters or less',
        priceRequired: 'Price is required',
        priceMin: 'Price must be 0 or more',
        compareAtMin: 'Compare-at price must be 0 or more',
        stockNumber: 'Stock must be a number',
        stockInteger: 'Stock must be a whole number',
        stockMin: 'Stock cannot be negative',
        weightMin: 'Weight must be 0 or more',
        lengthMin: 'Length must be 0 or more',
        widthMin: 'Width must be 0 or more',
        heightMin: 'Height must be 0 or more',
        nameRequired: 'Product name is required',
        pricePositive: 'Price must be positive',
        priceGreaterThanZero: 'Price must be greater than 0',
        skuEmpty: 'SKU cannot be empty',
        imageLimit: 'A product can have at most 7 images',
        lowStockThreshold: 'The low-stock threshold must be a whole number, 0 or more',
    },

    toast: {
        created: 'Product created',
        updated: 'Product updated',
        published: 'Product published',
        archived: 'Product archived',
        archivedMany: plural({ one: '{{count}} product archived', other: '{{count}} products archived' }),
        restored: 'Product restored',
        duplicated: 'Product duplicated',
        statusChanged: '“{{name}}” is now {{status}}.',
        infoSaved: 'Product info saved.',
        mediaSaved: 'Media saved.',
        optionsSaved: 'Options saved.',
        variantsSaved: 'Variants saved.',
        /** Everything else applied; the quantity is a proposal until the agency signs off. */
        variantsSavedStockQueued: plural({
            one: 'Variants saved. {{count}} stock change is awaiting the storage agency’s approval.',
            other: 'Variants saved. {{count}} stock changes are awaiting the storage agency’s approval.',
        }),
        formatsSaved: 'Formats saved.',
        agencyUpdated: 'Delivery agency updated.',
        agencyDefault: 'Using your default delivery agency.',
        freeDeliveryEnabled: 'Free delivery enabled.',
        freeDeliveryDisabled: 'Free delivery disabled.',
        pickupUpdated: 'Pickup location updated.',
        publishedBang: 'Product published!',
        savedAsDraft: 'Product saved as draft.',
        changesSaved: 'Changes saved.',
    },

    errors: {
        loadFailed: "We couldn't load your products. Please try again.",
        loadOneFailed: "We couldn't load this product. Please try again.",
        saveFailed: "We couldn't save this product. Please try again.",
        publishFailed: "We couldn't publish this product. Please try again.",
        archiveFailed: "We couldn't archive this product. Please try again.",
        deleteFailed: "We couldn't remove this product. Please try again.",
        bulkArchiveFailed: 'Could not archive products.',
        validateFailed: 'Could not validate product.',
        statusChangeFailed: 'Could not change product status.',
        notFound: 'This product no longer exists.',
        optionsFailed: "We couldn't apply your option changes. Please try again.",
        variantsFailed: "We couldn't save your variants. Please try again.",
        formatsFailed: "We couldn't save your formats. Please try again.",
        mediaFailed: "We couldn't save your images. Please try again.",
        agencyFailed: "We couldn't update the delivery agency. Please try again.",
        freeDeliveryFailed: "We couldn't update free delivery. Please try again.",
        pickupFailed: "We couldn't update the pickup location. Please try again.",
        draftFailed: "We couldn't save your draft. Please try again.",
    },
} as const;

export default products;
