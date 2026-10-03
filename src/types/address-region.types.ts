// `400 ADDRESS_REGION_INVALID` on a business-address save — api-doc/vendor/
// FRONTEND-CHANGELOG-delivery-region-and-force.md and errors/README.md
// § Delivery regions and forced pushes (2026-10-02).
//
// A new or edited `business_addresses[]` entry named no region of the vendor's
// country, neither by `geo.components.region` nor by its city. The fix is to
// set that entry's `geo.components.region` to one of `allowedRegions[].key`
// and resend the whole list.

import { ApiError } from '@/types/api';

export const ADDRESS_REGION_INVALID = 'ADDRESS_REGION_INVALID';

/** One region the country accepts. `name` is per language; only `en`/`fr` are documented. */
export interface AllowedRegion {
  /** What goes back in `geo.components.region` — e.g. `"centre"`. */
  key: string;
  name: Partial<Record<string, string>>;
}

/** `error.details` of `ADDRESS_REGION_INVALID`, as raised for a vendor address list. */
export interface AddressRegionInvalidDetails {
  /** Position in the `business_addresses` array that was SENT. */
  index: number | null;
  label: string | null;
  region: string | null;
  city: string | null;
  countryCode: string | null;
  allowedRegions: AllowedRegion[];
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** Read the error defensively; `null` when it isn't this code or `allowedRegions` is unusable. */
export function readAddressRegionInvalid(err: unknown): AddressRegionInvalidDetails | null {
  if (!(err instanceof ApiError) || err.code !== ADDRESS_REGION_INVALID) return null;
  const raw = err.detailsObject;
  if (!raw || !Array.isArray(raw.allowedRegions)) return null;

  const allowedRegions = raw.allowedRegions.flatMap((r): AllowedRegion[] => {
    if (!r || typeof r !== 'object') return [];
    const { key, name } = r as { key?: unknown; name?: unknown };
    if (typeof key !== 'string' || !key) return [];
    const names: Partial<Record<string, string>> = {};
    if (name && typeof name === 'object') {
      for (const [lang, text] of Object.entries(name)) if (typeof text === 'string') names[lang] = text;
    }
    return [{ key, name: names }];
  });
  if (allowedRegions.length === 0) return null;

  return {
    index: typeof raw.index === 'number' && Number.isInteger(raw.index) ? raw.index : null,
    label: str(raw.label),
    region: str(raw.region),
    city: str(raw.city),
    countryCode: str(raw.countryCode),
    allowedRegions,
  };
}

/** The region's name in `locale`, else English, else its key. */
export function allowedRegionName(region: AllowedRegion, locale: string): string {
  return region.name[locale] ?? region.name.en ?? region.key;
}
