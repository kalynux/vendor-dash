// ─── Variant Table ────────────────────────────────────────────────────────────
// Matrix table with dynamic option columns, inline editing, bulk edit, and row status.

import { useState, useCallback, useEffect, useRef, type ChangeEvent } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Wand2,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import type { VariantRow, VariantRowPatch, DraftOption } from './variant.types';

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
}: VariantTableProps) {
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
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEditOptions}>
            <Settings2 className="h-4 w-4 mr-1" />
            Edit Options
          </Button>
          <Button variant="outline" size="sm" onClick={onAutoGenerateSkus}>
            <Wand2 className="h-4 w-4 mr-1" />
            Auto SKU
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBulkEdit(!showBulkEdit)}
          >
            Bulk Edit
          </Button>
        </div>

        <div className="flex items-center gap-3">
          {/* Status summary */}
          <div className="flex items-center gap-2 text-xs">
            {persistedRowCount > 0 && (
              <Badge variant="outline" className="border-emerald-500/50 text-emerald-600">
                {persistedRowCount} saved
              </Badge>
            )}
            {newRowCount > 0 && (
              <Badge variant="outline" className="border-blue-500/50 text-blue-600">
                {newRowCount} new
              </Badge>
            )}
            {modifiedRowCount > 0 && (
              <Badge variant="outline" className="border-amber-500/50 text-amber-600">
                {modifiedRowCount} modified
              </Badge>
            )}
          </div>

          <Button onClick={onSave} disabled={isSaving || !hasUnsavedChanges}>
            {isSaving ? 'Saving...' : 'Save Variants'}
          </Button>
        </div>
      </div>

      {/* Bulk Edit Bar */}
      {showBulkEdit && (
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border">
          <span className="text-xs font-medium text-muted-foreground">
            Set for all:
          </span>
          <div className="flex items-center gap-1.5">
            <Label className="text-xs">Price</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={bulkPrice}
              onChange={(e) => setBulkPrice(e.target.value)}
              className="h-7 w-[100px] text-xs"
              placeholder="0.00"
            />
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                const val = parseFloat(bulkPrice);
                if (!isNaN(val) && val >= 0) {
                  onBulkUpdate('price', val);
                }
              }}
              disabled={!bulkPrice}
            >
              Apply
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <Label className="text-xs">Stock</Label>
            <Input
              type="number"
              min={0}
              value={bulkStock}
              onChange={(e) => setBulkStock(e.target.value)}
              className="h-7 w-[100px] text-xs"
              placeholder="0"
            />
            <Button
              variant="secondary"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                const val = parseInt(bulkStock, 10);
                if (!isNaN(val) && val >= 0) {
                  onBulkUpdate('stock', val);
                }
              }}
              disabled={!bulkStock}
            >
              Apply
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {/* <th className="w-8 p-2" /> */}
              {sortedOptions.map((opt) => (
                <th
                  key={opt.localId}
                  className="text-left p-2 font-medium text-muted-foreground"
                >
                  {opt.name}
                </th>
              ))}
              <th className="text-left p-2 font-medium text-muted-foreground min-w-[140px]">
                Name
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground min-w-[140px]">
                SKU
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground min-w-[100px]">
                Price
              </th>
              <th className="text-left p-2 font-medium text-muted-foreground min-w-[80px]">
                Stock
              </th>
              <th className="text-center p-2 font-medium text-muted-foreground w-[70px]">
                Status
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
              />
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No variants. Edit options to generate the variant matrix.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Variant Row Component ───────────────────────────────────────────────────

