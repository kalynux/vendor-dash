import { Loader2, Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';
import { useKeyboardOpen } from '@/platform/shell/keyboard';

interface UnsavedChangesBarProps {
    /** Show the bar (typically `dirty || saving`). */
    visible: boolean;
    /** Disables both buttons and swaps the Save icon for a spinner. */
    saving: boolean;
    onDiscard: () => void;
    /** Click handler for Save. Ignored when `formId` is provided. */
    onSave?: () => void;
    /** When set, Save is a submit button for that form (react-hook-form flows). */
    formId?: string;
    /** Blocks Save only (e.g. a field is invalid); Discard stays usable. */
    saveDisabled?: boolean;
}

/**
 * Floating "Unsaved changes" pill pinned to the bottom of the viewport, with
 * Discard / Save actions. One instance per settings tab — the tab tracks its
 * own dirty state and performs a single API call on save.
 *
 * On mobile it has to clear the tab bar (4rem) *and* the FAB that pops 1.5rem
 * above it, hence the offset; it also stretches to the full width there so the
 * label truncates instead of the buttons being clipped off the pill.
 *
 * While the on-screen keyboard is up that whole allowance is wrong: the tab bar
 * hides itself (CAPACITOR-PLAN.md → P3.2), so the pill would float in mid-screen
 * over nothing. The offset collapses with it, which also puts Save directly
 * above the keyboard — on a settings form the field being edited is the reason
 * the bar appeared at all. `useKeyboardOpen()` is hardwired to false on the web.
 */
export function UnsavedChangesBar({
    visible,
    saving,
    onDiscard,
    onSave,
    formId,
    saveDisabled,
}: UnsavedChangesBarProps) {
    const { t } = useTranslation();
    const keyboardOpen = useKeyboardOpen();

    if (!visible) return null;

    return (
        <div
            className={cn(
                'pointer-events-none fixed inset-x-0 z-50 flex justify-center px-3 md:px-4',
                keyboardOpen ? 'bottom-4' : 'bottom-[calc(5.75rem+env(safe-area-inset-bottom))]',
                'md:bottom-6',
            )}
        >
            <div className="pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-full border bg-background/95 py-1.5 pl-3.5 pr-1.5 shadow-lg backdrop-blur animate-fade-in md:w-auto md:max-w-none md:gap-3 md:pl-4">
                <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
                <p className="min-w-0 flex-1 truncate text-xs font-medium md:flex-none md:text-sm">
                    {t('account.unsavedBar.label')}
                </p>
                <div className="flex shrink-0 items-center gap-1 md:gap-1.5">
                    <Button
                        type="button"
                        variant="ghost" // destructive, outline, secondary
                        size="sm"
                        className="rounded-full"
                        onClick={onDiscard}
                        disabled={saving}
                    >
                        {t('account.unsavedBar.discard')}
                    </Button>
                    <Button
                        type={formId ? 'submit' : 'button'}
                        form={formId}
                        size="sm"
                        className="gap-1.5 rounded-full"
                        onClick={formId ? undefined : onSave}
                        disabled={saving || saveDisabled}
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        <span className="md:hidden">{t('account.unsavedBar.save')}</span>
                        <span className="hidden md:inline">{t('account.unsavedBar.saveChanges')}</span>
                    </Button>
                </div>
            </div>
        </div>
    );
}
