// ─── Variant Builder Hook ─────────────────────────────────────────────────────
// Thin wrapper over the reducer. Exposes typed actions and memoized selectors.

import { useReducer, useMemo, useEffect, useRef } from 'react';
import type { ApiProductOption, ApiVariant } from '@/types/product.types';
import type { VariantBuilderState, VariantRowPatch } from './variant.types';
import {
  variantBuilderReducer,
  INITIAL_STATE,
  selectVisibleRows,
  selectRowCountsByStatus,
  selectHasUnsavedChanges,
  selectAllRowsSaved,
  selectCombinationCount,
  selectOptionsDirty,
  selectHasRenamedOptions,
  selectHasRenamedValues,
} from './variant.reducer';
import { MAX_VARIANTS } from './variant.engine';

// ─── Return Type ─────────────────────────────────────────────────────────────

export interface UseVariantBuilderReturn {
  state: VariantBuilderState;
  actions: {
    addOption: (name: string, initialValues?: string[]) => void;
    removeOption: (localId: string) => void;
    renameOption: (localId: string, name: string) => void;
    addValue: (optionLocalId: string, value: string) => void;
    removeValue: (optionLocalId: string, valueLocalId: string) => void;
    renameValue: (optionLocalId: string, valueLocalId: string, newValue: string) => void;
    reorderOptions: (orderedLocalIds: string[]) => void;
    setSkuPrefix: (prefix: string) => void;
    proposeRegeneration: () => void;
    confirmRegeneration: () => void;
    cancelRegeneration: () => void;
    switchToOptions: () => void;
    updateRow: (localId: string, patch: VariantRowPatch) => void;
    bulkUpdateRows: (field: string, value: unknown) => void;
    autoGenerateSkus: () => void;
    setRowErrors: (errors: Record<string, string>) => void;
    clearRowErrors: () => void;
    markSaved: () => void;
    syncServerState: (serverOptions: ApiProductOption[], serverVariants: ApiVariant[]) => void;
  };
  selectors: {
    visibleRows: ReturnType<typeof selectVisibleRows>;
    newRowCount: number;
    modifiedRowCount: number;
    persistedRowCount: number;
    hasUnsavedChanges: boolean;
    allRowsSaved: boolean;
    combinationCount: number;
    exceedsLimit: boolean;
    optionsDirty: boolean;
    hasRenamedOptions: boolean;
    hasRenamedValues: boolean;
  };
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useVariantBuilder(
  serverOptions: ApiProductOption[],
  serverVariants: ApiVariant[],
): UseVariantBuilderReturn {
  const [state, dispatch] = useReducer(variantBuilderReducer, INITIAL_STATE);

  // HYDRATE is a true initial-load action: it fires exactly once, resetting the
  // builder from server data. Subsequent server-data updates (after Phase 1 or
  // Phase 2 saves) go through SYNC_SERVER_STATE, which merges fresh server data
  // into the draft without resetting phase, skuPrefix, or in-flight UI state.
  const hasHydrated = useRef(false);
  useEffect(() => {
    if (!hasHydrated.current) {
      hasHydrated.current = true;
      dispatch({ type: 'HYDRATE', serverOptions, serverVariants });
    } else {
      dispatch({ type: 'SYNC_SERVER_STATE', serverOptions, serverVariants });
    }
  }, [serverOptions, serverVariants]);

  // ── Actions ─────────────────────────────────────────────────────────────

  const actions = useMemo(
    () => ({
      addOption: (name: string, initialValues?: string[]) =>
        dispatch({ type: 'ADD_OPTION', name, initialValues }),

      removeOption: (localId: string) =>
        dispatch({ type: 'REMOVE_OPTION', localId }),

      renameOption: (localId: string, name: string) =>
        dispatch({ type: 'RENAME_OPTION', localId, name }),

      addValue: (optionLocalId: string, value: string) =>
        dispatch({ type: 'ADD_VALUE', optionLocalId, value }),

      removeValue: (optionLocalId: string, valueLocalId: string) =>
        dispatch({ type: 'REMOVE_VALUE', optionLocalId, valueLocalId }),

      renameValue: (optionLocalId: string, valueLocalId: string, newValue: string) =>
        dispatch({ type: 'RENAME_VALUE', optionLocalId, valueLocalId, newValue }),

      reorderOptions: (orderedLocalIds: string[]) =>
        dispatch({ type: 'REORDER_OPTIONS', orderedLocalIds }),

      setSkuPrefix: (prefix: string) =>
        dispatch({ type: 'SET_SKU_PREFIX', prefix }),

      proposeRegeneration: () =>
        dispatch({ type: 'PROPOSE_REGENERATION' }),

      confirmRegeneration: () =>
        dispatch({ type: 'CONFIRM_REGENERATION' }),

      cancelRegeneration: () =>
        dispatch({ type: 'CANCEL_REGENERATION' }),

      switchToOptions: () =>
        dispatch({ type: 'SWITCH_TO_OPTIONS' }),

      updateRow: (localId: string, patch: VariantRowPatch) =>
        dispatch({ type: 'UPDATE_ROW', localId, patch }),

      bulkUpdateRows: (field: string, value: unknown) =>
        dispatch({ type: 'BULK_UPDATE_ROWS', field, value }),

      autoGenerateSkus: () =>
        dispatch({ type: 'AUTO_GENERATE_SKUS' }),

      setRowErrors: (errors: Record<string, string>) =>
        dispatch({ type: 'SET_ROW_ERRORS', errors }),

      clearRowErrors: () =>
        dispatch({ type: 'CLEAR_ROW_ERRORS' }),

      markSaved: () =>
        dispatch({ type: 'MARK_SAVED' }),

      syncServerState: (sOpts: ApiProductOption[], sVars: ApiVariant[]) =>
        dispatch({ type: 'SYNC_SERVER_STATE', serverOptions: sOpts, serverVariants: sVars }),
    }),
    [],
  );

  // ── Selectors ───────────────────────────────────────────────────────────

  const selectors = useMemo(() => {
    const visibleRows = selectVisibleRows(state);
    const { newCount, modifiedCount, persistedCount } = selectRowCountsByStatus(state);
    const combinationCount = selectCombinationCount(state);

    return {
      visibleRows,
      newRowCount: newCount,
      modifiedRowCount: modifiedCount,
      persistedRowCount: persistedCount,
      hasUnsavedChanges: selectHasUnsavedChanges(state),
      allRowsSaved: selectAllRowsSaved(state),
      combinationCount,
      exceedsLimit: combinationCount > MAX_VARIANTS,
      optionsDirty: selectOptionsDirty(state),
      hasRenamedOptions: selectHasRenamedOptions(state),
      hasRenamedValues: selectHasRenamedValues(state),
    };
  }, [state]);

  return { state, actions, selectors };
}
