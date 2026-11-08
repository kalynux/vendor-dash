import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useTranslation, type TranslationKey } from '@/i18n';
import { cn } from '@/lib/utils';
import type { VendorKind } from '@/lib/vendorKind';

const OPTIONS: { value: VendorKind; labelKey: TranslationKey; hintKey: TranslationKey }[] = [
  { value: 'seller', labelKey: 'auth.register.kindSeller', hintKey: 'auth.register.kindSellerHint' },
  { value: 'provider', labelKey: 'auth.register.kindProvider', hintKey: 'auth.register.kindProviderHint' },
];

/**
 * "What will you do on Wi-Mall?" — selling products, or advertising a service
 * business. Sent as `vendorKind`.
 *
 * It is the one answer on this form that can never be changed afterwards, so
 * the screen says so right under it, not in small print at the bottom.
 */
export function VendorKindChoice({
  value,
  onChange,
}: {
  value: VendorKind;
  onChange: (value: VendorKind) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{t('auth.register.kindQuestion')}</legend>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as VendorKind)} className="gap-2">
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            htmlFor={`vendor-kind-${o.value}`}
            className={cn(
              'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors',
              value === o.value ? 'border-primary bg-primary/5' : 'hover:bg-accent/50',
            )}
          >
            <RadioGroupItem id={`vendor-kind-${o.value}`} value={o.value} className="mt-0.5" />
            <span className="space-y-0.5">
              <span className="block text-sm font-medium">{t(o.labelKey)}</span>
              <span className="block text-xs text-muted-foreground">{t(o.hintKey)}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
      <p className="text-xs text-muted-foreground">{t('auth.register.kindPermanent')}</p>
    </fieldset>
  );
}
