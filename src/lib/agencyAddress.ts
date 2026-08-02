// ─── Delivery-agency HQ address formatting ────────────────────────────────────
// `region` and `city` are derived from the entry's geocode and are BOTH nullable
// (rural / landmark addresses resolve neither). `address_description` is always
// present — see api-doc/vendor/delivery-agencies.md.

interface HQAddressLike {
  region?: string | null;
  city?: string | null;
  address_description: string;
}

/**
 * One-line locality label for an agency HQ: `"Douala, Littoral"`, or whichever
 * half resolved. Falls back to `address_description` when the geocode yielded
 * neither, so the line is never empty or a stray comma.
 */
export function formatAgencyLocality(hq: HQAddressLike): string {
  const parts = [hq.city, hq.region].filter((p): p is string => !!p && p.trim() !== '');
  return parts.length > 0 ? parts.join(', ') : hq.address_description;
}

/**
 * Secondary detail line — the full street address, suppressed when
 * `formatAgencyLocality` already fell back to it.
 */
export function formatAgencyAddressDetail(hq: HQAddressLike): string | null {
  const locality = formatAgencyLocality(hq);
  return locality === hq.address_description ? null : hq.address_description;
}
