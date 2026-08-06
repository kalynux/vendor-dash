import { plural } from '../../types';

/** Delivery agencies: your connections, and browsing for new ones. */
export const agency = {
    title: 'Agency',
    subtitle: 'The delivery agencies that carry your orders',

    tabs: {
        connections: 'Connection',
        browse: 'Browse',
    },

    /** One line per Agency sub-route — see `account.tabSubtitles`. */
    tabSubtitles: {
        connections: 'The delivery agencies you work with, and which one is your default',
        browse: 'Find delivery agencies to connect with',
    },

    page: {
        currentDefault: 'Current default',
        noDefault:
            'No delivery agency set. Your first approved connection automatically becomes your ' +
            'default — service-only vendors can leave this empty.',
        connectionsTitle: 'Your connections',
        connectionsHint:
            'Your first active connection becomes the default automatically — switch it at any ' +
            'time with "Set as default" below.',
        browseTitle: 'Search agencies & request a connection',
    },

    connections: {
        searchPlaceholder: 'Search connections…',
        filterTitle: 'Filter connections',
        loading: 'Loading connections…',
        emptyCategory: 'No connections in this category yet.',
        notePlaceholder: 'Note (optional)',
        reasonPlaceholder: 'Reason (optional)',
        awaitingAgency: 'Awaiting agency',
        chipHistory: 'History',
        statusChip: 'Status: {{value}}',
        applyLabel: 'Show connections',
        /** Falls back to the last 6 characters of the id when the name is unknown. */
        unnamedAgency: 'Agency {{ref}}',

        actions: {
            default: 'Default',
            setAsDefault: 'Set as default',
            terminate: 'Terminate',
            confirmTerminate: 'Confirm terminate',
            reject: 'Reject',
            confirmReject: 'Confirm reject',
            withdraw: 'Withdraw',
            approve: 'Approve',
            reapprove: 'Reapprove',
            requestAgain: 'Request again',
        },
    },

    status: {
        pending: 'Pending',
        active: 'Active',
        paused: 'Paused',
        rejected: 'Rejected',
        disconnected: 'Disconnected',
        withdrawn: 'Withdrawn',
        terminated: 'Terminated',
        reapprovalNeeded: 'Reapproval needed',
        awaitingTheirApproval: 'Awaiting their approval',
        awaitingYourApproval: 'Awaiting your approval',
    },

    browse: {
        title: 'Browse agencies',
        description: 'Find a delivery agency that covers the areas you sell to.',
        searchPlaceholder: 'Search agencies…',
        filterTitle: 'Filter agencies',
        clearAllFilters: 'Clear all filters',
        rejectTitle: 'Reject this request?',
        reasonPlaceholder: 'Reason (optional)',
        awaitingAgency: 'Awaiting agency',
        empty: 'No agencies match your search.',
        request: 'Request connection',
        requested: 'Request sent',
        connected: 'Connected',
        applyLabel: 'Show agencies',
        emptyFiltered: 'No agencies match your search or filters.',
        emptyNone: 'No delivery agencies are available in your area yet.',
        viewDetailsFor: 'View details for {{name}}',
    },

    /** The browse-tab filter sheet. */
    filters: {
        location: 'Location',
        region: 'Region',
        regionPlaceholder: 'e.g. Littoral',
        city: 'City',
        cityPlaceholder: 'e.g. Douala',
        capabilities: 'Capabilities',
        returnsPayer: 'Returns paid by',
        anyPayer: 'Any',
        claimWindow: 'Claim window',
        minClaimDays: 'Minimum days to claim',
        claimDaysPlaceholder: 'e.g. 7',
    },

    /** Short payer names for the filter chips, where the section title gives context. */
    payerShort: {
        vendor: 'Vendor',
        agency: 'Agency',
        customer: 'Customer',
    },

    detail: {
        kycVerified: 'KYC Verified',
        unverified: 'Unverified',
        headquarters: 'Headquarters',
        coverageAreas: 'Coverage Areas',
        pricing: 'Pricing',
        storageBased: 'Storage-based',
        pickupBased: 'Pickup-based',
        available: 'Available',
        notAvailable: 'Not available',
        returns: 'Returns',
        costPaidBy: 'Cost paid by',
        returnWindow: 'Return window',
        noReturns: 'No returns accepted',
        returnWindowDays: '{{count}} days after delivery',
        damageClaims: 'Damage Claims',
        claimDeadline: 'Claim deadline',
        claimDeadlineDays: '{{count}} days after delivery',
        maxRefundPerItem: 'Max refund per item',
        coverage: 'Coverage',
        contact: 'Contact',
        policies: 'Policies',
        rates: 'Rates',
        supportsCod: 'Cash on delivery',
        noCoverage: 'No coverage areas listed.',
    },

    /** Who bears the cost of a return, per the agency's published policy. */
    returnsPayer: {
        vendor: 'Vendor bears cost',
        agency: 'Agency bears cost',
        customer: 'Customer bears cost',
    },

    /** Reassigning an order item to a different agency. */
    reassign: {
        trigger: 'Reassign',
        title: 'Move to a different agency',
        loading: 'Loading agencies…',
        placeholder: 'Select an agency',
        updated: 'Delivery agency updated',
        declinedTitle: 'Shipment declined by agency',
        declinedHint: 'Reassign this item to another agency to continue.',
        declinedReason: 'Reason:',
        declinedNote: 'Note:',
        declinedOn: 'Declined on {{date}}',
    },

    /** Agency rejection reasons (orders.md → `delivery.rejection`). */
    rejectionReason: {
        out_of_coverage_area: 'Out of coverage area',
        capacity_exceeded: 'Agency capacity exceeded',
        invalid_address: 'Invalid delivery address',
        vendor_item_not_ready: 'Item not ready for pickup',
        other: 'Other reason',
        unknown: 'Rejected by agency',
    },

    toast: {
        requestSent: 'Connection request sent',
        connected: 'Connected to {{name}}',
        disconnected: 'Disconnected from {{name}}',
        paused: 'Connection paused',
        resumed: 'Connection resumed',
        defaultSet: 'Default delivery agency updated',
        itemsReassigned: plural({
            one: '{{count}} order item was reassigned to the new agency',
            other: '{{count}} order items were reassigned to the new agency',
        }),
    },

    errors: {
        loadFailed: "We couldn't load delivery agencies. Please try again.",
        loadConnectionsFailed: "We couldn't load your connections. Please try again.",
        requestFailed: "We couldn't send the connection request. Please try again.",
        updateFailed: "We couldn't update this connection. Please try again.",
    },
} as const;

export default agency;
