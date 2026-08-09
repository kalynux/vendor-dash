// ─── Variant Table ────────────────────────────────────────────────────────────
// Matrix table with dynamic option columns, inline editing, bulk edit, and row
// status. Renders as a table on >= md screens and as stacked cards on mobile.

import { useState, useCallback, useEffect, useRef, type ChangeEvent } from 'react';
import {
  ChevronDown,
  Wand2,
  Settings2,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useMessage, useTranslation, type TranslationKey } from '@/i18n';
import { VariantImageStack } from './VariantImageStack';
import { PendingStockBadge, type PendingStockInfo } from '@/components/inventory/PendingStockBadge';
import type { VariantRow, VariantRowPatch, DraftOption } from './variant.types';
import type { ApiFileDetail } from '@/types/product.types';

// ─── Props ───────────────────────────────────────────────────────────────────

interface VariantTableProps {
  rows: VariantRow[];
  options: DraftOption[];
  rowErrors: Record<string, string>;
  onUpdateRow: (localId: string, patch: VariantRowPatch) => void;
  onBulkUpdate: (field: string, value: unknown) => void;
  onAutoGenerateSkus: () => void;
  onEditOptions: () => void;
  onSave: () => void;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  newRowCount: number;
  modifiedRowCount: number;
  persistedRowCount: number;
  // ── Variant images ──
  productId: string;
  maxImages: number;
  /** Resolved image list per saved variant id. */
  filesByVariantId: Record<string, ApiFileDetail[]>;
  onVariantImagesChange: (variantId: string, files: ApiFileDetail[]) => void;
  // ── Agency-warehoused stock ──
  /**
   * Open stock requests per SAVED variant id. On an agency-warehoused product a
   * quantity is a proposal until the agency approves it, so the input shows the
   * server's figure and the badge says what is queued.
   */
  pendingStockByVariantId?: Record<string, PendingStockInfo>;
  /**
   * True when this product's pickup is `agency_storage`. A warehouse holds a
   * countable number of things, so unlimited stock is refused there — disable
   * the switch rather than letting the vendor eat a 422 at save time.
   */
  infiniteStockLocked?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VariantTable({
  rows,
  options,
  rowErrors,
  onUpdateRow,
  onBulkUpdate,
  onAutoGenerateSkus,
  onEditOptions,
  onSave,
  isSaving,
  hasUnsavedChanges,
  newRowCount,
  modifiedRowCount,
  persistedRowCount,
  productId,
  maxImages,
  filesByVariantId,
  onVariantImagesChange,
  pendingStockByVariantId,
  infiniteStockLocked = false,
}: VariantTableProps) {
  const { t } = useTranslation();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkStock, setBulkStock] = useState('');
  const [showBulkEdit, setShowBulkEdit] = useState(false);

  const sortedOptions = [...options].sort((a, b) => a.position - b.position);

