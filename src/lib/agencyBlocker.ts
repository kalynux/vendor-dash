// `CATALOG_PRODUCT_NO_DELIVERY_AGENCY` — one code for several different delivery
// agency problems. Since 2026-10-18 the publish checklist (a `meta.activation`
// blocker, or the 422 from `PATCH /products/:id/status` → active) carries
// `details: { reason, scope, agencyId?, agencyName? }` saying which one.
// See api-doc/vendor/FRONTEND-CHANGELOG-connection-activation.md.
//
// Branch on `details` only, never on the message: the message is English-only
// and worded for reading, not matching — it is shown only for a reason this app
// has no wording for. A missing `details` — the `PATCH /products/:id`
// pickup-location refusal, or a backend build before that date — means "set a
// delivery agency first".

import type { TranslateParams, TranslationKey } from '@/i18n';
import { ApiError } from '@/types/api';
import type { ProductMode } from '@/types/product.types';

export const NO_DELIVERY_AGENCY_CODE = 'CATALOG_PRODUCT_NO_DELIVERY_AGENCY';

/** Agency → Connections: the "Set as default" button and every connection. */
export const DEFAULT_AGENCY_SETTING_PATH = '/dashboard/agency/connections';

export type AgencyBlockerReason =
  | 'no_default_agency'
  | 'agency_pending_activation'
  | 'agency_inactive'
  | 'agency_not_found'
  | 'connection_not_active';

/** `default` = the vendor's default agency; `product` = this product's own one. */
export type AgencyBlockerScope = 'default' | 'product';

export interface AgencyBlockerDetails {
  reason: AgencyBlockerReason;
  scope: AgencyBlockerScope;
  agencyId?: string;
  agencyName: string | null;
}

const REASONS: readonly string[] = [
  'no_default_agency',
  'agency_pending_activation',
  'agency_inactive',
  'agency_not_found',
  'connection_not_active',
] satisfies AgencyBlockerReason[];

/** `null` when absent or a reason this app doesn't know — both read as "set an agency first". */
export function readAgencyBlockerDetails(details: unknown): AgencyBlockerDetails | null {
  if (!details || typeof details !== 'object') return null;
  const { reason, scope, agencyId, agencyName } = details as Record<string, unknown>;
  if (typeof reason !== 'string' || !REASONS.includes(reason)) return null;
  return {
    reason: reason as AgencyBlockerReason,
    scope: scope === 'product' ? 'product' : 'default',
    ...(typeof agencyId === 'string' ? { agencyId } : {}),
    agencyName: typeof agencyName === 'string' && agencyName.trim() ? agencyName.trim() : null,
  };
}

const MESSAGE_KEYS: Record<AgencyBlockerReason, Record<AgencyBlockerScope, TranslationKey>> = {
  // Only ever `default` — a product's own agency is a choice, not a gap.
  no_default_agency: {
    default: 'agency.publishBlocker.noDefault',
    product: 'agency.publishBlocker.noDefault',
  },
  agency_pending_activation: {
    default: 'agency.publishBlocker.pendingDefault',
    product: 'agency.publishBlocker.pendingProduct',
  },
  agency_inactive: {
    default: 'agency.publishBlocker.inactiveDefault',
    product: 'agency.publishBlocker.inactiveProduct',
  },
  agency_not_found: {
    default: 'agency.publishBlocker.notFoundDefault',
    product: 'agency.publishBlocker.notFoundProduct',
  },
  connection_not_active: {
    default: 'agency.publishBlocker.connectionDefault',
    product: 'agency.publishBlocker.connectionProduct',
  },
};

/**
 * Our own sentence for the blocker, in the vendor's language. It says what the
 * server's message says — which agency, and why — but the server writes that
 * one in English only.
 */
export function agencyBlockerMessage(details: AgencyBlockerDetails | null): {
  key: TranslationKey;
  params?: TranslateParams;
} {
  if (!details) return { key: 'errors.codes.CATALOG_PRODUCT_NO_DELIVERY_AGENCY' };
  return {
    key: MESSAGE_KEYS[details.reason][details.scope],
    // Bracketed after the noun so the sentence reads the same with or without it.
    params: { agency: details.agencyName ? ` (${details.agencyName})` : '' },
  };
}

/** A `reason` is present but this app has no wording for it (added server-side later). */
function hasUnknownReason(details: unknown): boolean {
  if (!details || typeof details !== 'object') return false;
  const { reason } = details as Record<string, unknown>;
  return typeof reason === 'string' && !REASONS.includes(reason);
}

type Translate = (key: TranslationKey, params?: TranslateParams) => string;

/**
 * The line to show for this blocker: our own sentence for every reason we know.
 * Only a reason we don't know falls back to the server's text — it is English,
 * but it is the one thing that says what is actually wrong. No `details` at all
 * is not "unknown": the docs define it as "set a delivery agency first".
 */
export function agencyBlockerText(t: Translate, details: unknown, serverMessage?: string): string {
  if (hasUnknownReason(details) && serverMessage?.trim()) return serverMessage.trim();
  const { key, params } = agencyBlockerMessage(readAgencyBlockerDetails(details));
  return t(key, params);
}

/** The same line straight from a refused Publish; `null` for any other error. */
export function agencyBlockerTextFromError(err: unknown, t: Translate): string | null {
  if (!(err instanceof ApiError) || err.code !== NO_DELIVERY_AGENCY_CODE) return null;
  return agencyBlockerText(t, err.detailsObject, err.message);
}

export interface AgencyBlockerRemedy {
  labelKey: TranslationKey;
  /**
   * `agencySettings` → the Connections tab (default agency, every connection).
   * `productAgency` → this product's own delivery section.
   */
  target: 'agencySettings' | 'productAgency';
}

export function agencyBlockerRemedy(details: AgencyBlockerDetails | null): AgencyBlockerRemedy {
  if (!details) {
    return { labelKey: 'agency.publishBlocker.actions.chooseAgency', target: 'productAgency' };
  }
  switch (details.reason) {
    case 'no_default_agency':
      return { labelKey: 'agency.publishBlocker.actions.chooseDefault', target: 'agencySettings' };
    case 'connection_not_active':
      return { labelKey: 'agency.publishBlocker.actions.openConnection', target: 'agencySettings' };
    // Waiting is fine for a pending agency too — the sentence says so — but a
    // vendor who would rather not wait gets the same way out.
    case 'agency_pending_activation':
    case 'agency_inactive':
    case 'agency_not_found':
      return {
        labelKey: 'agency.publishBlocker.actions.chooseAnother',
        target: details.scope === 'product' ? 'productAgency' : 'agencySettings',
      };
  }
}

/** Where a product's own delivery agency is set, from outside its editor. */
export function productEditorPath(product: { id: string; mode?: ProductMode }): string {
  return product.mode === 'simple'
    ? `/dashboard/product-edit/${product.id}/simple`
    : `/dashboard/product-edit/${product.id}`;
}
