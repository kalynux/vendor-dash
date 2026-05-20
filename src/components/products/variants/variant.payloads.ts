// ─── Variant Payload Types & Builders ─────────────────────────────────────────
// Defines the two-phase save protocol payloads and their builder functions.

import type { DraftOption, VariantRow } from './variant.types';
import type { ApiProductOption, ApiVariant, UpdateVariantPayload } from '@/types/product.types';
import { diffVariantRow, buildVariantName } from './variant.engine';

// ─── Phase 1 Payload (Option Structure Changes) ──────────────────────────────

export interface ValueDeleteEntry {
  optionServerId: string;
  valueServerId: string;
}

export interface ValueAddEntry {
  optionServerId: string;
  values: string[];
}

export interface OptionCreateEntry {
  name: string;
  values: string[];
}

export interface OptionRenameEntry {
  optionServerId: string;
  name: string;
}

export interface ValueRenameEntry {
  optionServerId: string;
  valueServerId: string;
  newValue: string;
}

export interface VariantPhase1Payload {
  variantsToArchive: string[];
  optionsToDelete: string[];
  valuesToDelete: ValueDeleteEntry[];
  optionsToCreate: OptionCreateEntry[];
  valuesToAdd: ValueAddEntry[];
  optionsToRename: OptionRenameEntry[];
  valuesToRename: ValueRenameEntry[];
  optionIdsForReorder?: string[];
}

// ─── Phase 2 Payload (Variant Data Save) ─────────────────────────────────────

export interface VariantCreateEntry {
  optionValueIds: string[];
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
}

export interface VariantUpdateEntry {
  serverId: string;
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

export interface VariantNameUpdateEntry {
  serverId: string;
  name: string;
}

export interface VariantPhase2Payload {
  toCreate: VariantCreateEntry[];
  toUpdate: VariantUpdateEntry[];
  nameUpdates: VariantNameUpdateEntry[];
}

// ─── Phase 1 Builder ─────────────────────────────────────────────────────────

export function buildPhase1Payload(
  draftOptions: DraftOption[],
  serverSnapshot: { options: ApiProductOption[]; variants: ApiVariant[] },
  variantsToArchive: VariantRow[],
): VariantPhase1Payload {
  const serverOptionIds = new Set(serverSnapshot.options.map((o) => o.id));
  const serverValueMap = new Map<string, Set<string>>();
  for (const opt of serverSnapshot.options) {
    serverValueMap.set(
      opt.id,
      new Set(opt.values.map((v) => v.id)),
    );
  }

  // Options to delete: in server but not in drafts (by serverId)
  const draftServerIds = new Set(
    draftOptions.filter((o) => o.serverId).map((o) => o.serverId!),
  );
  const optionsToDelete = [...serverOptionIds].filter((id) => !draftServerIds.has(id));

  // Values to delete: in server option but no longer in draft option's values
  const valuesToDelete: ValueDeleteEntry[] = [];
  for (const draft of draftOptions) {
    if (!draft.serverId) continue;
    const serverValIds = serverValueMap.get(draft.serverId);
    if (!serverValIds) continue;
    const draftValServerIds = new Set(
      draft.values.filter((v) => v.serverId).map((v) => v.serverId!),
    );
    for (const svid of serverValIds) {
      // Only delete if the option itself isn't being deleted (cascade handles it)
      if (!draftValServerIds.has(svid) && !optionsToDelete.includes(draft.serverId)) {
        valuesToDelete.push({ optionServerId: draft.serverId, valueServerId: svid });
      }
    }
  }

  // Options to create: drafts without serverId
  const optionsToCreate: OptionCreateEntry[] = draftOptions
    .filter((o) => !o.serverId)
    .map((o) => ({ name: o.name, values: o.values.map((v) => v.value) }));

  // Values to add: draft values without serverId in existing (retained) options
  const valuesToAdd: ValueAddEntry[] = [];
  for (const draft of draftOptions) {
    if (!draft.serverId) continue; // new option handled by optionsToCreate
    const newVals = draft.values.filter((v) => !v.serverId).map((v) => v.value);
    if (newVals.length > 0) {
      valuesToAdd.push({ optionServerId: draft.serverId, values: newVals });
    }
  }

  // Option renames: serverId exists AND name differs from original
  const optionsToRename: OptionRenameEntry[] = draftOptions
    .filter((o) => o.serverId && o.originalName !== undefined && o.name !== o.originalName)
    .map((o) => ({ optionServerId: o.serverId!, name: o.name }));

  // Value renames: serverId exists AND value differs from original
  const valuesToRename: ValueRenameEntry[] = [];
  for (const draft of draftOptions) {
    if (!draft.serverId) continue;
    for (const val of draft.values) {
      if (val.serverId && val.originalValue !== undefined && val.value !== val.originalValue) {
        valuesToRename.push({
          optionServerId: draft.serverId,
          valueServerId: val.serverId,
          newValue: val.value,
        });
      }
    }
  }

  return {
    variantsToArchive: variantsToArchive
      .filter((r) => r.serverId)
      .map((r) => r.serverId!),
    optionsToDelete,
    valuesToDelete,
    optionsToCreate,
    valuesToAdd,
    optionsToRename,
    valuesToRename,
  };
}

// ─── Phase 2 Builder ─────────────────────────────────────────────────────────

export function buildPhase2Payload(matrix: VariantRow[]): VariantPhase2Payload {
  const toCreate: VariantCreateEntry[] = matrix
    .filter((r) => r.status === 'new')
    .map((r) => ({
      optionValueIds: r.combo.comboValues
        .map((cv) => cv.valueServerId!)
        .filter(Boolean),
      sku: r.sku,
      name: r.name,
      price: r.price,
      compareAtPrice: r.compareAtPrice,
      stock: r.stock,
      isInfiniteStock: r.isInfiniteStock,
      weight: r.weight,
      length: r.length,
      width: r.width,
      height: r.height,
    }));

  const toUpdate: VariantUpdateEntry[] = matrix
    .filter((r) => r.status === 'modified' && r.serverId)
    .map((r) => {
      const diff = diffVariantRow(r);
      if (!diff) return null;
      return {
        serverId: r.serverId!,
        ...(diff as Partial<UpdateVariantPayload>),
      } as VariantUpdateEntry;
    })
    .filter((entry): entry is VariantUpdateEntry => entry !== null);

  return {
    toCreate,
    toUpdate,
    nameUpdates: [], // populated by the orchestrator when renames trigger name recalc
  };
}

// ─── Variant Name Update Helper ──────────────────────────────────────────────

/**
 * After option/value renames, compute updated variant names for persisted variants
 * whose display names should reflect the new value strings.
 */
export function computeNameUpdatesForRenames(
  matrix: VariantRow[],
): VariantNameUpdateEntry[] {
  return matrix
    .filter((r) => r.serverId && (r.status === 'persisted' || r.status === 'modified'))
    .map((r) => {
      const newName = buildVariantName(r.combo.comboValues);
      const originalName = r.originalValues?.name;
      // Only update if the original name matches what we would have auto-generated
      // (i.e., the user hasn't manually customized the name)
      if (originalName && r.name === originalName && newName !== originalName) {
        return { serverId: r.serverId!, name: newName };
      }
      return null;
    })
    .filter((entry): entry is VariantNameUpdateEntry => entry !== null);
}
