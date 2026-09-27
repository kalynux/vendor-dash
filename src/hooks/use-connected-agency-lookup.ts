import { useEffect, useState } from 'react';
import { getActiveConnectedAgencies } from '@/services/agency-connections.service';

export interface ConnectedAgencyIdentity {
  name: string;
  /** Admin has verified the agency's business documents. */
  verified: boolean;
}

/**
 * Names (and verified status) for records that carry a bare `agencyId` —
 * storage invoices, stock requests. Resolved from the vendor's *active*
 * connections, fetched once whenever an id on screen is not yet known.
 *
 * Best-effort by design: a record outlives the connection that produced it, so
 * an id can stay unresolved. Callers fall back to a neutral label, never to the
 * raw id, and never toast — the list itself loaded fine.
 */
export function useConnectedAgencyLookup(agencyIds: readonly string[]) {
  const [lookup, setLookup] = useState<Record<string, ConnectedAgencyIdentity>>({});
  const idsKey = [...new Set(agencyIds)].sort().join(',');

  useEffect(() => {
    if (!idsKey) return;
    if (idsKey.split(',').every((id) => lookup[id])) return;
    let cancelled = false;
    getActiveConnectedAgencies()
      .then(({ agencies }) => {
        if (cancelled) return;
        setLookup((prev) => {
          const next = { ...prev };
          for (const agency of agencies) {
            next[agency.id] = { name: agency.agencyName, verified: agency.kycVerified === true };
          }
          return next;
        });
      })
      .catch(() => {
        // Degrades to the caller's neutral label.
      });
    return () => {
      cancelled = true;
    };
    // `lookup` is read only to skip a fetch that would add nothing; re-running
    // when it changes would refetch after every successful resolve.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  return lookup;
}
