import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { fileRefUrl } from '@/services/files.service';
import { useTranslation } from '@/i18n';
import type { ConnectionDto } from '@/types/agency-connection.types';

function initialsOf(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
}

/** The agency's logo on a connection row, or its initials when it has none. */
export function CounterpartyLogo({ connection, name }: { connection: ConnectionDto; name: string }) {
    const logoUrl = fileRefUrl(connection.counterpartyProfile?.logo);
    return (
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
            {logoUrl ? (
                <img src={logoUrl} alt={name} className="h-full w-full object-cover" />
            ) : (
                <span aria-hidden="true">{initialsOf(name)}</span>
            )}
        </div>
    );
}

/**
 * The agency's own account state, beside the connection's. Nothing for an
 * active agency, and nothing for `null` (record gone) or `undefined` (a backend
 * build that predates the field) — the row already says enough there.
 */
export function CounterpartyStatusBadge({
    status,
    className,
}: {
    status: ConnectionDto['counterpartyStatus'];
    className?: string;
}) {
    const { t } = useTranslation();
    if (status === 'pending_verification') {
        return (
            <Badge
                variant="secondary"
                className={cn(
                    'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-950 dark:border-amber-800',
                    className,
                )}
            >
                {t('agency.counterparty.notActiveYet')}
            </Badge>
        );
    }
    if (status === 'inactive') {
        return (
            <Badge variant="secondary" className={cn('text-muted-foreground bg-muted border-border', className)}>
                {t('agency.counterparty.inactive')}
            </Badge>
        );
    }
    return null;
}

/**
 * Shown wherever Approve is offered on a request from an agency that has not
 * finished activating. A warning, not a gate: approving stays allowed.
 */
export function PendingAgencyApproveNote({
    status,
    className,
}: {
    status: ConnectionDto['counterpartyStatus'];
    className?: string;
}) {
    const { t } = useTranslation();
    if (status !== 'pending_verification') return null;
    return (
        <p className={cn('text-xs text-amber-700 dark:text-amber-400', className)}>
            {t('agency.counterparty.approveWarning')}
        </p>
    );
}
