// ─── Variant Builder Domain Types ─────────────────────────────────────────────
// These types define the entire variant builder's internal state model.
// They are intentionally separate from the API response types in product.types.ts.

import type { ApiProductOption, ApiVariant } from '@/types/product.types';

// ─── Option Domain ────────────────────────────────────────────────────────────

/** A single option value in the draft editor. */
export interface DraftOptionValue {
  /** Unique local identifier — crypto.randomUUID() on creation, or copied from serverId on hydration. */
  localId: string;
  /** Server-assigned ID. Set once persisted; undefined for brand-new values. */
  serverId?: string;
  /** Display string (e.g. "Black"). */
  value: string;
  /** Server value at hydration time — used for rename dirty tracking.
   *  Undefined if value was created locally (never saved). */
  originalValue?: string;
}

/** A product option in the draft editor (e.g. "Color", "Size"). */
export interface DraftOption {
  /** Unique local identifier. */
  localId: string;
  /** Server-assigned ID. Set once persisted; undefined for new options. */
  serverId?: string;
  /** Option name (e.g. "Color"). */
  name: string;
  /** Server name at hydration time — used for rename dirty tracking. */
  originalName?: string;
  /** 1-indexed display position. */
  position: number;
  /** Values belonging to this option. */
  values: DraftOptionValue[];
}

// ─── Combination Domain ──────────────────────────────────────────────────────

/** One value contribution to a variant combination. */
export interface ComboValue {
  optionLocalId: string;
  optionName: string;
  valueLocalId: string;
  valueServerId?: string;
  displayValue: string;
}

/** A single variant combination (one value per option). */
export interface VariantCombo {
  /** Combo values sorted by option position. */
  comboValues: ComboValue[];
  /** Deterministic reconciliation key — mirrors backend optionSignature when all serverIds available. */
  signature: string;
}

// ─── Variant Row Domain ──────────────────────────────────────────────────────

/** Lifecycle status of a variant row in the builder. */
export type VariantRowStatus = 'persisted' | 'new' | 'modified' | 'removed';

/** Fields that can be patched on a variant row via UPDATE_ROW action. */
export interface VariantRowPatch {
  sku?: string;
  name?: string;
  price?: number;
  compareAtPrice?: number;
  stock?: number;
  isInfiniteStock?: boolean;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  lowStockThreshold?: number | null;
  allowOversell?: boolean;
}

/** Snapshot of server values — frozen at hydration for diff-based PATCH. */
export interface VariantRowOriginals {
  sku: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  isInfiniteStock: boolean;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  lowStockThreshold?: number | null;
  allowOversell?: boolean;
}

/** A single variant row in the matrix table. */
export interface VariantRow {
  /** Unique local identifier. */
  localId: string;
  /** Server-assigned ID. Set once persisted. */
  serverId?: string;
  /** The option value combination this row represents. */
  combo: VariantCombo;
  /** Lifecycle status. */
  status: VariantRowStatus;

  // ── Fields settable on POST create ────────────────────────
  sku: string;
  /** Auto-generated from combo display values; user can override. */
  name: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  isInfiniteStock: boolean;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;

  // ── Fields settable only via PATCH after creation ─────────
  lowStockThreshold?: number | null;
  allowOversell?: boolean;

  // ── Dirty tracking ────────────────────────────────────────
  /** Set of field names that have been modified since last save/hydration. */
  dirtyFields: Set<string>;
  /** Frozen server values at hydration — used by diffVariantRow() for PATCH optimization. */
  originalValues?: VariantRowOriginals;
}

// ─── Reconciliation ──────────────────────────────────────────────────────────

/** Result of comparing new combinations against existing variant rows. */
export interface ReconciliationResult {
  /** Existing rows that match new combos — data preserved. */
  kept: VariantRow[];
  /** Persisted rows not in new combos — need to be archived. */
  toArchive: VariantRow[];
  /** New combos not in existing rows — need to be created. */
  toCreate: VariantCombo[];
  /** Total expected combo count in new matrix. */
  totalExpected: number;
}

// ─── State Machine ───────────────────────────────────────────────────────────

/** Builder phase — controls which UI panel is rendered. */
export type BuilderPhase = 'options' | 'confirming' | 'matrix';

/** Complete state of the variant builder. */
export interface VariantBuilderState {
  /** Current UI phase. */
  phase: BuilderPhase;
  /** Draft options being edited. */
  options: DraftOption[];
  /** Variant rows in the matrix table. */
  matrix: VariantRow[];
  /** Product-level SKU prefix (e.g. "TSHIRT"). */
  skuPrefix: string;
  /** Pending reconciliation result — shown in confirmation dialog. */
  pendingReconciliation: ReconciliationResult | null;
  /** Per-cell validation errors. Key format: "localId.fieldName". */
  rowErrors: Record<string, string>;
  /** True if any state differs from serverSnapshot. */
  isDirty: boolean;
  /** Frozen server state at hydration — used for stable diffing. */
  serverSnapshot: {
    options: ApiProductOption[];
    variants: ApiVariant[];
  };
}

// ─── Reducer Actions ─────────────────────────────────────────────────────────

export type VariantBuilderAction =
  | { type: 'HYDRATE'; serverOptions: ApiProductOption[]; serverVariants: ApiVariant[] }
  | { type: 'ADD_OPTION'; name: string; initialValues?: string[] }
  | { type: 'REMOVE_OPTION'; localId: string }
  | { type: 'RENAME_OPTION'; localId: string; name: string }
  | { type: 'ADD_VALUE'; optionLocalId: string; value: string }
  | { type: 'REMOVE_VALUE'; optionLocalId: string; valueLocalId: string }
  | { type: 'RENAME_VALUE'; optionLocalId: string; valueLocalId: string; newValue: string }
  | { type: 'REORDER_OPTIONS'; orderedLocalIds: string[] }
  | { type: 'SET_SKU_PREFIX'; prefix: string }
  | { type: 'PROPOSE_REGENERATION' }
  | { type: 'CONFIRM_REGENERATION' }
  | { type: 'CANCEL_REGENERATION' }
  | { type: 'SWITCH_TO_OPTIONS' }
  | { type: 'UPDATE_ROW'; localId: string; patch: VariantRowPatch }
  | { type: 'BULK_UPDATE_ROWS'; field: string; value: unknown }
  | { type: 'SET_ROW_ERRORS'; errors: Record<string, string> }
  | { type: 'CLEAR_ROW_ERRORS' }
  | { type: 'AUTO_GENERATE_SKUS' }
  | { type: 'MARK_SAVED' }
  | { type: 'SYNC_SERVER_STATE'; serverOptions: ApiProductOption[]; serverVariants: ApiVariant[] };
