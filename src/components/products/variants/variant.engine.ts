// ─── Variant Engine ───────────────────────────────────────────────────────────
// All functions are pure, deterministic, side-effect-free, and unit-testable.
// No imports from React. No API calls. No state mutations.

import type {
  ApiProductOption,
  ApiVariant,
  UpdateVariantPayload,
} from '@/types/product.types';
import type {
  DraftOption,
  DraftOptionValue,
  ComboValue,
  VariantCombo,
  VariantRow,
  VariantRowOriginals,
  ReconciliationResult,
} from './variant.types';

// ─── Constants ────────────────────────────────────────────────────────────────

export const MAX_OPTIONS = 3;
export const MAX_VALUES_PER_BULK = 50;
export const MAX_VARIANTS = 1000;

// ─── Cartesian Product ───────────────────────────────────────────────────────

/**
 * Generate the full cartesian product of all option values.
 * Options are sorted by position to ensure deterministic combo ordering.
 */
export function generateCartesianProduct(options: DraftOption[]): VariantCombo[] {
  const sorted = [...options].sort((a, b) => a.position - b.position);

  // Filter out options with no values — they don't contribute to the matrix
  const optionsWithValues = sorted.filter((o) => o.values.length > 0);
  if (optionsWithValues.length === 0) return [];

  const valueArrays: { option: DraftOption; value: DraftOptionValue }[][] =
    optionsWithValues.map((opt) =>
      opt.values.map((val) => ({ option: opt, value: val })),
    );

  // Cartesian product via reduce
  const combos: { option: DraftOption; value: DraftOptionValue }[][] =
    valueArrays.reduce<{ option: DraftOption; value: DraftOptionValue }[][]>(
      (acc, arr) => acc.flatMap((combo) => arr.map((item) => [...combo, item])),
      [[]],
    );

  return combos.map((combo) => {
    const comboValues: ComboValue[] = combo.map((item) => ({
      optionLocalId: item.option.localId,
      optionName: item.option.name,
      valueLocalId: item.value.localId,
      valueServerId: item.value.serverId,
      displayValue: item.value.value,
    }));

    return {
      comboValues,
      signature: buildComboSignature(comboValues),
    };
  });
}

// ─── Signature ───────────────────────────────────────────────────────────────

/**
 * Build a deterministic signature for a variant combination.
 * When all values have server IDs, produces a sorted pipe-joined string
 * that exactly mirrors the backend's optionSignature computation.
 */
export function buildComboSignature(comboValues: ComboValue[]): string {
  const allHaveServerIds = comboValues.every((cv) => !!cv.valueServerId);
  if (allHaveServerIds) {
    return comboValues
      .map((cv) => cv.valueServerId!)
      .sort()
      .join('|');
  }
  // Fallback for mixed/new combos — deterministic but not comparable to backend
  return comboValues
    .map((cv) => `${cv.valueLocalId}:${cv.displayValue}`)
    .sort()
    .join('|');
}

// ─── Reconciliation ──────────────────────────────────────────────────────────

/**
 * Reconcile new combinations against existing variant rows.
 * This is the core algorithm that determines what to keep, archive, and create.
 *
 * Matching is based on combo signatures (sorted optionValueIds), NOT array order.
 */
export function reconcileVariants(
  newCombos: VariantCombo[],
  existingRows: VariantRow[],
): ReconciliationResult {
  const expectedMap = new Map<string, VariantCombo>();
  for (const combo of newCombos) {
    expectedMap.set(combo.signature, combo);
  }

  const existingMap = new Map<string, VariantRow>();
  for (const row of existingRows) {
    if (row.status !== 'removed') {
      existingMap.set(row.combo.signature, row);
    }
  }

  const kept: VariantRow[] = [];
  const toArchive: VariantRow[] = [];
  const toCreate: VariantCombo[] = [];

  // Existing rows: keep if signature matches expected, archive otherwise
  for (const [sig, row] of existingMap) {
    if (expectedMap.has(sig)) {
      // Update the combo to the new one (option names may have changed via rename)
      kept.push({
        ...row,
        combo: expectedMap.get(sig)!,
      });
    } else {
      toArchive.push(row);
    }
  }

  // New combos: create if signature not in existing
  for (const [sig, combo] of expectedMap) {
    if (!existingMap.has(sig)) {
      toCreate.push(combo);
    }
  }

  return {
    kept,
    toArchive,
    toCreate,
    totalExpected: newCombos.length,
  };
}

