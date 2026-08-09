/**
 * Backend error codes → vendor-facing messages.
 *
 * Source of truth for the code list: `api-doc/error-codes.ts`. Every code the
 * platform can emit has an entry here, so the dashboard never has to fall back
 * to `error.message` — which is English, written for developers, and sometimes
 * names internals a vendor should not see.
 *
 * House style for these messages:
 *  - say what happened in the vendor's terms, not the service's;
 *  - say what to do next whenever there is a next step;
 *  - no error codes, ids, stack fragments or endpoint names in the text.
 *
 * Codes belonging to other roles (delivery agent, agency, admin, customer) are
 * translated too: a vendor can still trigger them indirectly — reassigning a
 * shipment, reading a booking — and an untranslated code would surface as the
 * raw string.
 */

export const errors = {
    /** Nothing matched — the true last resort. */
    unknown: 'Something went wrong. Please try again.',
    network: "Can't reach the server. Check your connection and try again.",
    /** A field the backend rejected but that we have no specific copy for. */
    fieldInvalid: 'Please check this field.',
    /** Shown while a request is being retried after a recoverable failure. */
    retrying: 'Retrying…',

    /** Fallbacks by HTTP status, used when a code is not in `codes` below. */
    status: {
        400: "That request wasn't valid. Please check your input and try again.",
        401: 'Your session has expired. Please sign in again.',
        403: "You don't have permission to do that.",
        404: "We couldn't find what you were looking for.",
        409: 'That conflicts with the current state. Refresh and try again.',
        413: 'That file is too large.',
        422: "We couldn't process that. Please check your input.",
        429: 'Too many requests. Please wait a moment and try again.',
        500: 'A server error occurred. Please try again in a moment.',
        502: 'The server is temporarily unavailable. Please try again shortly.',
        503: 'The service is temporarily unavailable. Please try again shortly.',
        504: 'The server took too long to respond. Please try again.',
    },

    /** Field-level messages for validation errors, keyed by backend field name. */
    fields: {
        email: 'Enter a valid email address.',
        phone: 'Enter a valid phone number, including the country code.',
        password: 'Enter a valid password.',
        displayName: 'Enter a name between 2 and 100 characters.',
        title: 'Enter a title.',
        price: 'Enter a valid price.',
        stock: 'Enter a valid stock quantity.',
        sku: 'Enter a valid SKU.',
        quantity: 'Enter a valid quantity.',
        country: 'Select a country.',
        timezone: 'Select a timezone.',
        currency: 'Select a currency.',
        amount: 'Enter a valid amount.',
        slug: 'Enter a valid store address.',
    },

    /**
     * Per-file rejections from `POST /api/files/upload`
     * (`UPLOAD_POLICY_VIOLATION` → `error.details.violations[]`). Phrased to
     * follow a file name, e.g. "photo.png is too large."
     */
    upload: {
        namedFile: '{{name}} {{reason}}.',
        someFile: 'A file {{reason}}.',
        violations: {
            FILE_TOO_LARGE: 'is too large',
            MIME_NOT_ALLOWED: 'has an unsupported file type',
            TOO_MANY_FILES: 'exceeds the maximum number of files',
            QUOTA_EXCEEDED:
                'would exceed your storage quota — free up space in your Media Library or upgrade your plan',
            VIRUS_DETECTED: 'failed the security scan',
            PERMISSION_DENIED: 'cannot be uploaded (permission denied)',
            TOTAL_SIZE_EXCEEDED: 'pushes the upload over the total size limit',
            DUPLICATE_FILE: 'has already been uploaded',
            MIME_TYPE_MISMATCH: 'has contents that don’t match its extension',
            POLYGLOT_DETECTED: 'looks like a disguised file and was rejected',
            UNDETECTABLE_TYPE: 'has an unrecognised file type',
            UNKNOWN: 'was rejected',
        },
    },

    /**
     * Screen-specific wording, checked before `codes` below. A context only
     * lists the codes it needs to say differently; everything else falls
     * through to the shared message.
     */
    contexts: {
        /** The quick (simple-mode) product editor. */
        simpleProduct: {
            VALIDATION_ERROR: 'Some fields need attention — check the highlighted inputs.',
            CATALOG_IMAGE_LIMIT_EXCEEDED: 'A product can have at most 7 images.',
            // The API rolls the whole transaction back, so the message has to
            // say nothing was saved — otherwise vendors go hunting for a
            // half-created product.
            CATALOG_PRODUCT_ACCESS_DENIED:
                'One of the selected images belongs to another account. Nothing was saved — remove it and try again.',
            BILLING_LIMIT_EXCEEDED:
                "You've reached your plan's limit for active products. Upgrade your plan, or archive another product, to publish this one.",
            CATALOG_PRODUCT_NOT_FOUND: 'This product no longer exists.',
            CATALOG_VARIANT_SKU_EXISTS:
                'That SKU is already taken. SKUs are unique across the whole platform — choose another, or leave it blank to generate one automatically.',
            CATALOG_PRODUCT_SIMPLE_MODE_LOCKED:
                'This product uses the quick editor, so that action is not available. Switch it to the advanced editor first.',
            CATALOG_PRODUCT_NOT_SIMPLE_MODE:
                'This product uses the advanced editor. Open it in the full product editor instead.',
            CATALOG_PRODUCT_VECTORISATION_PENDING:
                'This product is being indexed for AI search. Please try again in a few seconds.',
            CATALOG_PRODUCT_INVALID_PICKUP_LOCATION:
                "That pickup location isn't valid for the delivery agency handling this product.",
            CATALOG_PRODUCT_NO_DEFAULT_VARIANT:
                'This product lost its variant. Open it in the advanced editor to repair it.',
            CATALOG_PRODUCT_AGENCY_STORAGE_INFINITE_STOCK:
                'This product is stored at an agency, so it needs a countable stock quantity. Turn off unlimited stock, or move pickup back to your own address.',
        },

        /** Assigning a delivery agency or pickup location to a product. */
        delivery: {
            CATALOG_PRODUCT_INVALID_PICKUP_LOCATION:
                "This pickup location isn't valid for the assigned delivery agency, or its business address no longer exists.",
            // A warehouse holds a countable number of things, so agency storage
            // and unlimited stock are mutually exclusive. The save is refused
            // rather than accepted-and-silently-unpublished.
            CATALOG_PRODUCT_AGENCY_STORAGE_INFINITE_STOCK:
                "You can't store this product at the agency while a variant has unlimited stock. Turn unlimited stock off and record a quantity first.",
            CATALOG_PRODUCT_VECTORISATION_PENDING:
                'This product is currently processing background operations. Please try again in a few seconds.',
            CATALOG_PRODUCT_VECTORISATION_NOT_ELIGIBLE:
                'This product is not eligible for AI search indexing. It must be active, have indexing enabled, and have a title, description and category.',
            CONNECTION_NOT_ACTIVE:
                'You need an active, approved connection with this agency before you can assign it. Send or check your connection request first.',
        },

        /**
         * The stock-request inbox. These three need wording only the inbox can
         * give them, because only the inbox can act on the outcome — elsewhere
         * they fall through to the shorter `codes` sentence.
         */
        stockRequest: {
            // A compare-and-set miss: the row exists and the other party
            // resolved it first. Re-sending would apply an intent formed
            // against a state that no longer holds — so we refetch, not retry.
            STOCK_REQUEST_NOT_PENDING:
                "Someone answered this request first. We've reloaded it — check the outcome before proposing anything else.",
            STOCK_REQUEST_NOT_YOURS:
                "That button was out of date. We've refreshed what you can do here.",
            STOCK_REQUEST_ALREADY_PENDING:
                'A stock request is already open on this SKU. Withdraw yours, or answer theirs, before proposing another.',
        },

        /**
         * The payout surface. The minimum is backend config with no endpoint
         * exposing it, so the amount is written into the sentence per locale
         * rather than interpolated.
         */
        earnings: {
            EARNINGS_PAYOUT_ALREADY_PENDING:
                'You already have a payout request in progress — track it below.',
            EARNINGS_PAYOUT_METHOD_MISSING:
                'Add a payout method below before requesting a withdrawal.',
            EARNINGS_PAYOUT_NO_AVAILABLE_BALANCE: 'There is no available balance to withdraw yet.',
            EARNINGS_PAYOUT_BELOW_MINIMUM:
                'Your available balance is below the 10,000 XAF minimum for a withdrawal.',
        },

        /** Vendor ↔ agency connection requests. */
        agencyConnection: {
            CONNECTION_NOT_ACTIVE:
                'You need an active, approved connection with this agency before you can assign it. Send or check your connection request first.',
            CONNECTION_ALREADY_EXISTS: 'You already have a connection request with this agency.',
            CONNECTION_NOT_APPROVER: "You can't approve or reject a request you sent yourself.",
            CONNECTION_NOT_REQUESTER: "You can't withdraw a request you didn't send.",
            CONNECTION_NOT_PENDING: 'This request is no longer pending.',
            CONNECTION_INVALID_STATUS_TRANSITION:
                "This connection can't be changed from its current status.",
            CONNECTION_WRONG_REAPPROVAL_PARTY:
                "It's the agency's turn to reapprove this connection, not yours.",
            CONNECTION_VENDOR_NOT_FOUND:
                'Your vendor profile could not be resolved. Please refresh and try again.',
            DELIVERY_AGENCY_NOT_FOUND: 'This delivery agency could no longer be found.',
        },

        /** Orders list and order detail. */
        order: {
            ORDER_ITEM_NOT_FOUND: 'This item could no longer be found on the order.',
            ORDER_ITEM_NOT_REASSIGNABLE:
                "This item has already been dispatched and can't be reassigned to a different agency.",
            DIGITAL_ENTITLEMENT_NOT_FOUND: 'This entitlement could no longer be found.',
            DIGITAL_ENTITLEMENT_ALREADY_REVOKED: 'This entitlement has already been revoked.',
            DIGITAL_ENTITLEMENT_NOT_REVOKED: 'This entitlement is not currently revoked.',
            DIGITAL_ENTITLEMENT_EXPIRED: "This entitlement has expired and can't be restored.",
            DIGITAL_ENTITLEMENT_UNAUTHORIZED: "You don't have access to this entitlement.",
        },

        /**
         * Bookable services. They reuse the `CATALOG_PRODUCT_*` codes, but the
         * shared wording talks about variants and stock, which a vendor editing
         * a service never sees — a service has one implicit "booking variant".
         */
        service: {
            CATALOG_PRODUCT_INVALID_STATE:
                "This status change isn't allowed from the service's current status.",
            CATALOG_PRODUCT_NO_DESCRIPTION: 'A service description is required.',
            CATALOG_PRODUCT_NO_VARIANTS: 'Set a booking price before publishing.',
            CATALOG_PRODUCT_NO_DEFAULT_VARIANT: 'A booking price must be set before publishing.',
            CATALOG_PRODUCT_VARIANT_ZERO_PRICE: 'The booking price must be greater than 0.',
            CATALOG_PRODUCT_SERVICE_NO_CAPACITY:
                'Set the seats per slot (capacity) before publishing.',
            CATALOG_SERVICE_VARIANT_EXISTS: 'This service already has its booking variant.',
        },

        /**
         * Plan / credit checkout. The shared wording is right for most codes; these
         * few need to say what the vendor should actually do next inside a dialog
         * that is still open and waiting on them.
         */
        billing: {
            BILLING_PENDING_PLAN_EXISTS:
                'You already have a plan queued to start when your current one ends. Wait for it to activate before buying another.',
            BILLING_PLAN_NOT_PURCHASABLE:
                'The free Starter plan is the default tier and cannot be purchased.',
            BILLING_TOPUP_INVALID_STATE:
                'This payment cannot be verified yet. Please retry in a moment.',
            BILLING_PURCHASE_INVALID_STATE:
                'This payment cannot be verified yet. Please retry in a moment.',
            PAYMENT_CARD_DECLINED:
                'Your card was declined. Check the details or try another card.',
        },
    },

    codes: {
        // ── Auth ──────────────────────────────────────────────────────────────
        AUTH_INVALID_CREDENTIALS: 'That email or password is incorrect.',
        AUTH_TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
        AUTH_TOKEN_INVALID: 'Your session is no longer valid. Please sign in again.',
        AUTH_MISSING_TOKEN: 'Please sign in to continue.',
        AUTH_ROLE_NOT_FOUND: "This account doesn't have a vendor profile.",
        AUTH_ROLE_ALREADY_EXISTS: 'This account already has that role.',
        AUTH_ROLE_REQUIRED: 'This account needs a vendor role to continue.',
        AUTH_ACCOUNT_NOT_FOUND: 'We could not find that account.',
        AUTH_PHONE_TAKEN: 'That phone number is already in use by another account.',
        AUTH_EMAIL_TAKEN: 'That email address is already in use by another account.',
        AUTH_EMAIL_ALREADY_VERIFIED: 'This email address is already verified.',
        AUTH_EMAIL_MISSING: 'Add an email address to your account first.',
        AUTH_VERIFY_TOKEN_INVALID: 'That verification link is invalid or has expired.',
        AUTH_WA_ALREADY_VERIFIED: 'Your WhatsApp number is already verified.',
        AUTH_PROFILE_NOT_FOUND: 'We could not find your profile.',
        AUTH_PHONE_REQUIRED_FOR_WA: 'Add a phone number before linking WhatsApp.',
        AUTH_UNSUPPORTED_ROLE: 'This account type cannot use the vendor dashboard.',
        AUTH_REFRESH_TOKEN_INVALID: 'Your session has expired. Please sign in again.',
        AUTH_SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
        AUTH_USER_NOT_FOUND: 'We could not find that user.',
        AUTH_ROLE_PROFILE_NOT_FOUND: 'We could not find the profile for this role.',
        AUTH_WA_PHONE_ID_REQUIRED: 'WhatsApp is not fully configured yet.',
        AUTH_FORBIDDEN: "You don't have permission to do that.",
        AUTH_OAUTH_STATE_INVALID: 'That sign-in attempt could not be verified. Please try again.',
        AUTH_OAUTH_STATE_EXPIRED: 'That sign-in attempt took too long. Please try again.',

        // ── Payments ──────────────────────────────────────────────────────────
        PAYMENT_ORDER_NOT_FOUND: 'We could not find that order.',
        PAYMENT_ORDER_ALREADY_PAID: 'This order has already been paid.',
        PAYMENT_INVALID_ORDER_STATUS: "This order's status doesn't allow a payment right now.",
        PAYMENT_GATEWAY_NOT_SUPPORTED: 'That payment method is not supported here.',
        PAYMENT_INITIATION_FAILED: 'We could not start the payment. Please try again.',
        PAYMENT_VERIFICATION_FAILED: 'We could not confirm that payment. Please try again.',
        PAYMENT_BOOKING_NOT_FOUND: 'We could not find that booking.',
        PAYMENT_BOOKING_CANCELLED: 'This booking was cancelled and cannot be paid.',
        PAYMENT_BOOKING_NO_PAYMENT_REQUIRED: 'This booking does not require a payment.',
        PAYMENT_BOOKING_ALREADY_PAID: 'This booking has already been paid.',
        PAYMENT_BOOKING_IN_PROGRESS: 'A payment for this booking is already in progress.',
        PAYMENT_TRANSACTION_NOT_FOUND: 'We could not find that transaction.',
        PAYMENT_WEBHOOK_INVALID_PAYLOAD: 'The payment provider sent something we could not read.',
        PAYMENT_MISSING_BOOKING_ID: 'This payment is missing its booking reference.',
        PAYMENT_GATEWAY_NOT_IMPLEMENTED: 'That payment method is not available yet.',
        PAYMENT_CARD_DECLINED: 'The card was declined. Try another payment method.',
        PAYMENT_CART_NOT_FOUND: 'We could not find that cart.',
        PAYMENT_CART_NO_PAYABLE_ORDERS: 'There is nothing to pay for in this cart.',
        PAYMENT_CART_MIXED_CURRENCY: 'All items in one payment must use the same currency.',
        PAYMENT_REFERENCE_REQUIRED: 'A payment reference is required.',
        PAYMENT_ORDER_IS_COD: 'This is a cash-on-delivery order and is paid on delivery.',
        STRIPE_WEBHOOK_SIGNATURE_INVALID: 'We could not verify that payment notification.',
        PAYMENT_METHOD_NOT_FOUND: 'We could not find that payment method.',
        PAYMENT_METHOD_LIMIT_REACHED:
            'You have reached the maximum number of saved payment methods. Remove one to add another.',

        // ── Refunds ───────────────────────────────────────────────────────────
        REFUND_NOT_ELIGIBLE: 'This order is not eligible for a refund.',
        REFUND_WINDOW_EXPIRED: 'The refund window for this order has closed.',
        REFUND_POLICY_DISABLED: 'Refunds are turned off in your return policy.',
        REFUND_AMOUNT_EXCEEDS_MAX: 'That refund is larger than what remains refundable on this order.',
        REFUND_ALREADY_FULLY_REFUNDED: 'This order has already been fully refunded.',
        REFUND_PAYMENT_NOT_FOUND: 'We could not find the payment for this order.',
        REFUND_ORDER_NOT_PAID: 'This order has not been paid, so there is nothing to refund.',
        REFUND_GATEWAY_FAILED: 'The payment provider could not process the refund. Please try again.',
        REFUND_GATEWAY_NOT_SUPPORTED: 'Refunds are not supported for the payment method used.',

        // ── Tickets ───────────────────────────────────────────────────────────
        TICKET_NOT_FOUND: 'We could not find that ticket.',
        TICKET_UPDATE_FAILED: 'We could not update the ticket. Please try again.',
        TICKET_ASSIGN_FAILED: 'We could not assign the ticket. Please try again.',
        TICKET_PRIORITY_UPDATE_FAILED: 'We could not change the priority. Please try again.',
        TICKET_CLOSE_FAILED: 'We could not close the ticket. Please try again.',
        TICKET_REOPEN_FAILED: 'We could not reopen the ticket. Please try again.',
        TICKET_GENERAL_UPDATE_FAILED: 'We could not save your changes. Please try again.',
        TICKET_ACCESS_DENIED: "You don't have access to this ticket.",
        TICKET_FOLLOWER_LIMIT_EXCEEDED: 'This ticket already has the maximum number of followers.',
        TICKET_ATTACHMENT_LIMIT_EXCEEDED: 'This ticket already has the maximum number of attachments.',
        TICKET_ATTACHMENT_MISSING: 'Attach a file before sending.',
        TICKET_PRIORITY_LOCKED: 'The priority of this ticket is set by support and cannot be changed.',
        TICKET_INVALID_STATUS_TRANSITION: 'This ticket cannot move to that status from where it is now.',
        TICKET_CLOSED: 'This ticket is closed. Reopen it to keep working on it.',
        TICKET_WAITING_TARGET_NOT_PARTICIPANT: 'You can only wait on someone taking part in this ticket.',
        TICKET_CUSTOMER_PRIVATE_NOTE_FORBIDDEN: 'Private notes are not visible to customers.',
        TICKET_REQUIRED_INFO_MISSING: 'Some required information is missing from this ticket.',
        TICKET_ENTITY_NOT_FOUND: 'We could not find the item this ticket refers to.',

        // ── Digital delivery ──────────────────────────────────────────────────
        DIGITAL_INVALID_ENTITLEMENT_ID: 'That download reference is not valid.',
        DIGITAL_ENTITLEMENT_NOT_FOUND: 'We could not find that download.',
        DIGITAL_ENTITLEMENT_UNAUTHORIZED: "You don't have access to that download.",
        DIGITAL_ENTITLEMENT_REVOKED: 'Access to this download has been revoked.',
        DIGITAL_ENTITLEMENT_EXPIRED: 'This download link has expired.',
        DIGITAL_ENTITLEMENT_ALREADY_REVOKED: 'This download has already been revoked.',
        DIGITAL_ENTITLEMENT_NOT_REVOKED: 'This download is not revoked.',
        DIGITAL_DOWNLOAD_LIMIT_EXCEEDED: 'The download limit for this purchase has been reached.',
        DIGITAL_TOKEN_INVALID: 'That download link is not valid.',
        DIGITAL_ENTITLEMENT_CONFIG_MISSING: 'This product is missing its digital delivery settings.',
        DIGITAL_ENTITLEMENT_CONFIG_INACTIVE: 'Digital delivery is turned off for this product.',
        DIGITAL_ASSET_NOT_FOUND: 'We could not find that digital file.',
        DIGITAL_ASSET_ACCESS_DENIED: "You don't have access to that digital file.",
        DIGITAL_ASSET_IN_USE: 'This digital file is attached to a product and cannot be removed.',

        // ── Messaging channels ────────────────────────────────────────────────
        WHATSAPP_ROLE_NOT_SUPPORTED: 'WhatsApp is not available for this account type.',
        WHATSAPP_NOT_LINKED: 'Link your WhatsApp number first.',
        WHATSAPP_LINK_FAILED: 'We could not link WhatsApp. Please try again.',
        WHATSAPP_INVALID_PAYLOAD: 'We could not send that WhatsApp message.',
        WHATSAPP_POLICY_VIOLATION: "That message doesn't meet WhatsApp's messaging rules.",
        WHATSAPP_PROVIDER_REJECTED: 'WhatsApp rejected that message. Please try again later.',
        WHATSAPP_VALIDATION_ERROR: 'That WhatsApp message could not be validated.',
        WHATSAPP_IDEMPOTENCY_REQUIRED: 'That WhatsApp request is missing a reference.',
        WHATSAPP_DUPLICATE_MESSAGE: 'That message has already been sent.',
        WHATSAPP_UNSUPPORTED_MESSAGE_TYPE: 'That message type is not supported on WhatsApp.',
        TELEGRAM_NOT_LINKED: 'Link your Telegram account first.',
        TELEGRAM_LINK_FAILED: 'We could not link Telegram. Please try again.',
        TELEGRAM_LINK_NOT_FOUND: 'That Telegram link has expired. Generate a new one.',

        // ── Google / calendar integrations ────────────────────────────────────
        GOOGLE_MISSING_CLIENT_ID: 'Google sign-in is not configured. Contact support.',
        GOOGLE_MISSING_CLIENT_SECRET: 'Google sign-in is not configured. Contact support.',
        GOOGLE_MISSING_REDIRECT_URI: 'Google sign-in is not configured. Contact support.',
        GOOGLE_PROFILE_FETCH_FAILED: 'We could not read your Google profile. Please try again.',
        GOOGLE_NO_ACCESS_TOKEN: 'Google did not grant access. Please connect again.',
        GOOGLE_NO_REFRESH_TOKEN: 'Google access could not be kept. Please connect again.',
        GOOGLE_CALENDAR_NOT_CONNECTED: 'Connect your Google Calendar first.',
        GOOGLE_EVENT_MISSING_ID: 'That calendar event is missing its reference.',
        GOOGLE_EVENT_MISSING_DATETIME: 'That calendar event has no date and time.',
        GOOGLE_TOKEN_ENCRYPTION_KEY_MISSING: 'Calendar sync is not configured. Contact support.',
        GOOGLE_TOKEN_INVALID_FORMAT: 'Your calendar connection is invalid. Please reconnect.',
        INTEGRATION_UNSUPPORTED_CALENDAR_PROVIDER: 'That calendar provider is not supported.',
        BOOKING_CALENDAR_SYNC_FAILED: 'The booking was saved, but calendar sync failed.',

        // ── Database / infrastructure ─────────────────────────────────────────
        DATABASE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again shortly.',
        DATABASE_CONNECTION_ERROR: 'The service is temporarily unavailable. Please try again shortly.',
        DATABASE_UNIQUE_CONSTRAINT_VIOLATION: 'That value is already in use.',
        COMMAND_ALREADY_REGISTERED: 'Something went wrong on our side. Please try again.',
        COMMAND_NOT_FOUND: 'Something went wrong on our side. Please try again.',
        MAIL_TEMPLATE_NOT_FOUND: 'We could not send that email. Please try again.',

        // ── Orders ────────────────────────────────────────────────────────────
        ORDER_NOT_FOUND: 'We could not find that order.',
        ORDER_PAYMENT_FAILED: 'The payment for this order failed.',
        ORDER_TERMINAL_STATE: 'This order is finished and can no longer be changed.',
        ORDER_INVALID_TRANSITION: 'This order cannot move to that status from where it is now.',
        ORDER_PAYMENT_REQUIRED: 'This order has to be paid before it can move on.',
        ORDER_PAYMENT_FAILED_STATE: 'This order is on hold because its payment failed.',
        ORDER_DISPUTE_HOLD: 'This order is on hold while a dispute is resolved.',
        ORDER_WRONG_TYPE: "That action doesn't apply to this kind of order.",
        ORDER_DELIVERY_AGENCY_NOT_FOUND: 'We could not find that delivery agency.',
        ORDER_ITEM_NOT_FOUND: 'We could not find that order item.',
        ORDER_ITEM_NOT_REASSIGNABLE: 'This item has moved too far along to be reassigned.',
        ORDER_ALREADY_CANCELLED: 'This order is already cancelled.',
        ORDER_NOT_CANCELLABLE: 'This order can no longer be cancelled.',
        ORDER_CANCEL_REQUIRES_REFUND: 'Refund this order before cancelling it.',
        CANCELLATION_NOT_ALLOWED: 'Your cancellation policy does not allow cancelling this.',
        ORDER_CART_EMPTY: 'That cart is empty.',
        ORDER_CART_INVALID: 'That cart is no longer valid. Please rebuild it.',
        ORDER_PRODUCT_NOT_FOUND: 'We could not find one of the products on this order.',
        ORDER_VENDOR_NOT_FOUND: 'We could not find the vendor for this order.',
        ORDER_NO_DELIVERY_AGENCY:
            'No delivery agency is set for this order. Connect an agency and try again.',

        // ── Shipments ─────────────────────────────────────────────────────────
        SHIPMENT_NOT_FOUND: 'We could not find that shipment.',
        SHIPMENT_INVALID_STATUS_TRANSITION: 'This shipment cannot move to that status from where it is now.',
        SHIPMENT_REJECTION_NOT_ALLOWED: 'This shipment can no longer be rejected.',
        SHIPMENT_AGENT_NOT_IN_AGENCY: 'That delivery agent does not belong to this agency.',
        SHIPMENT_ACCESS_DENIED: "You don't have access to this shipment.",
        SHIPMENT_ALREADY_CONFIRMED: 'This shipment has already been confirmed.',
        SHIPMENT_CONFIRMATION_NOT_ALLOWED: 'This shipment cannot be confirmed yet.',
        SHIPMENT_TRACKING_NUMBER_GENERATION_FAILED:
            'We could not generate a tracking number. Please try again.',
        SHIPMENT_OFFER_NOT_FOUND: 'We could not find that delivery offer.',
        SHIPMENT_OFFER_NOT_PENDING: 'That delivery offer has already been answered.',
        SHIPMENT_OFFER_EXPIRED: 'That delivery offer has expired.',
        SHIPMENT_NOT_OFFERABLE: 'This shipment cannot be offered to an agent right now.',
        SHIPMENT_ALREADY_HAS_AGENT: 'A delivery agent is already assigned to this shipment.',
        SHIPMENT_ALREADY_HAS_PENDING_OFFER: 'This shipment already has an offer awaiting an answer.',
        SHIPMENT_NO_ELIGIBLE_AGENTS: 'No delivery agent is available for this shipment right now.',
        SHIPMENT_AGENT_NOT_ASSIGNED: 'No delivery agent has accepted this shipment yet.',
        SHIPMENT_NOT_REASSIGNABLE: 'This shipment can no longer be reassigned.',
        SHIPMENT_REASSIGNMENT_NOT_ALLOWED: 'You cannot reassign this shipment.',
        SHIPMENT_REASSIGN_SAME_AGENT: 'This shipment is already with that delivery agent.',
        SHIPMENT_REASSIGN_REQUIRES_MANUAL_AGENT: 'Choose a delivery agent to reassign this shipment to.',
        SHIPMENT_REASSIGNMENT_CONFLICT: 'This shipment changed while you were reassigning it. Refresh and try again.',
        SHIPMENT_CANCEL_NOT_ALLOWED: 'This shipment can no longer be cancelled.',
        SHIPMENT_CANCEL_CONFLICT: 'This shipment changed while you were cancelling it. Refresh and try again.',
        SHIPMENT_STATUS_CONFLICT: 'This shipment was updated somewhere else. Refresh and try again.',
        SHIPMENT_PROOF_NOT_ALLOWED: 'Proof of delivery can only be added once the delivery is complete.',
        SHIPMENT_PROOF_NOT_FOUND: 'We could not find that proof of delivery.',
        SHIPMENT_PROOF_FILE_REQUIRED: 'Attach a photo as proof of delivery.',

        // ── Configuration / storage ───────────────────────────────────────────
        CONFIG_MISSING_WA_ACCESS_TOKEN: 'WhatsApp is not configured. Contact support.',
        CONFIG_MISSING_WA_PHONE_ID: 'WhatsApp is not configured. Contact support.',
        CONFIG_MISSING_STORAGE_PROVIDER: 'File storage is not configured. Contact support.',
        CONFIG_NOTIFICATION_CATALOG_INCOMPLETE: 'Notification settings are unavailable. Contact support.',
        CONFIG_INVALID_STORAGE_PROVIDER: 'File storage is misconfigured. Contact support.',
        CONFIG_INVALID_GEO_PROVIDER: 'Address search is misconfigured. Contact support.',
        STORAGE_UPLOAD_FAILED: 'The upload failed. Please try again.',
        UPLOAD_POLICY_VIOLATION: "Some files couldn't be uploaded because they don't meet the upload rules.",
        STORAGE_FILE_NOT_FOUND: 'We could not find that file.',
        STORAGE_DELETE_FAILED: 'We could not delete that file. Please try again.',
        STORAGE_QUOTA_EXCEEDED: 'You have used all your storage. Free some space or upgrade your plan.',
        STORAGE_CLEANUP_FAILED: 'We could not clean up those files. Please try again.',

        // ── Addresses & geocoding ─────────────────────────────────────────────
        GEO_PROVIDER_NOT_CONFIGURED: 'Address search is unavailable right now. Enter the address manually.',
        GEO_PROVIDER_UNAVAILABLE: 'Address search is temporarily unavailable. Please try again shortly.',
        GEO_SEARCH_FAILED: 'We could not search for that address. Please try again.',
        ADDRESS_GEO_REQUIRED: 'Pick an address from the search results so we can place it on the map.',
        ADDRESS_COUNTRY_MISMATCH: 'This address is outside your registered country.',
        PROFILE_COUNTRY_IMMUTABLE:
            'Your country was set during onboarding and cannot be changed. Contact support if it needs updating.',

        // ── Vendor profile & onboarding ───────────────────────────────────────
        VENDOR_UNSUPPORTED_FISCAL_CALENDAR: 'That fiscal calendar is not supported.',
        VENDOR_FISCAL_CALENDAR_INVALID: 'That fiscal calendar is not valid.',
        VENDOR_BUSINESS_ADDRESS_IN_USE:
            "This address is a pickup location on one or more products. Reassign those products first.",
        VENDOR_NOTIFICATION_NOT_FOUND: 'We could not find that notification.',
        VENDOR_NOTIFICATION_CHANNEL_NOT_VERIFIED: 'Verify this channel before turning on notifications for it.',
        VENDOR_NOTIFICATION_DELIVERY_FAILED: 'We could not deliver that notification.',
        VENDOR_ONBOARDING_CONCURRENT_MODIFICATION:
            'Your profile was changed in another session. Refresh and try again.',
        VENDOR_ONBOARDING_STEP_INCOMPLETE: 'Finish the current step before moving on.',
        VENDOR_ONBOARDING_STEP_INVALID: 'That setup step is not valid.',
        VENDOR_ONBOARDING_ALREADY_COMPLETED: 'Your setup is already complete.',
        VENDOR_CUSTOMER_NOT_FOUND: 'We could not find that customer.',
        VENDOR_CUSTOMER_FLAG_NOT_FOUND: 'We could not find that customer flag.',
        VENDOR_CUSTOMER_FLAG_DUPLICATE: 'This customer already has that flag.',
        VENDOR_POLICY_DOCUMENT_MISSING: 'Upload the policy document first.',
        VENDOR_POLICY_DOCUMENT_TYPE_INVALID: 'That file type is not accepted for a policy document.',

        // ── Catalog: stock & bulk ─────────────────────────────────────────────
        CATALOG_INSUFFICIENT_STOCK: 'There is not enough stock for that.',
        CATALOG_OVERSALE_NOT_ALLOWED: 'Selling beyond available stock is turned off for this product.',
        CATALOG_INVALID_CSV_FORMAT: "That CSV file isn't in the expected format.",
        CATALOG_INVALID_CSV: "We couldn't read that CSV file. Check the columns and try again.",
        CATALOG_BULK_VALIDATION_FAILED: 'Some rows could not be imported. Fix them and try again.',
        CATALOG_RESERVATION_EXPIRED: 'That stock reservation has expired.',
        CATALOG_TRANSACTION_LIMIT_EXCEEDED: 'That is more than can be processed at once. Split it into smaller batches.',
        CATALOG_BULK_LIMIT_EXCEEDED: 'That is more rows than can be processed at once. Split it into smaller batches.',
        CATALOG_BULK_EMPTY: 'There is nothing to update.',
        CATALOG_BULK_TRANSACTION_LIMIT: 'That is too many changes at once. Split it into smaller batches.',
        CATALOG_BULK_UPDATE_FAILED: 'The bulk update failed. No changes were saved.',

        // ── Catalog: products ─────────────────────────────────────────────────
        CATALOG_PRODUCT_NOT_FOUND: 'We could not find that product.',
        CATALOG_PRODUCT_ACCESS_DENIED: "You don't have access to this product.",
        CATALOG_PRODUCT_INVALID_STATE: "This product's status doesn't allow that.",
        CATALOG_PRODUCT_INVALID_TITLE: 'Enter a valid product title.',
        CATALOG_PRODUCT_NO_DESCRIPTION: 'Add a description before publishing.',
        CATALOG_PRODUCT_ALREADY_PUBLISHED: 'This product is already published.',
        CATALOG_PRODUCT_NO_VARIANTS: 'Add at least one variant before publishing.',
        CATALOG_PRODUCT_NO_DEFAULT_VARIANT: 'Choose a default variant before publishing.',
        CATALOG_PRODUCT_DIGITAL_NO_ASSET: 'Attach the file buyers will download before publishing.',
        CATALOG_PRODUCT_SERVICE_NO_DURATION: 'Set how long this service takes before publishing.',
        CATALOG_PRODUCT_SERVICE_NO_CAPACITY: 'Set how many bookings you can take before publishing.',
        CATALOG_PRODUCT_SERVICE_NO_AVAILABILITY: 'Add availability hours before publishing.',
        CATALOG_PRODUCT_VARIANT_ZERO_PRICE: 'Every variant needs a price above zero before publishing.',
        CATALOG_PRODUCT_NOT_DIGITAL: 'This is not a digital product.',
        CATALOG_PRODUCT_NO_DIGITAL_CONFIG: 'Set up digital delivery for this product first.',
        CATALOG_PRODUCT_NO_DELIVERY_AGENCY: 'Choose a delivery agency for this product before publishing.',
        CATALOG_PRODUCT_NO_PICKUP_LOCATION: 'Choose a pickup location for this product before publishing.',
        CATALOG_PRODUCT_INVALID_PICKUP_LOCATION: 'That pickup location is no longer one of your addresses.',
        CATALOG_PRODUCT_VECTORISATION_PENDING: 'This product is still being indexed for search. Try again shortly.',
        CATALOG_PRODUCT_VECTORISATION_NOT_ELIGIBLE: 'This product cannot be indexed for search.',
        CATALOG_PRODUCT_SIMPLE_MODE_LOCKED:
            'This is a simple product. Convert it to an advanced product to use options and multiple variants.',
        CATALOG_PRODUCT_NOT_SIMPLE_MODE: 'This is an advanced product and cannot be edited as a simple one.',
        CATALOG_PRODUCT_INVALID_TYPE: "That doesn't apply to this type of product.",

        // ── Catalog: variants ─────────────────────────────────────────────────
        CATALOG_VARIANT_NOT_FOUND: 'We could not find that variant.',
        CATALOG_VARIANT_ACCESS_DENIED: "You don't have access to this variant.",
        CATALOG_VARIANT_ARCHIVED: 'This variant is archived.',
        CATALOG_VARIANT_INVALID_STOCK: 'Enter a valid stock quantity.',
        CATALOG_VARIANT_INVALID_PRICE: 'Enter a valid price.',
        CATALOG_VARIANT_COMPARE_PRICE_INVALID: 'The compare-at price has to be higher than the price.',
        CATALOG_VARIANT_LIMIT_EXCEEDED: 'This product has reached its maximum number of variants.',
        CATALOG_VARIANT_NO_OPTIONS: 'Add at least one option before creating variants.',
        CATALOG_VARIANT_OPTION_EMPTY: 'Every option needs at least one value.',
        CATALOG_VARIANT_INSUFFICIENT_STOCK: 'There is not enough stock on that variant.',
        CATALOG_VARIANT_UNSUPPORTED_TYPE: 'That variant type is not supported.',
        CATALOG_VARIANT_NO_DIGITAL_ASSET: 'Attach a file to this digital variant.',
        CATALOG_DIGITAL_VARIANT_LIMIT_EXCEEDED: 'This product has reached its maximum number of digital variants.',
        CATALOG_SERVICE_VARIANT_EXISTS: 'A service can only have one variant.',
        CATALOG_VARIANT_INVALID_QUANTITY: 'Enter a valid quantity.',
        CATALOG_VARIANT_STOCK_ONLY_PHYSICAL: 'Only physical products track stock.',
        CATALOG_VARIANT_RESERVATION_CONFLICT: 'This stock changed while you were editing. Refresh and try again.',
        CATALOG_VARIANT_RESERVATION_NOT_FOUND: 'We could not find that stock reservation.',
        CATALOG_VARIANT_SKU_EXISTS: 'That SKU is already used by another variant.',

        // ── Agency storage: warehoused products & stock requests ──────────────
        // Only the codes a VENDOR endpoint can actually produce. The agency-side
        // depot/suspend codes (INVENTORY_LOCATION_UNKNOWN, _NOT_SUSPENDABLE,
        // _NOT_AGENCY_SUSPENDED, _UNSUSPEND_BLOCKED) live on the agency
        // dashboard; an unmapped code degrades to `errors.status.<n>` anyway.
        INVENTORY_PRODUCT_NOT_STORED_HERE:
            "This product isn't warehoused by a delivery agency, so its stock is edited directly.",
        STOCK_REQUEST_NOT_FOUND: 'We could not find that stock request.',
        STOCK_REQUEST_ALREADY_PENDING: 'A stock request is already open for this variant.',
        STOCK_REQUEST_NOT_PENDING: 'This stock request has already been resolved.',
        STOCK_REQUEST_NOT_YOURS: "You can't take that action on this stock request.",
        STOCK_REQUEST_STALE:
            'This product is no longer warehoused by that agency, so the request no longer applies.',
        STOCK_REQUEST_NO_CHANGE: 'That is already the recorded quantity.',
        CATALOG_PRODUCT_AGENCY_STORAGE_INFINITE_STOCK:
            'A product stored in an agency warehouse needs a countable stock quantity. Turn off unlimited stock on every active variant.',

        // ── Catalog: options ──────────────────────────────────────────────────
        CATALOG_OPTION_NOT_FOUND: 'We could not find that option.',
        CATALOG_OPTION_ACCESS_DENIED: "You don't have access to this option.",
        CATALOG_OPTION_LIMIT_EXCEEDED: 'This product has reached its maximum number of options.',
        CATALOG_OPTION_DUPLICATE_NAME: 'An option with that name already exists on this product.',
        CATALOG_OPTION_REQUIRES_VALUES: 'Add at least one value to this option.',
        CATALOG_OPTION_DUPLICATE_VALUE: 'That value is already on this option.',
        CATALOG_OPTION_VALUES_EXIST: 'Remove this option’s values before deleting it.',
        CATALOG_OPTION_REQUIRES_NO_OPTIONS: 'This product cannot have options.',
        CATALOG_INVALID_OPTION_ID: 'That option reference is not valid.',

        // ── Catalog: files & digital assets ───────────────────────────────────
        CATALOG_DIGITAL_ASSET_ALREADY_EXISTS: 'This variant already has a digital file.',
        CATALOG_DIGITAL_ASSET_MISSING: 'Attach a digital file first.',
        CATALOG_DIGITAL_ASSET_MISSING_FILE: 'Attach a digital file first.',
        CATALOG_DIGITAL_ASSET_NOT_FOUND: 'We could not find that digital file.',
        CATALOG_DIGITAL_ASSET_ACCESS_DENIED: "You don't have access to that digital file.",
        CATALOG_DIGITAL_CONFIG_MISSING: 'Set up digital delivery for this product first.',
        CATALOG_FILE_TOO_LARGE: 'That file is too large.',
        CATALOG_FILE_TYPE_INVALID: 'That file type is not accepted.',
        CATALOG_FILE_NOT_FOUND: 'We could not find that file.',
        CATALOG_FILE_ALREADY_ATTACHED: 'That file is already attached here.',
        CATALOG_FILE_STILL_REFERENCED: 'This file is still used somewhere. Detach it before deleting.',
        CATALOG_IMAGE_LIMIT_EXCEEDED: 'This product has reached its maximum number of images.',
        CATALOG_SHIPPING_NOT_FOUND: 'We could not find those shipping settings.',
        CATALOG_SHIPPING_ACCESS_DENIED: "You don't have access to those shipping settings.",

        // ── Catalog: bookings & services ──────────────────────────────────────
        CATALOG_BOOKING_PRODUCT_NOT_FOUND: 'We could not find that service.',
        CATALOG_BOOKING_INVALID_PRODUCT_TYPE: 'Only services can be booked.',
        CATALOG_BOOKING_MISSING_SERVICE_CONFIG: 'This service is missing its booking settings.',
        CATALOG_BOOKING_PRODUCT_NOT_ACTIVE: 'This service is not active and cannot be booked.',
        CATALOG_BOOKING_INVALID_PRICE: 'That booking price is not valid.',
        CATALOG_BOOKING_NOT_IMPLEMENTED: 'Booking is not available for this service yet.',

        // ── Analytics ─────────────────────────────────────────────────────────
        ANALYTICS_INVALID_DATE_RANGE: 'That date range is not valid. The end date has to come after the start date.',
        ANALYTICS_UNSUPPORTED_TIMEZONE: 'That timezone is not supported for reports.',
        ANALYTICS_AGGREGATION_NOT_READY: "Your figures for this period aren't ready yet. Check back shortly.",
        ANALYTICS_DATE_RANGE_EXCEEDED: 'That date range is too long. Choose a shorter period.',

        // ── Delivery agencies ─────────────────────────────────────────────────
        DELIVERY_AGENCY_NOT_FOUND: 'We could not find that delivery agency.',
        AGENCY_COVERAGE_AREA_INVALID: 'That coverage area is not valid.',
        DELIVERY_AGENT_NOT_FOUND: 'We could not find that delivery agent.',
        DELIVERY_AGENCY_ALREADY_EXISTS: 'That delivery agency already exists.',
        DELIVERY_ONBOARDING_STEP_INVALID: 'That setup step is not valid.',
        DELIVERY_ONBOARDING_STEP_INCOMPLETE: 'Finish the current step before moving on.',
        DELIVERY_ONBOARDING_ALREADY_COMPLETED: 'That setup is already complete.',
        DELIVERY_ONBOARDING_CONCURRENT_MODIFICATION: 'This was changed in another session. Refresh and try again.',
        DELIVERY_POLICY_DOCUMENT_MISSING: 'Upload the policy document first.',
        DELIVERY_POLICY_DOCUMENT_TYPE_INVALID: 'That file type is not accepted for a policy document.',
        DELIVERY_AGENT_ALREADY_IN_AGENCY: 'This agent already belongs to that agency.',
        DELIVERY_AGENT_NOT_IN_AGENCY: 'This agent does not belong to that agency.',
        DELIVERY_AGENT_HAS_ACTIVE_SHIPMENTS: 'This agent still has deliveries in progress.',
        DELIVERY_AGENCY_NOTIFICATION_NOT_FOUND: 'We could not find that notification.',
        DELIVERY_AGENCY_NOTIFICATION_CHANNEL_NOT_VERIFIED: 'Verify this channel before turning on notifications for it.',
        DELIVERY_AGENCY_NOTIFICATION_DELIVERY_FAILED: 'We could not deliver that notification.',
        DELIVERY_AGENT_NOTIFICATION_NOT_FOUND: 'We could not find that notification.',
        DELIVERY_AGENT_NOTIFICATION_CHANNEL_NOT_VERIFIED: 'Verify this channel before turning on notifications for it.',
        DELIVERY_AGENT_NOTIFICATION_DELIVERY_FAILED: 'We could not deliver that notification.',

        // ── Delivery agents ───────────────────────────────────────────────────
        AGENT_NOT_FOUND: 'We could not find that delivery agent.',
        AGENT_NOT_ACTIVE: 'That delivery agent is not active.',
        AGENT_SUSPENDED: 'That delivery agent is suspended.',
        AGENT_ONBOARDING_ALREADY_COMPLETED: 'That setup is already complete.',
        AGENT_MEMBERSHIP_NOT_FOUND: 'We could not find that agency membership.',
        AGENT_MEMBERSHIP_ALREADY_EXISTS: 'That membership already exists.',
        AGENT_MEMBERSHIP_NOT_PENDING: 'That membership request has already been answered.',
        AGENT_MEMBERSHIP_NOT_APPROVED: 'That membership has not been approved.',
        AGENT_MEMBERSHIP_ALREADY_APPROVED: 'That membership is already approved.',
        AGENT_MEMBERSHIP_SUSPENDED: 'That membership is suspended.',
        AGENT_MEMBERSHIP_NOT_SUSPENDED: 'That membership is not suspended.',
        AGENT_MEMBERSHIP_INVALID_TRANSITION: 'That membership cannot change to that state from where it is now.',
        AGENT_MEMBERSHIP_LIMIT_REACHED: 'That agency has reached its maximum number of agents.',
        AGENT_MEMBERSHIP_HAS_ACTIVE_SHIPMENTS: 'This agent still has deliveries in progress.',
        AGENT_TRANSFER_SAME_AGENCY: 'This agent is already with that agency.',
        AGENT_AVAILABILITY_INVALID_TRANSITION: 'That availability change is not allowed right now.',
        AGENT_AT_CAPACITY: 'That delivery agent is at capacity.',
        AGENT_TRACKING_NOT_ALLOWED: 'Location tracking is not enabled for that agent.',
        AGENT_DEVICE_LOCATION_DISABLED: "That agent's device has location turned off.",
        AGENT_DEVICE_STATE_UNKNOWN: "We can't tell that agent's device state right now.",
        AGENT_NOT_ELIGIBLE_FOR_ASSIGNMENT: 'That delivery agent cannot take this shipment.',
        AGENT_COD_THRESHOLD_OUT_OF_BOUNDS: 'That cash-on-delivery limit is outside the allowed range.',
        AGENT_COD_THRESHOLD_BELOW_ALLOCATED: 'That cash-on-delivery limit is below what is already allocated.',
        AGENT_CAPACITY_OUT_OF_BOUNDS: 'That capacity is outside the allowed range.',
        AGENT_CAPACITY_BELOW_IN_USE: 'That capacity is below what is already in use.',
        AGENT_KYC_NOT_VERIFIED: "That agent's identity has not been verified yet.",
        AGENT_PLATFORM_BANNED: 'That agent is banned from the platform.',
        AGENT_PAYOUT_DETAILS_MISSING: 'That agent has no payout details on file.',
        AGENT_SERVICE_TOKEN_INVALID: 'A service connection failed. Please try again.',
        AGENT_SERVICE_TOKEN_NOT_CONFIGURED: 'A service connection is not configured. Contact support.',

        // ── Delivery contracts ────────────────────────────────────────────────
        CONTRACT_NOT_FOUND: 'We could not find that contract.',
        CONTRACT_INVALID_TRANSITION: 'That contract cannot change to that state from where it is now.',
        CONTRACT_HAS_OUTSTANDING_COD: 'There is still cash owed under this contract.',
        CONTRACT_HAS_UNPAID_EARNINGS: 'There are still unpaid earnings under this contract.',
        CONTRACT_TRANSITION_NOT_PERMITTED: "You can't make that change to this contract.",
        CONTRACT_STATUS_REQUEST_NOT_FOUND: 'We could not find that request.',
        CONTRACT_STATUS_REQUEST_NOT_PENDING: 'That request has already been answered.',
        CONTRACT_STATUS_REQUEST_ALREADY_PENDING: 'There is already a request awaiting an answer.',
        CONTRACT_STATUS_REQUEST_NOT_YOURS: 'That request belongs to someone else.',
        CONTRACT_COVERAGE_OUTSIDE_AGENT_RADIUS: "That area is outside the agent's delivery radius.",
        CONTRACT_COVERAGE_REGION_NOT_COVERED: 'That region is not covered by this contract.',
        CONTRACT_SHIPMENT_VALUE_EXCEEDED: "This shipment is worth more than the contract's limit.",
        CONTRACT_FEE_SPLIT_INVALID: 'That fee split is not valid.',
        CONTRACT_TERMS_REQUIRED: 'Contract terms are required.',
        CONTRACT_TERMS_NOT_PROPOSED: 'No terms have been proposed yet.',
        CONTRACT_TERMS_NOT_NEGOTIABLE: 'The terms of this contract are not negotiable.',
        CONTRACT_TERMS_LIVE_EDIT_NOT_ALLOWED: 'An active contract’s terms cannot be edited directly.',
        CONTRACT_TERMS_PROPOSAL_NOT_FOUND: 'We could not find that proposal.',
        CONTRACT_TERMS_PROPOSAL_NOT_PENDING: 'That proposal has already been answered.',
        CONTRACT_TERMS_PROPOSAL_ALREADY_PENDING: 'There is already a proposal awaiting an answer.',
        CONTRACT_TERMS_PROPOSAL_NOT_YOURS: 'That proposal belongs to someone else.',
        CONTRACT_SETTLEMENT_EXCEEDS_OUTSTANDING: 'That is more than the amount still owed.',
        CONTRACT_COD_THRESHOLD_OUT_OF_BOUNDS: 'That cash-on-delivery limit is outside the allowed range.',
        CONTRACT_COD_THRESHOLD_EXCEEDS_HEADROOM: "That cash-on-delivery limit is more than the agent's remaining allowance.",
        CONTRACT_COD_THRESHOLD_BELOW_OUTSTANDING: 'That cash-on-delivery limit is below the cash already owed.',

        // ── Vendor ↔ agency connections ───────────────────────────────────────
        CONNECTION_NOT_FOUND: 'We could not find that connection.',
        CONNECTION_VENDOR_NOT_FOUND: 'We could not find that vendor.',
        CONNECTION_ALREADY_EXISTS: 'You are already connected to this agency.',
        CONNECTION_INVALID_STATUS_TRANSITION: 'This connection cannot change to that state from where it is now.',
        CONNECTION_NOT_PENDING: 'This request has already been answered.',
        CONNECTION_NOT_PAUSED: 'This connection is not paused.',
        CONNECTION_NOT_REQUESTER: 'Only the side that sent the request can do that.',
        CONNECTION_NOT_APPROVER: 'Only the side that received the request can do that.',
        CONNECTION_WRONG_REAPPROVAL_PARTY: 'The other side has to approve this first.',
        CONNECTION_NOT_ACTIVE: 'This connection is not active.',

        // ── Customers ─────────────────────────────────────────────────────────
        CUSTOMER_NOT_FOUND: 'We could not find that customer.',
        CUSTOMER_ADDRESS_NOT_FOUND: 'We could not find that address.',
        CUSTOMER_PAYMENT_METHOD_NOT_FOUND: 'We could not find that payment method.',
        USER_NOT_FOUND: 'We could not find that user.',
        USER_INVALID_PASSWORD: 'That password is incorrect.',

        // ── Store ─────────────────────────────────────────────────────────────
        STORE_NOT_FOUND: 'We could not find your store.',
        STORE_SLUG_TAKEN: 'That store address is already taken. Try another.',
        MAGAZIN_NOT_FOUND: 'We could not find that shop.',
        MAGAZIN_CONFLICT: 'That shop conflicts with an existing one.',

        // ── Cart ──────────────────────────────────────────────────────────────
        CART_VARIANT_REQUIRED: 'Choose a variant first.',
        CART_PRODUCT_NOT_FOUND: 'We could not find that product.',
        CART_SERVICE_PRODUCT_NOT_ALLOWED: 'Services are booked, not added to a cart.',
        CART_VARIANT_NOT_FOUND: 'We could not find that variant.',
        CART_VARIANT_PRODUCT_MISMATCH: 'That variant belongs to a different product.',
        CART_DIGITAL_QUANTITY_MUST_BE_ONE: 'Digital products can only be bought one at a time.',
        CART_MIXED_PRODUCT_TYPES: 'Physical and digital products have to be bought separately.',
        CART_DIGITAL_LIMIT_REACHED: 'That is the maximum number of digital products per order.',
        CART_NOT_FOUND: 'We could not find that cart.',
        CART_EMPTY_CHECKOUT: 'That cart is empty.',

        // ── Bookings ──────────────────────────────────────────────────────────
        BOOKING_PRODUCT_NOT_FOUND: 'We could not find that service.',
        BOOKING_USER_NOT_FOUND: 'We could not find that customer.',
        BOOKING_NOT_FOUND: 'We could not find that booking.',
        BOOKING_UNAUTHORIZED: "You don't have access to this booking.",
        BOOKING_ALREADY_CANCELLED: 'This booking is already cancelled.',
        BOOKING_INVALID_STATUS_TRANSITION: 'This booking cannot move to that status from where it is now.',
        BOOKING_PAYMENT_NOT_REQUIRED: 'This booking does not require a payment.',
        BOOKING_ALREADY_PAID: 'This booking has already been paid.',
        BOOKING_INVALID_PAYMENT_METHOD: 'That payment method cannot be used for this booking.',
        BOOKING_TERMINAL_STATE: 'This booking is finished and can no longer be changed.',
        BOOKING_SLOT_NOT_LOCKED: 'That time slot is no longer held. Pick a slot again.',
        BOOKING_SLOT_LOCKED: 'Someone else is booking that slot right now. Try another.',
        BOOKING_FORBIDDEN: "You don't have permission to do that.",
        BOOKING_INVALID_SLOT_ID: 'That time slot is not valid.',
        BOOKING_NOT_RESCHEDULABLE: 'This booking can no longer be rescheduled.',
        BOOKING_SLOT_FULL: 'That time slot is fully booked. Pick another.',

        // ── Availability rules ────────────────────────────────────────────────
        AVAILABILITY_PRODUCT_NOT_FOUND: 'We could not find that service.',
        AVAILABILITY_RULE_NOT_FOUND: 'We could not find that availability rule.',
        AVAILABILITY_INVALID_PRODUCT_TYPE: 'Only services have availability hours.',
        AVAILABILITY_INVALID_TIME_RANGE: 'The end time has to come after the start time.',
        AVAILABILITY_TIME_OVERLAP: 'That overlaps with another availability rule.',
        AVAILABILITY_FORBIDDEN: "You don't have permission to change this availability.",

        // ── Admin ─────────────────────────────────────────────────────────────
        ADMIN_NOT_FOUND: 'We could not find that administrator.',
        ADMIN_FORBIDDEN: "You don't have permission to do that.",

        // ── Billing: plans & credits ──────────────────────────────────────────
        BILLING_PLAN_NOT_FOUND: 'We could not find that plan.',
        BILLING_PLAN_INACTIVE: 'That plan is no longer available.',
        BILLING_PLAN_ROLE_MISMATCH: 'That plan is not available for a vendor account.',
        BILLING_PLAN_CODE_EXISTS: 'That plan code is already in use.',
        BILLING_PENDING_PLAN_EXISTS: 'You already have a plan change waiting to be processed.',
        BILLING_INSUFFICIENT_CREDITS: 'You do not have enough credits. Top up and try again.',
        BILLING_LIMIT_EXCEEDED: 'You have reached your plan limit. Upgrade to continue.',
        BILLING_WALLET_CONFLICT: 'Your wallet changed while we were processing this. Please try again.',
        BILLING_TOPUP_NOT_FOUND: 'We could not find that top-up.',
        BILLING_TOPUP_PACK_NOT_FOUND: 'We could not find that credit pack.',
        BILLING_TOPUP_INVALID_STATE: "That top-up's status doesn't allow this.",
        BILLING_PLAN_PURCHASE_NOT_FOUND: 'We could not find that purchase.',
        BILLING_PLAN_NOT_PURCHASABLE: 'That plan cannot be purchased right now.',
        BILLING_PURCHASE_INVALID_STATE: "That purchase's status doesn't allow this.",

        // ── Earnings & payouts ────────────────────────────────────────────────
        EARNINGS_INVALID_SPLIT: 'That earnings split is not valid.',
        EARNINGS_ALLOCATION_NOT_FOUND: 'We could not find that earnings record.',
        EARNINGS_ALREADY_COMPLETED: 'Those earnings have already been settled.',
        EARNINGS_ORDER_NOT_CONFIRMABLE: 'This order cannot be confirmed yet.',
        EARNINGS_FORBIDDEN: "You don't have permission to do that.",
        EARNINGS_PAYOUT_ALREADY_PENDING: 'You already have a withdrawal being processed.',
        EARNINGS_PAYOUT_METHOD_MISSING: 'Add your payout details before requesting a withdrawal.',
        EARNINGS_PAYOUT_NO_AVAILABLE_BALANCE: 'You have no available balance to withdraw.',
        EARNINGS_PAYOUT_BELOW_MINIMUM: 'Your available balance is below the minimum for a withdrawal.',
        EARNINGS_PAYOUT_REQUEST_NOT_FOUND: 'We could not find that withdrawal request.',
        EARNINGS_PAYOUT_REQUEST_NOT_PENDING: 'That withdrawal has already been processed.',

        // ── Cash on delivery ──────────────────────────────────────────────────
        COD_NOT_AVAILABLE_FOR_DIGITAL: 'Cash on delivery is not available for digital products.',
        COD_AGENCY_NOT_SUPPORTED: 'That delivery agency does not handle cash on delivery.',
        COD_ORDER_AMOUNT_EXCEEDS_LIMIT: 'This order is worth more than the cash-on-delivery limit.',
        COD_COLLECTION_NOT_FOUND: 'We could not find that cash collection.',
        COD_COLLECTION_ALREADY_COLLECTED: 'That cash has already been collected.',
        COD_COLLECTION_NOT_COLLECTIBLE: 'That cash cannot be collected yet.',
        COD_INVALID_CODE: 'That confirmation code is incorrect.',
        COD_CODE_ATTEMPTS_EXCEEDED: 'Too many incorrect codes. Request a new one.',
        COD_CODE_RESEND_TOO_SOON: 'Please wait a moment before requesting another code.',
        COD_AGENT_NOT_ASSIGNED: 'No delivery agent is assigned to collect this.',
        COD_AGENT_EXPOSURE_EXCEEDED: 'That agent is already holding the maximum amount of cash.',
        COD_AGENT_TRUST_TOO_LOW: 'That agent is not cleared to carry this much cash.',
        COD_AGENT_HAS_OUTSTANDING_CASH: 'That agent still has cash to hand in.',
        COD_DEPOSIT_INVALID_AMOUNT: 'Enter a valid deposit amount.',
        COD_DEPOSIT_EXCEEDS_BALANCE: 'That is more than the cash on hand.',
        COD_DEPOSIT_NOT_FOUND: 'We could not find that deposit.',
        COD_DEPOSIT_ALREADY_RESOLVED: 'That deposit has already been settled.',
        COD_DEPOSIT_REFERENCE_REQUIRED: 'A deposit reference is required.',
        COD_DEPOSIT_AGENCY_ALREADY_SETTLED: 'The agency has already remitted that cash.',
        COD_DEPOSIT_WRONG_RECIPIENT: 'That deposit was sent to the wrong recipient.',
        COD_REMITTANCE_INVALID_AMOUNT: 'Enter a valid remittance amount.',
        COD_REMITTANCE_EXCEEDS_LIABILITY: 'That is more than the amount owed.',
        COD_REMITTANCE_NOT_FOUND: 'We could not find that remittance.',
        COD_REMITTANCE_ALREADY_RESOLVED: 'That remittance has already been settled.',
        COD_DISCREPANCY_NOT_FOUND: 'We could not find that discrepancy.',
        COD_DISCREPANCY_ALREADY_RESOLVED: 'That discrepancy has already been resolved.',

        // ── Router / global handler fallbacks ─────────────────────────────────
        INTERNAL_SERVER_ERROR: 'A server error occurred. Please try again in a moment.',
        NOT_FOUND: "We couldn't find what you were looking for.",
        VALIDATION_ERROR: "Some of the information isn't valid. Please check the highlighted fields.",

        // ── Client-side codes raised by this app ──────────────────────────────
        REFRESH_FAILED: 'Your session has expired. Please sign in again.',
        INIT_FAILED: 'We could not load your session. Please refresh the page.',
        SUBMIT_FAILED: 'We could not save that step. Please try again.',
        UPDATE_FAILED: 'We could not save your changes. Please try again.',
    },
} as const;

export default errors;
