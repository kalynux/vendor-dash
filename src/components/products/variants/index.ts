// ─── Variant Builder Module ───────────────────────────────────────────────────
// Barrel export for all variant builder components, hooks, types, and utilities.

// Types
export type {
  DraftOption,
  DraftOptionValue,
  ComboValue,
  VariantCombo,
  VariantRow,
  VariantRowPatch,
  VariantRowStatus,
  VariantRowOriginals,
  ReconciliationResult,
  BuilderPhase,
  VariantBuilderState,
  VariantBuilderAction,
} from './variant.types';

// Engine (pure utilities)
export {
  generateCartesianProduct,
  buildComboSignature,
  reconcileVariants,
  buildVariantName,
  generateAutoSku,
  validateVariantRows,
  countActiveCombinations,
  inferDefaultPrice,
  normalizeServerOptions,
  normalizeServerVariants,
  diffVariantRow,
  MAX_OPTIONS,
  MAX_VARIANTS,
  MAX_VALUES_PER_BULK,
} from './variant.engine';

// Reducer
export { variantBuilderReducer, INITIAL_STATE } from './variant.reducer';

// Hook
export { useVariantBuilder } from './useVariantBuilder';
export type { UseVariantBuilderReturn } from './useVariantBuilder';

// Payloads
export {
  buildPhase1Payload,
  buildPhase2Payload,
  computeNameUpdatesForRenames,
} from './variant.payloads';
export type {
  VariantPhase1Payload,
  VariantPhase2Payload,
  VariantCreateEntry,
  VariantUpdateEntry,
  VariantNameUpdateEntry,
} from './variant.payloads';

// UI Components
export { OptionBuilderPanel } from './OptionBuilderPanel';
export { VariantTable } from './VariantTable';
export { RegenerateDialog } from './RegenerateDialog';