// ─── Name & SKU Generators ───────────────────────────────────────────────────

/** Build a human-readable variant name from combo values (e.g. "Black / Medium"). */
export function buildVariantName(comboValues: ComboValue[]): string {
  return comboValues.map((cv) => cv.displayValue).join(' / ');
}

/** Convert a display value to a short acronym for SKU generation. */
function toAcronym(value: string): string {
  const trimmed = value.trim().toUpperCase();
  // Single word ≤ 4 chars: use as-is (S, M, L, XL, XXL)
  if (!trimmed.includes(' ') && trimmed.length <= 4) return trimmed;
  // Multi-word: take first letter of each word
  const words = trimmed.split(/\s+/);
  if (words.length > 1) return words.map((w) => w[0]).join('');
  // Long single word: take first 3 chars
  return trimmed.slice(0, 3);
}

/** Generate an auto-SKU from combo values with an optional prefix. */
export function generateAutoSku(
  comboValues: ComboValue[],
  prefix?: string,
): string {
  const segments = comboValues.map((cv) => toAcronym(cv.displayValue));
  const body = segments.join('-');
  return prefix ? `${prefix}-${body}` : body;
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validate all visible (non-removed) variant rows.
 * Returns a map of errors keyed by "localId.fieldName".
 */
export function validateVariantRows(
  rows: VariantRow[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  const visibleRows = rows.filter((r) => r.status !== 'removed');
  const seenSkus = new Map<string, string>(); // sku → localId of first occurrence

  for (const row of visibleRows) {
    // SKU required
    if (!row.sku.trim()) {
      errors[`${row.localId}.sku`] = 'SKU is required';
    } else {
      // SKU uniqueness within the matrix
      const lower = row.sku.trim().toLowerCase();
      const firstOwner = seenSkus.get(lower);
      if (firstOwner && firstOwner !== row.localId) {
        errors[`${row.localId}.sku`] = 'Duplicate SKU';
      } else {
        seenSkus.set(lower, row.localId);
      }
    }

    // Price > 0 required for activation (warn at 0)
    if (row.price < 0) {
      errors[`${row.localId}.price`] = 'Price cannot be negative';
    } else if (row.price === 0) {
      errors[`${row.localId}.price`] = 'Price must be greater than 0 to publish';
    }

    // Stock must be >= 0
    if (!row.isInfiniteStock && row.stock < 0) {
      errors[`${row.localId}.stock`] = 'Stock cannot be negative';
    }

    // Compare at price should be > price if set
    if (
      row.compareAtPrice !== undefined &&
      row.compareAtPrice > 0 &&
      row.compareAtPrice <= row.price
    ) {
      errors[`${row.localId}.compareAtPrice`] =
        'Compare at price should be higher than selling price';
    }
  }

  return errors;
}

// ─── Combination Count ───────────────────────────────────────────────────────

/** Count the total combinations that would be generated from current options. */
export function countActiveCombinations(options: DraftOption[]): number {
  const withValues = options.filter((o) => o.values.length > 0);
  if (withValues.length === 0) return 0;
  return withValues.reduce((acc, opt) => acc * opt.values.length, 1);
}

// ─── Default Price ───────────────────────────────────────────────────────────

/** Infer a default price for new variants from existing persisted rows. */
export function inferDefaultPrice(rows: VariantRow[]): number {
  const prices = rows
    .filter((r) => (r.status === 'persisted' || r.status === 'modified') && r.price > 0)
    .map((r) => r.price);
  if (prices.length === 0) return 0;
  return Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100;
}

// ─── Server Normalization ────────────────────────────────────────────────────

/** Convert server option data into DraftOption format for the builder. */
export function normalizeServerOptions(
  apiOptions: ApiProductOption[],
): DraftOption[] {
  return [...apiOptions]
    .sort((a, b) => a.position - b.position)
    .map((opt) => ({
      localId: opt.id, // use server ID as local ID for hydration
      serverId: opt.id,
      name: opt.name,
      originalName: opt.name,
      position: opt.position,
      values: opt.values.map((val) => ({
        localId: val.id,
        serverId: val.id,
        value: val.value,
        originalValue: val.value,
      })),
    }));
}

/** Convert server variant data into VariantRow format for the builder. */
export function normalizeServerVariants(
  apiVariants: ApiVariant[],
  draftOptions: DraftOption[],
): VariantRow[] {
  // Build a lookup: valueServerId → { optionLocalId, optionName, value }
  const valueLookup = new Map<
    string,
    { optionLocalId: string; optionName: string; value: DraftOptionValue; position: number }
  >();
  for (const opt of draftOptions) {
    for (const val of opt.values) {
      if (val.serverId) {
        valueLookup.set(val.serverId, {
          optionLocalId: opt.localId,
          optionName: opt.name,
          value: val,
          position: opt.position,
        });
      }
    }
  }

  return apiVariants
    .filter((v) => v.status === 'active')
    .map((variant) => {
      const comboValues: ComboValue[] = variant.optionValueIds
        .map((valId): ComboValue | null => {
          const lookup = valueLookup.get(valId);
          if (!lookup) return null;
          return {
            optionLocalId: lookup.optionLocalId,
            optionName: lookup.optionName,
            valueLocalId: lookup.value.localId,
            valueServerId: lookup.value.serverId,
            displayValue: lookup.value.value,
          };
        })
        .filter((cv): cv is ComboValue => cv !== null)
        .sort((a, b) => {
          const posA = draftOptions.find((o) => o.localId === a.optionLocalId)?.position ?? 0;
          const posB = draftOptions.find((o) => o.localId === b.optionLocalId)?.position ?? 0;
          return posA - posB;
        });

      const combo: VariantCombo = {
        comboValues,
        signature: buildComboSignature(comboValues),
      };

      const originals: VariantRowOriginals = {
        sku: variant.sku,
        name: variant.name ?? buildVariantName(comboValues),
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        stock: variant.stock,
        isInfiniteStock: variant.isInfiniteStock,
        weight: variant.weight,
        length: variant.length,
        width: variant.width,
        height: variant.height,
        lowStockThreshold: variant.lowStockThreshold,
        allowOversell: variant.allowOversell,
      };

      const row: VariantRow = {
        localId: variant.id,
        serverId: variant.id,
        combo,
        status: 'persisted',
        sku: variant.sku,
        name: variant.name ?? buildVariantName(comboValues),
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        stock: variant.stock,
        isInfiniteStock: variant.isInfiniteStock,
        weight: variant.weight,
        length: variant.length,
        width: variant.width,
        height: variant.height,
        lowStockThreshold: variant.lowStockThreshold,
        allowOversell: variant.allowOversell,
        dirtyFields: new Set(),
        originalValues: originals,
      };

      return row;
    });
}

// ─── Diff ────────────────────────────────────────────────────────────────────

/**
 * Compute the minimal diff between a VariantRow and its originalValues.
 * Returns only changed fields for a PATCH payload, or null if nothing changed.
 */
export function diffVariantRow(
  row: VariantRow,
): Partial<UpdateVariantPayload> | null {
  if (!row.originalValues) return null;

  const diff: Partial<UpdateVariantPayload> = {};
  const o = row.originalValues;

  if (row.sku !== o.sku) diff.sku = row.sku;
  if (row.name !== o.name) diff.name = row.name;
  if (row.price !== o.price) diff.price = row.price;
  if (row.compareAtPrice !== o.compareAtPrice) diff.compareAtPrice = row.compareAtPrice;
  if (row.stock !== o.stock) diff.stock = row.stock;
  if (row.isInfiniteStock !== o.isInfiniteStock) diff.isInfiniteStock = row.isInfiniteStock;
  if (row.weight !== o.weight) diff.weight = row.weight;
  if (row.length !== o.length) diff.length = row.length;
  if (row.width !== o.width) diff.width = row.width;
  if (row.height !== o.height) diff.height = row.height;
  if (row.lowStockThreshold !== o.lowStockThreshold) diff.lowStockThreshold = row.lowStockThreshold;
  if (row.allowOversell !== o.allowOversell) diff.allowOversell = row.allowOversell;

  return Object.keys(diff).length > 0 ? diff : null;
}
