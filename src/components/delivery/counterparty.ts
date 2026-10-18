import type { ConnectionDto } from '@/types/agency-connection.types';

/**
 * The agency's name on a connection row: its shop (Magazin) name, else its
 * display name. `null` when it has neither — the caller says "Agency" then.
 */
export function counterpartyName(connection: ConnectionDto): string | null {
    const profile = connection.counterpartyProfile;
    return profile?.businessName.trim() || profile?.displayName?.trim() || null;
}
