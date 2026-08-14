import { useEffect, useState } from 'react';
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

export function LinkDialog({
  open,
  onOpenChange,
  initialLabel,
  initialHref,
  onSubmit,
  onRemove,
}: LinkDialogProps) {
  const { t } = useTranslation();
  const [label, setLabel] = useState(initialLabel);
  const [href, setHref] = useState(initialHref);
  const [touched, setTouched] = useState(false);

  // Re-seed each time it opens: the selection is different every time, and a
  // dialog that remembers the last product's URL is a foot-gun.
  useEffect(() => {
    if (!open) return;
    setLabel(initialLabel);
    setHref(initialHref);
    setTouched(false);
  }, [open, initialLabel, initialHref]);

  const normalized = normalizeHref(href);
  const valid = isAllowedHref(normalized);

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    onSubmit(normalized, label);
    onOpenChange(false);
  };

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
          <Button type="button" onClick={submit}>
            {t('common.actions.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="wimall.cm/guide"
            aria-invalid={touched && !valid}
          />
          {touched && !valid && (
            <p className="text-xs text-destructive">{t('products.editor.link.invalid')}</p>
          )}
        </div>
      </div>
    </ResponsiveModal>
  );
}
