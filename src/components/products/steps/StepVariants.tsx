// ─── Step Variants ────────────────────────────────────────────────────────────
// Orchestration component that renders the correct phase of the variant builder
// and communicates payloads to the parent wizard page for server execution.

import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  useVariantBuilder,
  OptionBuilderPanel,
  VariantTable,
  RegenerateDialog,
  buildPhase1Payload,
  buildPhase2Payload,
  computeNameUpdatesForRenames,
  validateVariantRows,
} from '@/components/products/variants';
import type {
  VariantPhase1Payload,
  VariantPhase2Payload,
} from '@/components/products/variants';
import type { WizardState, ApiProductOption } from '@/types/product.types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface StepVariantsProps {
  mode: 'create' | 'edit';
  productId: string;
  serverData: Partial<WizardState>;
  isSaving: boolean;
  stepError: string | null;
  onSaveComplete: (
    updates: Partial<WizardState> & {
      _phase1?: VariantPhase1Payload;
      _phase2?: VariantPhase2Payload;
    },
  ) => void;
  onBack: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepVariants({
  mode,
  productId: _productId,
  serverData,
  isSaving,
  stepError,
  onSaveComplete,
  onBack,
}: StepVariantsProps) {
  const serverOptions: ApiProductOption[] = serverData.serverOptions ?? [];
  const serverVariants = serverData.serverVariants ?? [];

  const { state, actions, selectors } = useVariantBuilder(serverOptions, serverVariants);

  // ── Phase 1: Propose → Confirm → Save option structure ──────────────────

  function handleConfirmRegenerate() {
    if (!state.pendingReconciliation) return;

    // Build the Phase 1 payload from current draft vs. server snapshot
    const phase1 = buildPhase1Payload(
      state.options,
      state.serverSnapshot,
      state.pendingReconciliation.toArchive,
    );

    // Emit Phase 1 payload to the orchestrator (parent wizard page).
    // The orchestrator will execute the API calls in the correct order.
    onSaveComplete({ _phase1: phase1 });

    // Optimistically apply the reconciliation locally so the UI shows the matrix
    // immediately while the orchestrator saves in the background.
    actions.confirmRegeneration();
  }

  // ── Phase 2: Save variant rows ──────────────────────────────────────────

  function handleSaveVariants() {
    const errors = validateVariantRows(state.matrix);
    if (Object.keys(errors).length > 0) {
      actions.setRowErrors(errors);
      return;
    }
    actions.clearRowErrors();

    const phase2 = buildPhase2Payload(state.matrix);

    // Compute name updates for renames (when option values were renamed,
    // variant names that were auto-generated should be updated)
    const nameUpdates = computeNameUpdatesForRenames(state.matrix);
    phase2.nameUpdates = nameUpdates;

    onSaveComplete({ _phase2: phase2 });
  }

  // ── Continue (advance to next wizard step) ──────────────────────────────

  async function handleContinue() {
    onSaveComplete({});
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Options &amp; Variants</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Define product options (e.g. Size, Color) then configure SKU, price and stock per combination.
        </p>
      </div>

      {stepError && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{stepError}</AlertDescription>
        </Alert>
      )}

      {/* ── Options phase ─────────────────────────────────────────────────── */}
      {state.phase === 'options' && (
        <OptionBuilderPanel
          options={state.options}
          combinationCount={selectors.combinationCount}
          exceedsLimit={selectors.exceedsLimit}
          skuPrefix={state.skuPrefix}
          onAddOption={actions.addOption}
          onRemoveOption={actions.removeOption}
          onRenameOption={actions.renameOption}
          onAddValue={actions.addValue}
          onRemoveValue={actions.removeValue}
          onRenameValue={actions.renameValue}
          onSetSkuPrefix={actions.setSkuPrefix}
          onApplyAndGenerate={actions.proposeRegeneration}
        />
      )}

      {/* ── Matrix phase ─────────────────────────────────────────────────── */}
      {state.phase === 'matrix' && (
        <VariantTable
          rows={selectors.visibleRows}
          options={state.options}
          rowErrors={state.rowErrors}
          onUpdateRow={actions.updateRow}
          onBulkUpdate={actions.bulkUpdateRows}
          onAutoGenerateSkus={actions.autoGenerateSkus}
          onEditOptions={actions.switchToOptions}
          onSave={handleSaveVariants}
          isSaving={isSaving}
          hasUnsavedChanges={selectors.hasUnsavedChanges}
          newRowCount={selectors.newRowCount}
          modifiedRowCount={selectors.modifiedRowCount}
          persistedRowCount={selectors.persistedRowCount}
        />
      )}

      {/* ── Confirmation dialog ──────────────────────────────────────────── */}
      <RegenerateDialog
        open={state.phase === 'confirming'}
        result={state.pendingReconciliation}
        isSaving={isSaving}
        onConfirm={handleConfirmRegenerate}
        onCancel={actions.cancelRegeneration}
      />

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <Button
          type="button"
          onClick={handleContinue}
          disabled={
            isSaving ||
            (state.phase === 'matrix' && selectors.hasUnsavedChanges && !selectors.allRowsSaved)
          }
          className="gap-1.5"
        >
          {isSaving
            ? 'Saving…'
            : mode === 'create' && selectors.visibleRows.length === 0
              ? 'Skip for now'
              : 'Continue'}
          {!isSaving && <ChevronRight className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
