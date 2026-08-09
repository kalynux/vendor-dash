import { useState } from 'react';
import { AlertCircle, Pencil, Plus, Star, Trash2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PaymentBrandLogo } from '@/components/payment-methods';
import { useTranslation } from '@/i18n';
import type { PayoutDetailsFormValues } from '@/onboarding/schemas/onboarding.schemas';
import { PayoutMethodDialog } from './PayoutMethodDialog';
import {
    isPayoutEntryComplete,
    payoutEntryBrand,
    payoutEntryDetail,
    payoutEntryTitle,
} from './payoutEntry.helpers';

/** Backend cap on `payout_details` (see api-doc/vendor/onboarding.md). */
const MAX_METHODS = 3;

export interface PayoutMethodsEditorProps {
    /** The ordered payout array — index 0 is the preferred method. */
    value: PayoutDetailsFormValues[];
    onChange: (next: PayoutDetailsFormValues[]) => void;
    /** ISO-3166 alpha-2 seeding the dialog's phone field. */
    country?: string | null;
}

/**
 * The payout destinations, as a list of saved methods plus one dialog — the same
 * shape Billing → Payment methods uses, so "how I pay" and "how I get paid" are
 * read and edited the same way.
 *
 * Purely local: it edits the array it is handed and lets the surrounding form
 * decide when that reaches the API (`payout_details` is a full replace, so a
 * per-row write would be a lie).
 */
export function PayoutMethodsEditor({ value, onChange, country }: PayoutMethodsEditorProps) {
    const { t } = useTranslation();
    const [dialogOpen, setDialogOpen] = useState(false);
    /** Index being edited, or `null` while adding. */
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [removeIndex, setRemoveIndex] = useState<number | null>(null);
    // Bumped on every open so the dialog remounts against the row it was opened
    // for. Closing leaves it alone, which is what lets the sheet animate out.
    const [dialogSession, setDialogSession] = useState(0);

    const atLimit = value.length >= MAX_METHODS;
    const editing = editIndex === null ? null : (value[editIndex] ?? null);
    const removeTarget = removeIndex === null ? null : (value[removeIndex] ?? null);

    function openAdd() {
        setEditIndex(null);
        setDialogSession((n) => n + 1);
        setDialogOpen(true);
    }

    function openEdit(index: number) {
        setEditIndex(index);
        setDialogSession((n) => n + 1);
        setDialogOpen(true);
    }

    function handleSave(entry: PayoutDetailsFormValues, makePreferred: boolean) {
        const next = [...value];
        if (editIndex === null) {
            if (makePreferred) next.unshift(entry);
            else next.push(entry);
        } else {
            next[editIndex] = entry;
            if (makePreferred && editIndex > 0) {
                next.splice(editIndex, 1);
                next.unshift(entry);
            }
        }
        onChange(next);
    }

    function promote(index: number) {
        const next = [...value];
        const [entry] = next.splice(index, 1);
        next.unshift(entry);
        onChange(next);
    }

    function confirmRemove() {
        if (removeIndex === null) return;
        onChange(value.filter((_, i) => i !== removeIndex));
        setRemoveIndex(null);
    }

    return (
        <div className="space-y-3">
            {value.length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                    {t('settings.payout.empty')}
                </p>
            ) : (
                <ul className="divide-y">
                    {value.map((entry, index) => {
                        const isPreferred = index === 0;
                        const complete = isPayoutEntryComplete(entry);
                        const label = payoutEntryTitle(entry, t);
                        const detail = payoutEntryDetail(entry);
                        return (
                            <li
                                key={index}
                                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                            >
                                {/* The provider is spelled out in the row next to it. */}
                                <PaymentBrandLogo
                                    brand={payoutEntryBrand(entry)}
                                    size="md"
                                    decorative
                                />
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <span className="truncate font-medium">{label}</span>
                                        {isPreferred && (
                                            <Badge variant="secondary">
                                                {t('settings.payout.preferred')}
                                            </Badge>
                                        )}
                                        {!complete && (
                                            <Badge
                                                variant="destructive"
                                                className="gap-1"
                                                title={t('settings.payout.incompleteHint')}
                                            >
                                                <AlertCircle className="size-3" />
                                                {t('settings.payout.incomplete')}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="truncate text-xs text-muted-foreground">
                                        {detail || t('settings.payout.incompleteHint')}
                                    </p>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                    {!isPreferred && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="gap-1"
                                            onClick={() => promote(index)}
                                            aria-label={t('settings.payout.setPreferredAria', {
                                                label,
                                            })}
                                        >
                                            <Star className="size-4" />
                                            <span className="hidden sm:inline">
                                                {t('settings.payout.setPreferred')}
                                            </span>
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => openEdit(index)}
                                        aria-label={t('settings.payout.editAria', { label })}
                                    >
                                        <Pencil className="size-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="text-muted-foreground hover:text-destructive"
                                        // The schema demands at least one method, so the
                                        // last row stays put rather than failing on save.
                                        disabled={value.length <= 1}
                                        title={
                                            value.length <= 1
                                                ? t('settings.payout.keepOne')
                                                : undefined
                                        }
                                        onClick={() => setRemoveIndex(index)}
                                        aria-label={t('settings.payout.removeAria', { label })}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            <Button
                type="button"
                variant="outline"
                onClick={openAdd}
                disabled={atLimit}
                title={atLimit ? t('settings.payout.atLimit', { max: MAX_METHODS }) : undefined}
                className="w-full gap-1.5 border-dashed"
            >
                <Plus className="size-4" />
                {t('settings.payout.addMethod')}
            </Button>

            <PayoutMethodDialog
                key={dialogSession}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                entry={editing}
                country={country}
                // The switch would be a no-op for the first method ever added, and
                // for the one already sitting at the front of the list.
                forcePreferred={value.length === 0 || editIndex === 0}
                onSave={handleSave}
            />

            <AlertDialog
                open={removeIndex !== null}
                onOpenChange={(open) => !open && setRemoveIndex(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t('settings.payout.removeTitle')}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t('settings.payout.removeDescription', {
                                label: removeTarget ? payoutEntryTitle(removeTarget, t) : '',
                            })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t('common.actions.cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmRemove}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {t('common.actions.remove')}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
