import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ResponsiveModal } from '@/components/services/ResponsiveModal';
import { useTranslation } from '@/i18n';
import { isAllowedHref } from '@/lib/richtext';

interface LinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefills the label — the text the vendor had selected, or the existing anchor's. */
  initialLabel: string;
  initialHref: string;
  onSubmit: (href: string, label: string) => void;
  onRemove?: () => void;
}

/** The footer's Save button reaches the body's form through this id. */
const FORM_ID = 'rt-link-form';

/**
 * Turn what a vendor types into a URL we are willing to store.
 *
 * Almost nobody types a scheme. `wimall.cm` is what gets entered, and rejecting
 * it as invalid would be technically correct and practically useless, so a bare
 * host is promoted to `https://`. A typed scheme is left alone — including one
 * we will then refuse, because silently rewriting `javascript:` into something
 * that validates is worse than saying no.
 */
function normalizeHref(input: string): string {
  const value = input.trim();
  if (!value) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  return `https://${value}`;
}

/**
 * The fields, in their own component on purpose.
 *
 * Radix unmounts a closed dialog's content, so this remounts on every open and
 * its `useState` initialisers re-seed from the current selection for free. The
 * alternative — keeping the state in the parent and resetting it from an effect
 * — is a synchronous `setState` in an effect, which cascades a render and which
 * `react-hooks/set-state-in-effect` rightly rejects.
 */
function LinkForm({
  initialLabel,
  initialHref,
  onSubmit,
}: {
  initialLabel: string;
  initialHref: string;
  onSubmit: (href: string, label: string) => void;
}) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(initialLabel);
  const [href, setHref] = useState(initialHref);
  const [touched, setTouched] = useState(false);

  const normalized = normalizeHref(href);
  const valid = isAllowedHref(normalized);

  return (
    <form
      id={FORM_ID}
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (valid) onSubmit(normalized, label);
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="rt-link-label">{t('products.editor.link.label')}</Label>
        <Input
          id="rt-link-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t('products.editor.link.labelPlaceholder')}
        />
        {/* The single most surprising thing about this feature, said once, in
            the one place a vendor is about to be affected by it. */}
        <p className="text-xs text-muted-foreground">{t('products.editor.link.labelHint')}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rt-link-href">{t('products.editor.link.url')}</Label>
        <Input
          id="rt-link-href"
          value={href}
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => setHref(e.target.value)}
          placeholder="wimall.cm/guide"
          aria-invalid={touched && !valid}
        />
        {touched && !valid && (
          <p className="text-xs text-destructive">{t('products.editor.link.invalid')}</p>
        )}
      </div>
    </form>
  );
}

export function LinkDialog({
  open,
  onOpenChange,
  initialLabel,
  initialHref,
  onSubmit,
  onRemove,
}: LinkDialogProps) {
  const { t } = useTranslation();

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={t('products.editor.link.title')}
      description={t('products.editor.link.description')}
      desktopClassName="sm:max-w-md"
      mobileClassName="h-auto max-h-[92dvh]"
      footer={
        <>
          {onRemove && initialHref && (
            <Button
              type="button"
              variant="ghost"
              className="sm:mr-auto"
              onClick={() => {
                onRemove();
                onOpenChange(false);
              }}
            >
              {t('products.editor.link.remove')}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.actions.cancel')}
          </Button>
          {/* `form=` lets a button outside the form submit it — which is what
              keeps the fields' state inside the remounting child. */}
          <Button type="submit" form={FORM_ID}>
            {t('common.actions.save')}
          </Button>
        </>
      }
    >
      <LinkForm
        initialLabel={initialLabel}
        initialHref={initialHref}
        onSubmit={(href, label) => {
          onSubmit(href, label);
          onOpenChange(false);
        }}
      />
    </ResponsiveModal>
  );
}
