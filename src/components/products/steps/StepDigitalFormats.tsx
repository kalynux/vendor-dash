import { useState, useCallback } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Plus, Save } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { DigitalFormatCard } from '@/components/products/DigitalFormatCard';
import { useMessage, useTranslation } from '@/i18n';
import type { WizardState, DigitalFormatRow } from '@/types/product.types';

const MAX_FORMATS = 5;

interface StepDigitalFormatsProps {
  mode: 'create' | 'edit';
  serverData: Partial<WizardState>;
  isSaving: boolean;
  stepError: string | null;
  onSaveComplete: (
    updates: Partial<WizardState> & {
      _pendingFormats?: DigitalFormatRow[];
      _digitalIsActive?: boolean;
    },
  ) => void;
  // Called when a variant's active/archived status has been persisted on the
  // server via the per-variant status endpoint. The wizard uses this to keep
  // its `serverVariants` in sync so other steps (e.g. Review) and a remount of
  // this step don't fall back to stale data.
  onVariantStatusChanged?: (variantId: string, status: 'active' | 'archived') => void;
  onBack: () => void;
}

function buildInitialFormats(serverData: Partial<WizardState>): DigitalFormatRow[] {
  const variants = serverData.serverVariants ?? [];
  if (variants.length > 0) {
    return variants.map((v) => ({
      tempId: v.id,
      serverId: v.id,
      sku: v.sku,
      name: v.name ?? '',
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      maxDownloads: v.digital?.maxDownloads ?? null,
      expiresAfterDays: v.digital?.expiresAfterDays ?? null,
      asset: v.digital?.asset,
      image: v.files?.[0],
      status: v.status,
      pendingFile: undefined,
      pendingImage: undefined,
    }));
  }
  return [
    {
      tempId: crypto.randomUUID(),
      sku: '',
      name: '',
      price: 0,
      maxDownloads: null,
      expiresAfterDays: null,
    },
  ];
}

export function StepDigitalFormats({
  serverData,
  isSaving,
  stepError,
  onSaveComplete,
  onVariantStatusChanged,
  onBack,
}: StepDigitalFormatsProps) {
  const { t } = useTranslation();
  const m = useMessage();
  const [formats, setFormats] = useState<DigitalFormatRow[]>(() => buildInitialFormats(serverData));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isActive, setIsActive] = useState<boolean>(
    serverData.serverProduct?.digitalConfig?.isActive ?? true,
  );
  const [dirty, setDirty] = useState(false);

  const handleChange = useCallback((tempId: string, patch: Partial<DigitalFormatRow>) => {
    setFormats((prev) => prev.map((f) => (f.tempId === tempId ? { ...f, ...patch } : f)));
    setErrors((prev) => {
      const next = { ...prev };
      for (const field of Object.keys(patch)) delete next[`${tempId}.${field}`];
      return next;
    });
    setDirty(true);
  }, []);

  const handleAdd = useCallback(() => {
    setFormats((prev) =>
      prev.length >= MAX_FORMATS
        ? prev
        : [
          ...prev,
          {
            tempId: crypto.randomUUID(),
            sku: '',
            name: '',
            price: 0,
            maxDownloads: null,
            expiresAfterDays: null,
          },
        ],
    );
    setDirty(true);
  }, []);

  const handleRemove = useCallback((tempId: string) => {
    setFormats((prev) => prev.filter((f) => f.tempId !== tempId));
    setDirty(true);
  }, []);

  // Status changes go straight to the server via the per-variant status endpoint,
  // so they aren't "unsaved" — sync them into local state without dirtying the
  // form, AND notify the wizard so its `serverVariants` (read by other steps
  // and on remount of this one) doesn't fall behind.
  const handleStatusSync = useCallback(
    (tempId: string, serverId: string, status: 'active' | 'archived') => {
      setFormats((prev) => prev.map((f) => (f.tempId === tempId ? { ...f, status } : f)));
      onVariantStatusChanged?.(serverId, status);
    },
    [onVariantStatusChanged],
  );

  function validate(): boolean {
    const next: Record<string, string> = {};
    for (const f of formats) {
      if (!f.sku.trim()) next[`${f.tempId}.sku`] = 'products.formats.skuRequired';
      if (!f.name.trim()) next[`${f.tempId}.name`] = 'products.formats.nameRequired';
      if (!f.price || f.price <= 0) next[`${f.tempId}.price`] = 'products.formats.priceRequired';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSaveComplete({ _pendingFormats: formats, _digitalIsActive: isActive });
  }

  function handleContinue() {
    onSaveComplete({});
  }

  const atLimit = formats.length >= MAX_FORMATS;
  const hasUnsaved = dirty || formats.some((f) => !f.serverId);
  const productTitle = serverData.serverProduct?.title ?? '';
  const productCategory = serverData.serverProduct?.category ?? '';
  const productId = serverData.productId ?? '';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t('products.formats.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('products.formats.description', { max: MAX_FORMATS })}
        </p>
      </div>

      {stepError && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{m(stepError)}</AlertDescription>
        </Alert>
      )}

      {/* Product-wide downloads switch */}
      <div className="rounded-xl border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Label className="text-sm font-medium">{t('products.formats.downloadsEnabled')}</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('products.formats.downloadsEnabledHint')}
            </p>
          </div>
          <Switch
            checked={isActive}
            onCheckedChange={(v) => {
              setIsActive(v);
              setDirty(true);
            }}
            disabled={isSaving}
            aria-label={t('products.formats.downloadsEnabled')}
          />
        </div>
      </div>

      {/* Format cards */}
      <div className="space-y-4">
        {formats.map((format, idx) => (
          <DigitalFormatCard
            key={format.tempId}
            format={format}
            index={idx}
            errors={errors}
            canRemove={formats.length > 1}
            isSaving={isSaving}
            productTitle={productTitle}
            productCategory={productCategory}
            productId={productId}
            onChange={handleChange}
            onRemove={handleRemove}
            onStatusSync={handleStatusSync}
          />
        ))}
      </div>

      <div className="space-y-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={atLimit || isSaving}
          className="gap-2 w-full sm:w-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('products.formats.addFormat')}
        </Button>
        <p className="text-xs text-muted-foreground">
          {atLimit
            ? t('products.formats.atLimit', { max: MAX_FORMATS })
            : t('products.formats.count', { used: formats.length, max: MAX_FORMATS })}
        </p>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="w-4 h-4" />
          {t('common.actions.back')}
        </Button>
        {hasUnsaved ? (
          <Button type="button" onClick={handleSave} disabled={isSaving} className="gap-1.5">
            {isSaving ? (
              t('common.actions.saving')
            ) : (
              <>
                <Save className="w-4 h-4" />
                {t('products.formats.saveAndContinue')}
              </>
            )}
          </Button>
        ) : (
          <Button type="button" onClick={handleContinue} disabled={isSaving} className="gap-1.5">
            {t('common.actions.continue')}
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
