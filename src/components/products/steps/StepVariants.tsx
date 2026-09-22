// ─── Step Variants ────────────────────────────────────────────────────────────
// Orchestration component that renders the correct phase of the variant builder
// and communicates payloads to the parent wizard page for server execution.

import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SettingsSection, SettingsSections } from '@/components/vendor-settings/SettingsSection';
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
import { VARIANT_IMAGE_LIMIT } from '@/components/products/media.constants';
import type { PendingStockInfo } from '@/components/inventory/PendingStockBadge';
import { useTranslation } from '@/i18n';
import type { WizardState, ApiProductOption, ApiFileDetail } from '@/types/product.types';
import { StepActions, StepError } from './StepLayout';

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
  /** Session-local image overrides per variant id (survives a step remount). */
  imageEditsByVariantId: Record<string, ApiFileDetail[]>;
  onVariantImagesChange: (variantId: string, files: ApiFileDetail[]) => void;
  /**
   * Open stock requests per saved variant id, held at page level rather than in
   * the variant reducer — SAVE_COMPLETE rehydrates rows from `serverVariants`
   * and would wipe anything stored alongside them.
   */
  pendingStockByVariantId?: Record<string, PendingStockInfo>;
  onBack: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StepVariants({
  mode,
  productId,
  serverData,
  isSaving,
  stepError,
  onSaveComplete,
  imageEditsByVariantId,
  onVariantImagesChange,
  pendingStockByVariantId,
  onBack,
}: StepVariantsProps) {
  const { t } = useTranslation();
  const serverOptions: ApiProductOption[] = serverData.serverOptions ?? [];
  const serverVariants = serverData.serverVariants ?? [];

  // A warehoused product cannot carry unlimited stock on any active variant.
  const infiniteStockLocked =
    serverData.serverProduct?.delivery?.pickupLocation?.source === 'agency_storage';

  const { state, actions, selectors } = useVariantBuilder(serverOptions, serverVariants);

  // Resolve each saved variant's images: session edits win over server data.
  const maxImages = VARIANT_IMAGE_LIMIT[serverData.serverProduct?.type ?? 'physical'];
  const filesByVariantId: Record<string, ApiFileDetail[]> = {};
  for (const v of serverVariants) filesByVariantId[v.id] = v.files;
  Object.assign(filesByVariantId, imageEditsByVariantId);

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
    <div>
      <StepError error={stepError} />

      <SettingsSections>
        <SettingsSection
          title={t('products.options.title')}
          description={t('products.options.description')}
        >
          {/* ── Options phase ───────────────────────────────────────────── */}
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

          {/* ── Matrix phase ────────────────────────────────────────────── */}
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
              productId={productId}
              maxImages={maxImages}
              filesByVariantId={filesByVariantId}
              onVariantImagesChange={onVariantImagesChange}
              pendingStockByVariantId={pendingStockByVariantId}
              infiniteStockLocked={infiniteStockLocked}
            />
          )}
        </SettingsSection>
      </SettingsSections>

      {/* ── Confirmation dialog ──────────────────────────────────────────── */}
      <RegenerateDialog
        open={state.phase === 'confirming'}
        result={state.pendingReconciliation}
        isSaving={isSaving}
        onConfirm={handleConfirmRegenerate}
        onCancel={actions.cancelRegeneration}
      />

      <StepActions onBack={onBack}>
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
            ? t('common.actions.saving')
            : mode === 'create' && selectors.visibleRows.length === 0
              ? t('common.actions.skip')
              : t('common.actions.continue')}
          {!isSaving && <ChevronRight className="size-4" />}
        </Button>
      </StepActions>
    </div>
  );
}