interface VariantRowComponentProps {
  row: VariantRow;
  sortedOptions: DraftOption[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (patch: VariantRowPatch) => void;
  errors: Record<string, string>;
}

function VariantRowComponent({
  row,
  sortedOptions,
  isExpanded,
  onToggleExpand,
  onUpdate,
  errors,
}: VariantRowComponentProps) {
  const statusBadge = {
    persisted: { label: 'Saved', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    new: { label: 'New', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    modified: { label: 'Modified', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    removed: { label: 'Removed', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  }[row.status];

  const handleFieldChange = useCallback(
    (field: keyof VariantRowPatch, value: string | number | boolean | null) => {
      onUpdate({ [field]: value } as VariantRowPatch);
    },
    [onUpdate],
  );

  return (
    <>
      <tr className={cn(
        'border-b transition-colors hover:bg-muted/30',
        row.status === 'new' && 'bg-blue-50/30 dark:bg-blue-950/10',
        row.status === 'modified' && 'bg-amber-50/30 dark:bg-amber-950/10',
      )}>
        {/* Option value columns */}
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

        {/* Name */}
        <td className="p-2">
          <CellInput
            value={row.name}
            error={errors[`${row.localId}.name`]}
            onChange={(v) => handleFieldChange('name', v)}
          />
        </td>

        {/* SKU */}
        <td className="p-2">
          <CellInput
            value={row.sku}
            error={errors[`${row.localId}.sku`]}
            onChange={(v) => handleFieldChange('sku', v)}
            mono
          />
        </td>

        {/* Price */}
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

        {/* Stock */}
        <td className="p-2">
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
        </td>

        {/* Status */}
        <td className="p-2 text-center">
          <Badge variant="outline" className={cn('text-xs', statusBadge.className)}>
            {statusBadge.label}
          </Badge>
        </td>

        {/* Expand toggle */}
        <td className="p-2 text-right">
          <button
            onClick={onToggleExpand}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded px-1.5 py-1 hover:bg-muted"
          >
            <span>{isExpanded ? 'Less' : 'More'}</span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
                isExpanded && 'rotate-180',
              )}
            />
          </button>
        </td>
      </tr>

      {/* Expanded Row - Secondary Fields */}
      {isExpanded && (
        <tr className="border-b bg-muted/20">
          <td colSpan={sortedOptions.length + 6} className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl">
              <div className="space-y-1">
                <Label className="text-xs">Compare at Price</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={row.compareAtPrice ?? ''}
                  onChange={(e) =>
                    handleFieldChange(
                      'compareAtPrice',
                      e.target.value ? parseFloat(e.target.value) : 0,
                    )
                  }
                  className="h-8 text-sm"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Weight (g)</Label>
                <Input
                  type="number"
                  min={0}
                  value={row.weight ?? ''}
                  onChange={(e) =>
                    handleFieldChange('weight', e.target.value ? parseInt(e.target.value, 10) : 0)
                  }
                  className="h-8 text-sm"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Length (cm)</Label>
                <Input
                  type="number"
                  min={0}
                  value={row.length ?? ''}
                  onChange={(e) =>
                    handleFieldChange('length', e.target.value ? parseInt(e.target.value, 10) : 0)
                  }
                  className="h-8 text-sm"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Width (cm)</Label>
                <Input
                  type="number"
                  min={0}
                  value={row.width ?? ''}
                  onChange={(e) =>
                    handleFieldChange('width', e.target.value ? parseInt(e.target.value, 10) : 0)
                  }
                  className="h-8 text-sm"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Height (cm)</Label>
                <Input
                  type="number"
                  min={0}
                  value={row.height ?? ''}
                  onChange={(e) =>
                    handleFieldChange('height', e.target.value ? parseInt(e.target.value, 10) : 0)
                  }
                  className="h-8 text-sm"
                  placeholder="0"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={row.isInfiniteStock}
                  onCheckedChange={(checked) =>
                    handleFieldChange('isInfiniteStock', checked)
                  }
                />
                <Label className="text-xs">Infinite Stock</Label>
              </div>

              {/* PATCH-only fields — only show for persisted variants */}
              {row.serverId && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs">Low Stock Alert</Label>
                    <Input
                      type="number"
                      min={1}
                      value={row.lowStockThreshold ?? ''}
                      onChange={(e) =>
                        handleFieldChange(
                          'lowStockThreshold',
                          e.target.value ? parseInt(e.target.value, 10) : null,
                        )
                      }
                      className="h-8 text-sm"
                      placeholder="None"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={row.allowOversell ?? false}
                      onCheckedChange={(checked) =>
                        handleFieldChange('allowOversell', checked)
                      }
                    />
                    <Label className="text-xs">Allow Oversell</Label>
                  </div>
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Cell Input ──────────────────────────────────────────────────────────────

interface CellInputProps {
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: 'text' | 'number';
  mono?: boolean;
  min?: number;
  step?: string;
}

function CellInput({
  value,
  error,
  onChange,
  type = 'text',
  mono,
  min,
  step,
}: CellInputProps) {
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
  };

  const handleBlur = () => {
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type={type}
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        min={min}
        step={step}
        className={cn(
          'h-7 text-xs',
          mono && 'font-mono',
          error && 'border-destructive focus-visible:ring-destructive',
        )}
      />
      {error && (
        <p className="absolute -bottom-4 left-0 text-[10px] text-destructive whitespace-nowrap">
          {error}
        </p>
      )}
    </div>
  );
}
