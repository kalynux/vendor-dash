import type { ReactNode } from 'react';
import { AlertCircle, ChevronLeft } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useMessage, useTranslation } from '@/i18n';

/**
 * The pieces every product wizard step repeats: the error banner and the
 * Back / Continue footer. (The "More options" row they use lives in
 * `products/form/DisclosureTrigger`, shared with the quick-add form.)
 *
 * Kept in one place so the five steps cannot drift apart — each one used to carry
 * its own copy of the footer, and they had already started to differ.
 */

/** The step's save / load error, as a banner above its sections. */
export function StepError({ error }: { error: string | null }) {
  const m = useMessage();
  if (!error) return null;
  return (
    <Alert variant="destructive" className="mb-4 md:mb-6">
      <AlertCircle className="size-4" />
      <AlertDescription>{m(error)}</AlertDescription>
    </Alert>
  );
}

interface StepActionsProps {
  onBack: () => void;
  /**
   * The forward actions, in their wide-screen order — secondary first, primary
   * last. On a phone the order flips so the primary action sits on top, where
   * the thumb lands first, and every button goes full width.
   */
  children: ReactNode;
  /** Shown directly above the buttons — what is still blocking them, say. */
  notice?: ReactNode;
}

/**
 * Back on the left, the step's own actions on the right; on a phone a stack of
 * full-width buttons with Back as the quiet one at the bottom (the header's back
 * arrow already leaves the page — this one only steps back through the wizard).
 */
export function StepActions({ onBack, children, notice }: StepActionsProps) {
  const { t } = useTranslation();
  return (
    <div className="pt-5 max-md:border-t md:pt-6">
      {notice && <div className="mb-5">{notice}</div>}
      <div className="flex flex-col-reverse gap-2 md:flex-row md:items-center md:justify-between">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          className="gap-1.5 text-muted-foreground max-md:h-11 max-md:w-full md:-ml-3"
        >
          <ChevronLeft className="size-4" />
          {t('common.actions.back')}
        </Button>
        <div className="flex flex-col-reverse gap-2 max-md:[&>*]:h-11 max-md:[&>*]:w-full md:flex-row md:items-center">
          {children}
        </div>
      </div>
    </div>
  );
}