  const toggleExpand = useCallback((localId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(localId)) {
        next.delete(localId);
      } else {
        next.add(localId);
      }
      return next;
    });
  }, []);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Status summary — visible on top on mobile so users see at a glance */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs order-1 md:order-2">
          {persistedRowCount > 0 && (
            <Badge variant="outline" className="border-emerald-500/50 text-emerald-600">
              {t('products.variantTable.saved', { count: persistedRowCount })}
            </Badge>
          )}
          {newRowCount > 0 && (
            <Badge variant="outline" className="border-blue-500/50 text-blue-600">
              {t('products.variantTable.new', { count: newRowCount })}
            </Badge>
          )}
          {modifiedRowCount > 0 && (
            <Badge variant="outline" className="border-amber-500/50 text-amber-600">
              {t('products.variantTable.modified', { count: modifiedRowCount })}
            </Badge>
          )}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2 md:flex md:items-center md:gap-2 order-2 md:order-1">
          <Button variant="outline" size="sm" onClick={onEditOptions} className="gap-1">
            <Settings2 className="h-4 w-4" />
            <span>{t('products.variantTable.options')}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onAutoGenerateSkus} className="gap-1">
            <Wand2 className="h-4 w-4" />
            <span>{t('products.variantTable.autoSku')}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBulkEdit(!showBulkEdit)}
          >
            {t('products.variantTable.bulkEdit')}
          </Button>
        </div>
      </div>

      {/* Bulk Edit Bar */}
      {showBulkEdit && (
        <div className="flex flex-col gap-3 p-3 bg-muted/50 rounded-lg border md:flex-row md:items-center">
          <span className="text-xs font-medium text-muted-foreground md:shrink-0">
            {t('products.variantTable.setForAll')}
          </span>
          <div className="grid grid-cols-[1fr_auto] gap-2 items-center md:flex md:items-center md:gap-1.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs shrink-0">{t('products.columns.price')}</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
                className="h-8 w-full md:w-[100px] text-xs"
                placeholder="0.00"
              />
            </div>
            <Button
              variant={bulkPrice ? 'default' : 'secondary'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                const val = parseFloat(bulkPrice);
                if (!isNaN(val) && val >= 0) {
                  onBulkUpdate('price', val);
                }
              }}
              disabled={!bulkPrice}
            >
              {t('common.actions.apply')}
            </Button>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2 items-center md:flex md:items-center md:gap-1.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs shrink-0">{t('products.columns.stock')}</Label>
              <Input
                type="number"
                min={0}
                value={bulkStock}
                onChange={(e) => setBulkStock(e.target.value)}
                className="h-8 w-full md:w-[100px] text-xs"
                placeholder="0"
              />
            </div>
            <Button
              variant={bulkStock ? 'default' : 'secondary'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                const val = parseInt(bulkStock, 10);
                if (!isNaN(val) && val >= 0) {
                  onBulkUpdate('stock', val);
                }
              }}
              disabled={!bulkStock}
            >
              {t('common.actions.apply')}
            </Button>
          </div>
        </div>
      )}

      {/* Empty state (shared) */}
      {rows.length === 0 && (
        <div className="border rounded-lg p-8 text-center text-muted-foreground text-sm">
          {t('products.variantTable.empty')}
        </div>
      )}

      {/* ── Mobile: stacked cards ─────────────────────────────────────────── */}
      {rows.length > 0 && (
        <div className="space-y-3 md:hidden">
          {rows.map((row) => (
            <VariantRowCard
              key={row.localId}
              row={row}
              sortedOptions={sortedOptions}
              isExpanded={expandedRows.has(row.localId)}
              onToggleExpand={() => toggleExpand(row.localId)}
              onUpdate={(patch) => onUpdateRow(row.localId, patch)}
              errors={rowErrors}
              productId={productId}
              maxImages={maxImages}
              files={row.serverId ? (filesByVariantId[row.serverId] ?? []) : []}
              onImagesChange={onVariantImagesChange}
              pendingStock={
                row.serverId ? (pendingStockByVariantId?.[row.serverId] ?? null) : null
              }
              infiniteStockLocked={infiniteStockLocked}
            />
          ))}
        </div>
      )}

      {/* ── Desktop: table ────────────────────────────────────────────────── */}
      {rows.length > 0 && (
        <div className="hidden md:block border rounded-lg overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {sortedOptions.map((opt) => (
                  <th
                    key={opt.localId}
                    className="text-left p-2 font-medium text-muted-foreground"
                  >
                    {opt.name}
                  </th>
                ))}
                <th className="text-left p-2 font-medium text-muted-foreground min-w-[140px]">
                  {t('products.columns.name')}
                </th>
                <th className="text-left p-2 font-medium text-muted-foreground min-w-[140px]">
                  {t('products.columns.sku')}
                </th>
                <th className="text-left p-2 font-medium text-muted-foreground min-w-[100px]">
                  {t('products.columns.price')}
                </th>
                <th className="text-left p-2 font-medium text-muted-foreground min-w-[80px]">
                  {t('products.columns.stock')}
                </th>
                <th className="text-left p-2 font-medium text-muted-foreground min-w-[90px]">
                  {t('products.columns.images')}
                </th>
                <th className="text-center p-2 font-medium text-muted-foreground w-[70px]">
                  {t('products.columns.status')}
                </th>
                <th className="w-[85px] p-2 text-right" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <VariantRowComponent
                  key={row.localId}
                  row={row}
                  sortedOptions={sortedOptions}
                  isExpanded={expandedRows.has(row.localId)}
                  onToggleExpand={() => toggleExpand(row.localId)}
                  onUpdate={(patch) => onUpdateRow(row.localId, patch)}
                  errors={rowErrors}
                  productId={productId}
                  maxImages={maxImages}
                  files={row.serverId ? (filesByVariantId[row.serverId] ?? []) : []}
                  onImagesChange={onVariantImagesChange}
                  pendingStock={
                    row.serverId ? (pendingStockByVariantId?.[row.serverId] ?? null) : null
                  }
                  infiniteStockLocked={infiniteStockLocked}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Save button (inline, full-width on mobile) ────────────────────── */}
      {rows.length > 0 && (
        <div className="flex justify-end pt-1">
          <Button
            onClick={onSave}
            disabled={isSaving || !hasUnsavedChanges}
            className="w-full md:w-auto gap-1.5"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSaving
              ? t('common.actions.saving')
              : hasUnsavedChanges
                ? t('products.variantTable.saveChanges', {
                    count: newRowCount + modifiedRowCount,
                  })
                : t('products.variantTable.allSaved')}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Variant Row (desktop table) ─────────────────────────────────────────────

interface VariantRowComponentProps {
  row: VariantRow;
  sortedOptions: DraftOption[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: VariantRowPatch) => void;
  errors: Record<string, string>;
  productId: string;
  maxImages: number;
  files: ApiFileDetail[];
  onImagesChange: (variantId: string, files: ApiFileDetail[]) => void;
  pendingStock: PendingStockInfo | null;
  infiniteStockLocked: boolean;
}

function VariantRowComponent({
  row,
  sortedOptions,
  isExpanded,
  onToggleExpand,
  onUpdate,
  errors,
  productId,
  maxImages,
  files,
  onImagesChange,
  pendingStock,
  infiniteStockLocked,
}: VariantRowComponentProps) {
  const { t } = useTranslation();
  const statusBadge = STATUS_BADGE[row.status];

  const handleFieldChange = (
    field: keyof VariantRowPatch,
    value: string | number | boolean | null,
  ) => {
    onUpdate({ [field]: value } as VariantRowPatch);
  };

  return (
    <>
      <tr
        className={cn(
          'border-b transition-colors hover:bg-muted/30',
          row.status === 'new' && 'bg-blue-50/30 dark:bg-blue-950/10',
          row.status === 'modified' && 'bg-amber-50/30 dark:bg-amber-950/10',
        )}
      >
        {sortedOptions.map((opt) => {
          const comboVal = row.combo.comboValues.find(
            (cv) => cv.optionLocalId === opt.localId,
          );
          return (
            <td key={opt.localId} className="p-2 text-sm">
              {comboVal ? (
                <Badge variant="outline" className="font-normal">
                  {comboVal.displayValue}
                </Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
          );
        })}

        <td className="p-2">
          <CellInput
            value={row.name}
            error={errors[`${row.localId}.name`]}
            onChange={(v) => handleFieldChange('name', v)}
          />
        </td>

        <td className="p-2">
          <CellInput
            value={row.sku}
            error={errors[`${row.localId}.sku`]}
            onChange={(v) => handleFieldChange('sku', v)}
            mono
          />
        </td>

        <td className="p-2">
          <CellInput
            type="number"
            value={String(row.price)}
            error={errors[`${row.localId}.price`]}
            onChange={(v) => handleFieldChange('price', parseFloat(v) || 0)}
            min={0}
            step="0.01"
          />
        </td>

        <td className="p-2 text-center">
          {row.isInfiniteStock ? (
            <span className="text-xs text-muted-foreground">∞</span>
          ) : (
            <CellInput
              type="number"
              value={String(row.stock)}
              error={errors[`${row.localId}.stock`]}
              onChange={(v) => handleFieldChange('stock', parseInt(v, 10) || 0)}
              min={0}
            />
          )}
          {/* Explains why the number above snapped back after a save. */}
          {pendingStock && (
            <PendingStockBadge
              currentStock={row.stock}
              pending={pendingStock}
              className="mt-1"
            />
          )}
        </td>

        <td className="p-2">
          <VariantImageStack
            productId={productId}
            variantId={row.serverId}
            files={files}
            maxImages={maxImages}
            onChange={onImagesChange}
          />
        </td>

        <td className="p-2 text-center">
          <Badge variant="outline" className={cn('text-xs', statusBadge.className)}>
            {t(statusBadge.labelKey)}
          </Badge>
        </td>

        <td className="p-2 text-right">
          <button
            onClick={onToggleExpand}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1.5 py-1 hover:bg-muted"
          >
            <span>{t(isExpanded ? 'products.variantTable.less' : 'products.variantTable.more')}</span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
                isExpanded && 'rotate-180',
              )}
            />
          </button>
        </td>
      </tr>

      {isExpanded && (
        <tr className="border-b bg-muted/20">
          <td colSpan={sortedOptions.length + 7} className="p-4">
            <SecondaryFields
              row={row}
              onChange={handleFieldChange}
              infiniteStockLocked={infiniteStockLocked}
            />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Variant Row (mobile card) ──────────────────────────────────────────────

function VariantRowCard({
  row,
  sortedOptions,
  isExpanded,
  onToggleExpand,
  onUpdate,
  errors,
  productId,
  maxImages,
  files,
  onImagesChange,
  pendingStock,
  infiniteStockLocked,
}: VariantRowComponentProps) {
  const { t } = useTranslation();
  const statusBadge = STATUS_BADGE[row.status];

  const handleFieldChange = (
    field: keyof VariantRowPatch,
    value: string | number | boolean | null,
  ) => {
    onUpdate({ [field]: value } as VariantRowPatch);
  };

  const nameError = errors[`${row.localId}.name`];
  const skuError = errors[`${row.localId}.sku`];
  const priceError = errors[`${row.localId}.price`];
  const stockError = errors[`${row.localId}.stock`];

  return (
    <div
      className={cn(
        'rounded-lg border bg-card p-3 space-y-3',
        row.status === 'new' && 'border-blue-200 bg-blue-50/30 dark:border-blue-900/40 dark:bg-blue-950/20',
        row.status === 'modified' && 'border-amber-200 bg-amber-50/30 dark:border-amber-900/40 dark:bg-amber-950/20',
      )}
    >
      {/* Header: option badges + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {sortedOptions.map((opt) => {
            const comboVal = row.combo.comboValues.find(
              (cv) => cv.optionLocalId === opt.localId,
            );
            if (!comboVal) return null;
            return (
              <Badge
                key={opt.localId}
                variant="outline"
                className="font-normal text-xs gap-1"
              >
                <span className="text-muted-foreground">{opt.name}:</span>
                <span>{comboVal.displayValue}</span>
              </Badge>
            );
          })}
        </div>
        <Badge variant="outline" className={cn('text-[10px] shrink-0', statusBadge.className)}>
          {t(statusBadge.labelKey)}
        </Badge>
      </div>

      {/* Name */}
      <FieldRow label={t('products.columns.name')} error={nameError}>
        <CellInput
          value={row.name}
          error={nameError}
          onChange={(v) => handleFieldChange('name', v)}
          fullWidth
        />
      </FieldRow>

      {/* SKU */}
      <FieldRow label={t('products.columns.sku')} error={skuError}>
        <CellInput
          value={row.sku}
          error={skuError}
          onChange={(v) => handleFieldChange('sku', v)}
          mono
          fullWidth
        />
      </FieldRow>

      {/* Price + Stock side by side */}
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label={t('products.columns.price')} error={priceError}>
          <CellInput
            type="number"
            value={String(row.price)}
            error={priceError}
            onChange={(v) => handleFieldChange('price', parseFloat(v) || 0)}
            min={0}
            step="0.01"
            fullWidth
          />
        </FieldRow>
        <FieldRow label={t('products.columns.stock')} error={stockError}>
          {row.isInfiniteStock ? (
            <div className="h-8 px-3 text-xs text-muted-foreground flex items-center bg-muted/40 rounded-md border border-input">
              {t('products.variantTable.unlimited')}
            </div>
          ) : (
            <CellInput
              type="number"
              value={String(row.stock)}
              error={stockError}
              onChange={(v) => handleFieldChange('stock', parseInt(v, 10) || 0)}
              min={0}
              fullWidth
            />
          )}
          {pendingStock && (
            <PendingStockBadge
              currentStock={row.stock}
              pending={pendingStock}
              className="mt-1"
            />
          )}
        </FieldRow>
      </div>

      {/* Images */}
      <FieldRow label={t('products.columns.images')}>
        <VariantImageStack
          productId={productId}
          variantId={row.serverId}
          files={files}
          maxImages={maxImages}
          onChange={onImagesChange}
        />
      </FieldRow>

      {/* Expand toggle */}
      <button
        type="button"
        onClick={onToggleExpand}
        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline px-1 py-1 -mx-1 -mb-1"
      >
        <span>
          {t(isExpanded
            ? 'products.variantTable.hideDetails'
            : 'products.variantTable.moreDetails')}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
            isExpanded && 'rotate-180',
          )}
        />
      </button>

      {isExpanded && (
        <div className="pt-3 border-t">
          <SecondaryFields
            row={row}
            onChange={handleFieldChange}
            infiniteStockLocked={infiniteStockLocked}
          />
        </div>
      )}
    </div>
  );
}

// ─── Field Row (mobile-friendly label + control) ─────────────────────────────

function FieldRow({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  const m = useMessage();
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      {children}
      {error && <p className="text-[10px] text-destructive">{m(error)}</p>}
    </div>
  );
}

// ─── Secondary Fields (shared by both views) ─────────────────────────────────

function SecondaryFields({
  row,
  onChange,
  infiniteStockLocked = false,
}: {
  row: VariantRow;
  onChange: (field: keyof VariantRowPatch, value: string | number | boolean | null) => void;
  infiniteStockLocked?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 md:max-w-3xl">
      <div className="space-y-1">
        <Label className="text-xs">{t('products.fields.weightG')}</Label>
        <Input
          type="number"
          min={0}
          value={row.weight ?? ''}
          onChange={(e) =>
            onChange('weight', e.target.value ? parseInt(e.target.value, 10) : 0)
          }
          className="h-8 text-sm"
          placeholder="0"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('products.fields.lengthCm')}</Label>
        <Input
          type="number"
          min={0}
          value={row.length ?? ''}
          onChange={(e) =>
            onChange('length', e.target.value ? parseInt(e.target.value, 10) : 0)
          }
          className="h-8 text-sm"
          placeholder="0"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('products.fields.widthCm')}</Label>
        <Input
          type="number"
          min={0}
          value={row.width ?? ''}
          onChange={(e) =>
            onChange('width', e.target.value ? parseInt(e.target.value, 10) : 0)
          }
          className="h-8 text-sm"
          placeholder="0"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">{t('products.fields.heightCm')}</Label>
        <Input
          type="number"
          min={0}
          value={row.height ?? ''}
          onChange={(e) =>
            onChange('height', e.target.value ? parseInt(e.target.value, 10) : 0)
          }
          className="h-8 text-sm"
          placeholder="0"
        />
      </div>
      <div className="space-y-1 col-span-2 md:col-span-1">
        <Label className="text-xs">{t('products.variantTable.secondary.compareAtPrice')}</Label>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={row.compareAtPrice ?? ''}
          onChange={(e) =>
            onChange(
              'compareAtPrice',
              e.target.value ? parseFloat(e.target.value) : 0,
            )
          }
          className="h-8 text-sm"
          placeholder="0.00"
        />
      </div>
      {/* A warehouse holds a countable number of things, so `agency_storage` and
          unlimited stock are mutually exclusive — the backend refuses the pair
          with 422 CATALOG_PRODUCT_AGENCY_STORAGE_INFINITE_STOCK. Disable rather
          than let the vendor discover it at save time. */}
      <div className="col-span-2 md:col-span-1 space-y-1">
        <div className="flex items-center gap-2">
          <Switch
            checked={row.isInfiniteStock}
            disabled={infiniteStockLocked}
            onCheckedChange={(checked) => onChange('isInfiniteStock', checked)}
          />
          <Label className="text-xs">{t('products.variantTable.secondary.infiniteStock')}</Label>
        </div>
        {infiniteStockLocked && (
          <p className="text-[11px] leading-tight text-muted-foreground">
            {t('products.fields.unlimitedStockLockedHint')}
          </p>
        )}
      </div>

      {row.serverId && (
        <>
          <div className="space-y-1 col-span-2 md:col-span-1">
            <Label className="text-xs">{t('products.variantTable.secondary.lowStockAlert')}</Label>
            <Input
              type="number"
              min={1}
              value={row.lowStockThreshold ?? ''}
              onChange={(e) =>
                onChange(
                  'lowStockThreshold',
                  e.target.value ? parseInt(e.target.value, 10) : null,
                )
              }
              className="h-8 text-sm"
              placeholder={t('products.variantTable.secondary.nonePlaceholder')}
            />
          </div>
          <div className="flex items-center gap-2 col-span-2 md:col-span-1">
            <Switch
              checked={row.allowOversell ?? false}
              onCheckedChange={(checked) => onChange('allowOversell', checked)}
            />
            <Label className="text-xs">{t('products.variantTable.secondary.allowOversell')}</Label>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Status Badge meta ───────────────────────────────────────────────────────

const STATUS_BADGE: Record<
  VariantRow['status'],
  { labelKey: TranslationKey; className: string }
> = {
  persisted: {
    labelKey: 'products.variantTable.rowStatus.persisted',
    className:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  new: {
    labelKey: 'products.variantTable.rowStatus.new',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  modified: {
    labelKey: 'products.variantTable.rowStatus.modified',
    className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  removed: {
    labelKey: 'products.variantTable.rowStatus.removed',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
};

// ─── Cell Input ──────────────────────────────────────────────────────────────

interface CellInputProps {
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
  mono?: boolean;
  min?: number;
  step?: string;
  fullWidth?: boolean;
}

function CellInput({
  value,
  error,
  onChange,
  type = 'text',
  mono,
  min,
  step,
  fullWidth,
}: CellInputProps) {
  const m = useMessage();
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from parent when `value` changes externally (bulk edit, auto-SKU,
  // server sync, …). Skip while the user is actively editing this cell so we
  // don't clobber their typing.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalValue(value);
    }
  }, [value]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
    onChange(e.target.value);
  };

  const handleBlur = () => {
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  return (
    <div className={cn('relative', fullWidth && 'w-full')}>
      <Input
        ref={inputRef}
        type={type}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        min={min}
        step={step}
        inputMode={type === 'number' ? 'decimal' : undefined}
        className={cn(
          'h-8 text-xs',
          mono && 'font-mono',
          error && 'border-destructive focus-visible:ring-destructive',
        )}
      />
      {error && (
        <p className="absolute -bottom-4 left-0 text-[10px] text-destructive whitespace-nowrap">
          {m(error)}
        </p>
      )}
    </div>
  );
}
