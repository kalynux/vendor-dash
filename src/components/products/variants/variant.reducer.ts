// ─── Variant Builder Reducer ──────────────────────────────────────────────────
// Pure state machine. No side effects. No async. No API calls.

import type {
  VariantBuilderState,
  VariantBuilderAction,
  VariantRow,
  VariantRowPatch,
} from './variant.types';
import {
  normalizeServerOptions,
  normalizeServerVariants,
  generateCartesianProduct,
  reconcileVariants,
  buildVariantName,
  buildComboSignature,
  generateAutoSku,
  inferDefaultPrice,
  countActiveCombinations,
} from './variant.engine';

// ─── Initial State ───────────────────────────────────────────────────────────

export const INITIAL_STATE: VariantBuilderState = {
  phase: 'options',
  options: [],
  matrix: [],
  skuPrefix: '',
  pendingReconciliation: null,
  rowErrors: {},
  isDirty: false,
  serverSnapshot: {
    options: [],
    variants: [],
  },
};

// ─── Reducer ─────────────────────────────────────────────────────────────────

export function variantBuilderReducer(
  state: VariantBuilderState,
  action: VariantBuilderAction,
): VariantBuilderState {
  switch (action.type) {
    // ── Hydration ──────────────────────────────────────────────────────────
    case 'HYDRATE': {
      const options = normalizeServerOptions(action.serverOptions);
      const matrix = normalizeServerVariants(action.serverVariants, options);
      const hasOptionsAndVariants = options.length > 0 && matrix.length > 0;

      return {
        ...INITIAL_STATE,
        phase: hasOptionsAndVariants ? 'matrix' : 'options',
        options,
        matrix,
        serverSnapshot: {
          options: action.serverOptions,
          variants: action.serverVariants,
        },
      };
    }

    // ── Option Mutations ──────────────────────────────────────────────────

    case 'ADD_OPTION': {
      if (state.options.length >= 3) return state; // max 3 options enforced

      const newPosition = state.options.length + 1;
      const initialValues = (action.initialValues ?? []).map((v) => ({
        localId: crypto.randomUUID(),
        value: v,
      }));

      return {
        ...state,
        isDirty: true,
        options: [
          ...state.options,
          {
            localId: crypto.randomUUID(),
            name: action.name,
            position: newPosition,
            values: initialValues,
          },
        ],
      };
    }

    case 'REMOVE_OPTION': {
      const filtered = state.options.filter((o) => o.localId !== action.localId);
      // Reindex positions
      const reindexed = filtered.map((o, i) => ({ ...o, position: i + 1 }));

      return {
        ...state,
        isDirty: true,
        options: reindexed,
      };
    }

    case 'RENAME_OPTION': {
      return {
        ...state,
        isDirty: true,
        options: state.options.map((o) => {
          if (o.localId !== action.localId) return o;
          return {
            ...o,
            name: action.name,
            // Track original only on first rename (preserve server baseline)
            originalName: o.originalName ?? o.name,
          };
        }),
      };
    }

    // ── Value Mutations ───────────────────────────────────────────────────

    case 'ADD_VALUE': {
      return {
        ...state,
        isDirty: true,
        options: state.options.map((o) => {
          if (o.localId !== action.optionLocalId) return o;
          // Case-insensitive uniqueness check — mirrors backend behavior
          const exists = o.values.some(
            (v) => v.value.toLowerCase() === action.value.toLowerCase(),
          );
          if (exists) return o; // silently skip duplicate
          return {
            ...o,
            values: [
              ...o.values,
              {
                localId: crypto.randomUUID(),
                value: action.value,
              },
            ],
          };
        }),
      };
    }

    case 'REMOVE_VALUE': {
      return {
        ...state,
        isDirty: true,
        options: state.options.map((o) => {
          if (o.localId !== action.optionLocalId) return o;
          return {
            ...o,
            values: o.values.filter((v) => v.localId !== action.valueLocalId),
          };
        }),
      };
    }

    case 'RENAME_VALUE': {
      return {
        ...state,
        isDirty: true,
        options: state.options.map((o) => {
          if (o.localId !== action.optionLocalId) return o;
          return {
            ...o,
            values: o.values.map((v) => {
              if (v.localId !== action.valueLocalId) return v;
              return {
                ...v,
                value: action.newValue,
                // Track original only on first rename
                originalValue: v.originalValue ?? v.value,
              };
            }),
          };
        }),
      };
    }

    // ── Reordering ────────────────────────────────────────────────────────

    case 'REORDER_OPTIONS': {
      const idToOption = new Map(state.options.map((o) => [o.localId, o]));
      const reordered = action.orderedLocalIds
        .map((id, i) => {
          const opt = idToOption.get(id);
          if (!opt) return null;
          return { ...opt, position: i + 1 };
        })
        .filter((o): o is NonNullable<typeof o> => o !== null);

      return {
        ...state,
        isDirty: true,
        options: reordered,
      };
    }

    // ── SKU Prefix ────────────────────────────────────────────────────────

    case 'SET_SKU_PREFIX': {
      return {
        ...state,
        skuPrefix: action.prefix,
      };
    }

    // ── Regeneration Flow ─────────────────────────────────────────────────

    case 'PROPOSE_REGENERATION': {
      const newCombos = generateCartesianProduct(state.options);
      const result = reconcileVariants(newCombos, state.matrix);

      return {
        ...state,
        phase: 'confirming',
        pendingReconciliation: result,
      };
    }

    case 'CONFIRM_REGENERATION': {
      const recon = state.pendingReconciliation;
      if (!recon) return state;

      const defaultPrice = inferDefaultPrice(state.matrix);

      // Build new matrix: kept rows + new rows from toCreate
      const keptRows = recon.kept;
      const newRows: VariantRow[] = recon.toCreate.map((combo) => ({
        localId: crypto.randomUUID(),
        combo,
        status: 'new' as const,
        sku: generateAutoSku(combo.comboValues, state.skuPrefix || undefined),
        name: buildVariantName(combo.comboValues),
        price: defaultPrice,
        stock: 0,
        isInfiniteStock: false,
        dirtyFields: new Set<string>(),
      }));

      return {
        ...state,
        phase: 'matrix',
        matrix: [...keptRows, ...newRows],
        pendingReconciliation: null,
        rowErrors: {},
      };
    }

    case 'CANCEL_REGENERATION': {
      return {
        ...state,
        phase: 'options',
        pendingReconciliation: null,
      };
    }

    case 'SWITCH_TO_OPTIONS': {
      return {
        ...state,
        phase: 'options',
      };
    }

    // ── Row Mutations ─────────────────────────────────────────────────────

    case 'UPDATE_ROW': {
      const patchedKeys = Object.keys(action.patch) as (keyof VariantRowPatch)[];
      const nextErrors = clearErrorsForFields(state.rowErrors, action.localId, patchedKeys);

      return {
        ...state,
        isDirty: true,
        rowErrors: nextErrors,
        matrix: state.matrix.map((r) => {
          if (r.localId !== action.localId) return r;
          const updated: VariantRow = { ...r, ...action.patch };
          // Track dirty fields
          const dirtyFields = new Set(r.dirtyFields);
          for (const key of patchedKeys) {
            dirtyFields.add(key);
          }
          updated.dirtyFields = dirtyFields;
          // Promote persisted → modified on first edit
          if (r.status === 'persisted') {
            updated.status = 'modified';
          }
          return updated;
        }),
      };
    }

    case 'BULK_UPDATE_ROWS': {
      const affectedRowIds = state.matrix
        .filter((r) => r.status !== 'removed')
        .map((r) => r.localId);
      const nextErrors = clearErrorsForFieldAcrossRows(
        state.rowErrors,
        affectedRowIds,
        action.field,
      );

      return {
        ...state,
        isDirty: true,
        rowErrors: nextErrors,
        matrix: state.matrix.map((r) => {
          if (r.status === 'removed') return r;
          const updated: VariantRow = { ...r, [action.field]: action.value };
          const dirtyFields = new Set(r.dirtyFields);
          dirtyFields.add(action.field);
          updated.dirtyFields = dirtyFields;
          if (r.status === 'persisted') {
            updated.status = 'modified';
          }
          return updated;
        }),
      };
    }

    // ── Validation ────────────────────────────────────────────────────────

    case 'SET_ROW_ERRORS': {
      return { ...state, rowErrors: action.errors };
    }

    case 'CLEAR_ROW_ERRORS': {
      return { ...state, rowErrors: {} };
    }

    // ── Auto-SKU ──────────────────────────────────────────────────────────

    case 'AUTO_GENERATE_SKUS': {
      const prefix = state.skuPrefix || undefined;
      return {
        ...state,
        isDirty: true,
        matrix: state.matrix.map((r) => {
          if (r.status === 'removed') return r;
          // Only overwrite if SKU is empty or was auto-generated
          if (r.sku.trim() === '' || r.status === 'new') {
            const newSku = generateAutoSku(r.combo.comboValues, prefix);
            const dirtyFields = new Set(r.dirtyFields);
            dirtyFields.add('sku');
            return {
              ...r,
              sku: newSku,
              dirtyFields,
              status: r.status === 'persisted' ? 'modified' as const : r.status,
            };
          }
          return r;
        }),
      };
    }

    // ── Post-Save State Updates ───────────────────────────────────────────

    case 'MARK_SAVED': {
      return {
        ...state,
        isDirty: false,
        matrix: state.matrix
          .filter((r) => r.status !== 'removed')
          .map((r) => ({
            ...r,
            status: 'persisted' as const,
            dirtyFields: new Set<string>(),
          })),
      };
    }

    case 'SYNC_SERVER_STATE': {
      // Reconcile fresh server state into the existing draft WITHOUT resetting
      // UI phase, skuPrefix, pendingReconciliation, isDirty, or rowErrors.
      //
      // Responsibilities:
      //   1. Update `serverSnapshot` so diff-based PATCH stays accurate.
      //   2. Attach freshly-issued serverIds to draft options/values that were
      //      created locally and have just been saved.
      //   3. Refresh `valueServerId` inside matrix combos.
      //   4. Promote 'new' rows to 'persisted' when a server variant now exists
      //      for their signature (post Phase-2 save).
      const normalizedServerOptions = normalizeServerOptions(action.serverOptions);

      // ── Merge serverIds into existing draft options ────────────────────
      const mergedOptions = state.options.map((local) => {
        const match =
          (local.serverId &&
            normalizedServerOptions.find((s) => s.serverId === local.serverId)) ||
          normalizedServerOptions.find((s) => s.name === local.name);
        if (!match) return local;

        return {
          ...local,
          serverId: match.serverId,
          originalName: match.name,
          values: local.values.map((localVal) => {
            const valMatch =
              (localVal.serverId &&
                match.values.find((sv) => sv.serverId === localVal.serverId)) ||
              match.values.find((sv) => sv.value === localVal.value);
            if (!valMatch) return localVal;
            return {
              ...localVal,
              serverId: valMatch.serverId,
              originalValue: valMatch.value,
            };
          }),
        };
      });

      // Append server options that have no local counterpart (defensive — e.g.
      // an admin added an option in another session).
      for (const serverOpt of normalizedServerOptions) {
        const present = mergedOptions.some((o) => o.serverId === serverOpt.serverId);
        if (!present) mergedOptions.push(serverOpt);
      }

      // ── Build lookups for matrix reconciliation ────────────────────────
      const valueServerIdByLocalId = new Map<string, string>();
      for (const opt of mergedOptions) {
        for (const val of opt.values) {
          if (val.serverId) valueServerIdByLocalId.set(val.localId, val.serverId);
        }
      }

      const serverRows = normalizeServerVariants(action.serverVariants, mergedOptions);
      const serverRowBySignature = new Map(serverRows.map((r) => [r.combo.signature, r]));

      // ── Refresh combo serverIds + mark persisted rows ──────────────────
      const updatedMatrix = state.matrix.map((row) => {
        const refreshedComboValues = row.combo.comboValues.map((cv) => ({
          ...cv,
          valueServerId: valueServerIdByLocalId.get(cv.valueLocalId) ?? cv.valueServerId,
        }));
        const refreshedCombo = {
          comboValues: refreshedComboValues,
          signature: buildComboSignature(refreshedComboValues),
        };

        const serverRow = serverRowBySignature.get(refreshedCombo.signature);
        if (!serverRow) {
          return { ...row, combo: refreshedCombo };
        }

        // Server now has this variant — promote to persisted with server data.
        return {
          ...row,
          combo: refreshedCombo,
          serverId: serverRow.serverId,
          status: 'persisted' as const,
          originalValues: serverRow.originalValues,
          dirtyFields: new Set<string>(),
        };
      });

      return {
        ...state,
        options: mergedOptions,
        matrix: updatedMatrix,
        serverSnapshot: {
          options: action.serverOptions,
          variants: action.serverVariants,
        },
        // Preserved: phase, skuPrefix, pendingReconciliation, isDirty, rowErrors
      };
    }

    default: {
      // Exhaustiveness check — TypeScript will error if a case is missing
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

// ─── Error Helpers ───────────────────────────────────────────────────────────

function clearErrorsForFields(
  errors: Record<string, string>,
  rowLocalId: string,
  fields: readonly (keyof VariantRowPatch)[],
): Record<string, string> {
  if (fields.length === 0) return errors;
  let next: Record<string, string> | null = null;
  for (const field of fields) {
    const key = `${rowLocalId}.${String(field)}`;
    if (key in errors) {
      if (next === null) next = { ...errors };
      delete next[key];
    }
  }
  return next ?? errors;
}

function clearErrorsForFieldAcrossRows(
  errors: Record<string, string>,
  rowLocalIds: readonly string[],
  field: string,
): Record<string, string> {
  if (rowLocalIds.length === 0) return errors;
  let next: Record<string, string> | null = null;
  for (const rowLocalId of rowLocalIds) {
    const key = `${rowLocalId}.${field}`;
    if (key in errors) {
      if (next === null) next = { ...errors };
      delete next[key];
    }
  }
  return next ?? errors;
}

// ─── Derived State Helpers (used by useVariantBuilder selectors) ──────────────

export function selectVisibleRows(state: VariantBuilderState): VariantRow[] {
  return state.matrix.filter((r) => r.status !== 'removed');
}

export function selectRowCountsByStatus(state: VariantBuilderState) {
  let newCount = 0;
  let modifiedCount = 0;
  let persistedCount = 0;
  for (const r of state.matrix) {
    if (r.status === 'new') newCount++;
    else if (r.status === 'modified') modifiedCount++;
    else if (r.status === 'persisted') persistedCount++;
  }
  return { newCount, modifiedCount, persistedCount };
}

export function selectHasUnsavedChanges(state: VariantBuilderState): boolean {
  return state.matrix.some((r) => r.status === 'new' || r.status === 'modified');
}

export function selectAllRowsSaved(state: VariantBuilderState): boolean {
  return state.matrix.length > 0 && state.matrix.every((r) => r.status === 'persisted');
}

export function selectCombinationCount(state: VariantBuilderState): number {
  return countActiveCombinations(state.options);
}

export function selectOptionsDirty(state: VariantBuilderState): boolean {
  return state.isDirty;
}

export function selectHasRenamedOptions(state: VariantBuilderState): boolean {
  return state.options.some(
    (o) => o.serverId && o.originalName !== undefined && o.name !== o.originalName,
  );
}

export function selectHasRenamedValues(state: VariantBuilderState): boolean {
  return state.options.some((o) =>
    o.values.some(
      (v) => v.serverId && v.originalValue !== undefined && v.value !== v.originalValue,
    ),
  );
}
