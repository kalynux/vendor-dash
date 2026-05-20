import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, ChevronLeft, ChevronRight, Save } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PricingVariantList } from '@/components/products/PricingVariantList';
import { digitalConfigSchema, type DigitalConfigFormValues } from '@/components/products/schemas/product.schemas';
import type { WizardState, LicenseTierRow } from '@/types/product.types';

interface StepPricingProps {
  mode: 'create' | 'edit';
  serverData: Partial<WizardState>;
  isSaving: boolean;
  stepError: string | null;
  onSaveComplete: (updates: Partial<WizardState> & { _pendingTiers?: LicenseTierRow[] }) => void;
  onBack: () => void;
}

function buildDefaultTiers(serverData: Partial<WizardState>): LicenseTierRow[] {
  const serverVariants = serverData.serverVariants ?? [];
  if (serverVariants.length > 0) {
    return serverVariants.map((v) => ({
      tempId: v.id,
      sku: v.sku,
      name: v.name ?? '',
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      serverId: v.id,
    }));
  }
  // Default: one empty tier
  return [{ tempId: crypto.randomUUID(), sku: '', name: '', price: 0 }];
}

export function StepPricing({
  mode,
  serverData,
  isSaving,
  stepError,
  onSaveComplete,
  onBack,
}: StepPricingProps) {
  const digitalConfig = serverData.serverProduct?.digitalConfig;

  const [tiers, setTiers] = useState<LicenseTierRow[]>(() => buildDefaultTiers(serverData));
  const [tierErrors, setTierErrors] = useState<Record<string, string>>({});
  const [allTiersSaved, setAllTiersSaved] = useState(() =>
    (serverData.serverVariants ?? []).length > 0,
  );

  const { register, watch, setValue } = useForm<DigitalConfigFormValues>({
    resolver: zodResolver(digitalConfigSchema),
    defaultValues: {
      maxDownloads: digitalConfig?.maxDownloads ?? null,
      expiresAfterDays: digitalConfig?.expiresAfterDays ?? null,
    },
  });

  const [maxDownloadsEnabled, setMaxDownloadsEnabled] = useState(
    digitalConfig?.maxDownloads != null,
  );
  const [expiresEnabled, setExpiresEnabled] = useState(
    digitalConfig?.expiresAfterDays != null,
  );

  const handleTierChange = useCallback(
    (tempId: string, field: keyof LicenseTierRow, value: unknown) => {
      setTiers((prev) =>
        prev.map((t) => (t.tempId === tempId ? { ...t, [field]: value } : t)),
      );
      setTierErrors((prev) => {
        const key = `${tempId}.${field}`;
        if (!prev[key]) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setAllTiersSaved(false);
    },
    [],
  );

  function handleAddTier() {
    setTiers((prev) => [...prev, { tempId: crypto.randomUUID(), sku: '', name: '', price: 0 }]);
    setAllTiersSaved(false);
  }

  function handleRemoveTier(tempId: string) {
    setTiers((prev) => prev.filter((t) => t.tempId !== tempId));
    setAllTiersSaved(false);
  }

  function validateTiers(): boolean {
    const errors: Record<string, string> = {};
    let valid = true;
    for (const tier of tiers) {
      if (!tier.sku.trim()) {
        errors[`${tier.tempId}.sku`] = 'SKU is required';
        valid = false;
      }
      if (!tier.name.trim()) {
        errors[`${tier.tempId}.name`] = 'Tier name is required';
        valid = false;
      }
      if (!tier.price || tier.price <= 0) {
        errors[`${tier.tempId}.price`] = 'Price must be greater than 0';
        valid = false;
      }
    }
    setTierErrors(errors);
    return valid;
  }

  function handleSaveTiers() {
    if (!validateTiers()) return;

    const maxDownloads = maxDownloadsEnabled ? (watch('maxDownloads') ?? null) : null;
    const expiresAfterDays = expiresEnabled ? (watch('expiresAfterDays') ?? null) : null;

    onSaveComplete({
      _pendingTiers: tiers,
      _digitalConfig: { maxDownloads, expiresAfterDays },
    } as Partial<WizardState> & { _pendingTiers: LicenseTierRow[]; _digitalConfig: { maxDownloads: number | null; expiresAfterDays: number | null } });
  }

  function handleContinue() {
    onSaveComplete({});
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Pricing & license tiers</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Define license tiers for your digital product (e.g. Personal, Commercial, Extended).
        </p>
      </div>

      {stepError && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{stepError}</AlertDescription>
        </Alert>
      )}

      {/* License tiers */}
      <PricingVariantList
        tiers={tiers}
        onTierChange={handleTierChange}
        onAddTier={handleAddTier}
        onRemoveTier={handleRemoveTier}
        errors={tierErrors}
        isSaving={isSaving}
      />

      {/* Digital config */}
      <div className="rounded-lg border border-border p-4 space-y-4">
        <p className="text-sm font-medium">Download restrictions (optional)</p>

        {/* Max downloads */}
        <div className="flex items-start gap-4">
          <Switch
            checked={maxDownloadsEnabled}
            onCheckedChange={(v) => {
              setMaxDownloadsEnabled(v);
              if (!v) setValue('maxDownloads', null);
            }}
          />
          <div className="flex-1 space-y-1">
            <Label className="text-sm">Limit download count</Label>
            <p className="text-xs text-muted-foreground">
              Restrict how many times each customer can download the file.
            </p>
            {maxDownloadsEnabled && (
              <Input
                type="number"
                min={1}
                placeholder="e.g. 5"
                className="h-8 w-24 mt-2"
                {...register('maxDownloads', { valueAsNumber: true })}
              />
            )}
          </div>
        </div>

        {/* Expires after days */}
        <div className="flex items-start gap-4">
          <Switch
            checked={expiresEnabled}
            onCheckedChange={(v) => {
              setExpiresEnabled(v);
              if (!v) setValue('expiresAfterDays', null);
            }}
          />
          <div className="flex-1 space-y-1">
            <Label className="text-sm">Set download expiry</Label>
            <p className="text-xs text-muted-foreground">
              Link expires after this many days from purchase date.
            </p>
            {expiresEnabled && (
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 30"
                  className="h-8 w-24"
                  {...register('expiresAfterDays', { valueAsNumber: true })}
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save tiers button */}
      {!allTiersSaved && (
        <Button
          type="button"
          onClick={handleSaveTiers}
          disabled={isSaving || tiers.length === 0}
          className="gap-1.5"
        >
          {isSaving ? (
            'Saving…'
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Tiers
            </>
          )}
        </Button>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={handleContinue}
          disabled={isSaving || (!allTiersSaved && tiers.length > 0)}
          className="gap-1.5"
        >
          {isSaving ? 'Saving…' : 'Continue'}
          {!isSaving && <ChevronRight className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
