import { Label } from '@/components/ui/label';
import { UnitInput } from '@/components/ui/unit-input';
import { useTranslation, useFormatters } from '@/i18n';

interface BookingPriceFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  currency: string;
  /** One short line saying what the minimum is. */
  hint: string;
  error?: string | null;
  /** What the customer has already paid: a lower price refunds the difference. */
  amountPaid: number;
}

/** A whole-number price, its minimum, and the warning before a price below what was paid. */
export function BookingPriceField({
  id, label, value, onChange, currency, hint, error, amountPaid,
}: BookingPriceFieldProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const price = Number(value);
  // Only once the price is one the server would take, so the two lines never compete.
  const refunds = !error && value.trim() !== '' && price < amountPaid;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm">{label}</Label>
      <UnitInput
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        unit={fmt.currencySymbol(currency)}
        invalid={!!error}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        wrapperClassName="md:h-10"
      />
      {error
        ? <p data-field-error className="text-xs text-destructive">{error}</p>
        : <p className="text-xs text-muted-foreground">{hint}</p>}
      {refunds && (
        <p className="rounded-md bg-amber-50 px-2.5 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
          {t('services.pricing.refundWarning', {
            paid: fmt.currency(amountPaid, currency),
            difference: fmt.currency(amountPaid - price, currency),
          })}
        </p>
      )}
    </div>
  );
}
