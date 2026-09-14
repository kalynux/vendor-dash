import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Circle, FileCheck2, Loader2, MapPin, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { AddressSearch } from '@/components/features/AddressSearch';
import { ResponsiveModal } from '@/components/services/ResponsiveModal';
import { SettingsSection, SettingsSections } from '@/components/vendor-settings/SettingsSection';
import { UnsavedChangesBar } from '@/components/vendor-settings/UnsavedChangesBar';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { apiErrorMessage, useTranslation, type TranslationKey } from '@/i18n';
import { getUploadErrorMessage } from '@/lib/uploadErrors';
import { kycChecklist, type KycChecklistItemId } from '@/lib/kyc/checklist';
import {
  getKycRecord,
  updateKycDetails,
  uploadKycDocuments,
  deleteKycDocument,
  submitKycRecord,
} from '@/services/kyc.service';
import {
  kycAddressToCandidate,
  kycPhase,
  KYC_MULTI_SLOT_MAX_FILES_FALLBACK,
  type KycRecord,
  type KycSlot,
} from '@/types/kyc.types';
import type { FileRef } from '@/types/file.types';
import type { GeoAddressCandidate } from '@/types/geo.types';

import { KycStatusBanner } from './KycStatusBanner';
import { KycSlotField } from './KycSlotField';
import { KycDocumentPreviewDialog } from './KycDocumentPreviewDialog';

const CHECKLIST_LABELS: Record<KycChecklistItemId, TranslationKey> = {
  idNumber: 'account.verification.checklist.items.idNumber',
  idCardFront: 'account.verification.checklist.items.idCardFront',
  idCardBack: 'account.verification.checklist.items.idCardBack',
  selfieWithId: 'account.verification.checklist.items.selfieWithId',
  homeAddress: 'account.verification.checklist.items.homeAddress',
  homeAddressSketch: 'account.verification.checklist.items.homeAddressSketch',
  storeAddressSketch: 'account.verification.checklist.items.storeAddressSketch',
};

/**
 * Account → Verification. The ID scans, the selfie and the location sketches an
 * administrator reviews before deciding whether to verify the shop.
 *
 * ── Two commit models on one screen, deliberately ────────────────────────────
 * Documents commit the moment they are picked: `POST /documents/:slot` is a real
 * write that returns the whole record, and there is no file id to hold back for
 * a later save. The typed half (identity number, home address) is an ordinary
 * PATCH and goes through the floating save bar like every other settings tab.
 * The copy under the upload sections says so, because a screen where half the
 * controls save themselves and half do not is otherwise a trap.
 *
 * ── Nothing here gates Submit ────────────────────────────────────────────────
 * ⚠ The checklist is the *reviewers'* policy, mirrored client-side as guidance —
 * the API enforces no completeness rule and accepts an empty record. A vendor
 * who insists on submitting an incomplete record may, and gets a rejection with
 * a reason they can act on. Disabling Submit would replace a one-day round trip
 * with a dead end. See `kycChecklist`.
 */
export function IdentityVerificationSettings() {
  const { t } = useTranslation();
  const { session } = useOnboarding();

  const [record, setRecord] = useState<KycRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [idNumber, setIdNumber] = useState('');
  const [homeAddress, setHomeAddress] = useState<GeoAddressCandidate | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const [removingId, setRemovingId] = useState<string | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState<{ doc: FileRef; label: string } | null>(null);

  /** Reset the typed half to whatever the server last told us. */
  const syncForm = useCallback((next: KycRecord) => {
    setRecord(next);
    setIdNumber(next.idNumber ?? '');
    setHomeAddress(kycAddressToCandidate(next.homeAddress));
    setDirty(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    getKycRecord()
      .then((next) => {
        if (!cancelled) syncForm(next);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(apiErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [syncForm]);

  /**
   * "Has a physical store" — a question **the backend does not model**, which
   * the doc leaves to the screen. A pickup address on the vendor profile is this
   * dashboard's answer; it is the same `business_addresses` the reviewers read.
   */
  const hasPhysicalStore = (session?.role_entity?.business_addresses?.length ?? 0) > 0;

  const checklist = useMemo(
    () => (record ? kycChecklist(record, hasPhysicalStore) : null),
    [record, hasPhysicalStore],
  );

  const locked = record?.locked ?? false;
  const maxSketches = record?.limits.multiSlotMaxFiles ?? KYC_MULTI_SLOT_MAX_FILES_FALLBACK;

  // ─── Writes ───────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!record) return;
    setSaving(true);
    try {
      // `''` clears an identity number rather than storing a blank — the
      // platform's clearable-field convention, and the reason a vendor who typed
      // the wrong number can take it back.
      const next = await updateKycDetails({
        idNumber: idNumber.trim() === '' ? null : idNumber.trim(),
        homeAddress,
      });
      syncForm(next);
      toast.success(t('account.verification.saved'));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }, [record, idNumber, homeAddress, syncForm, t]);

  const handleDiscard = useCallback(() => {
    if (record) syncForm(record);
  }, [record, syncForm]);

  const handleUpload = useCallback(
    async (slot: KycSlot, files: File[]) => {
      try {
        const next = await uploadKycDocuments(slot, files);
        // The upload response is the whole record, so this keeps the typed half
        // in sync too — but only when the vendor has no unsaved edits pending,
        // which `dirty` is exactly the test for. Overwriting a half-typed ID
        // number because a sketch finished uploading would be a data loss the
        // vendor never asked for.
        if (dirty) setRecord(next);
        else syncForm(next);
      } catch (err) {
        // Re-thrown for the slot field to render inline, next to the control
        // that caused it. `getUploadErrorMessage` names the offending file and
        // the violation — "cni-recto.jpg is too large" rather than one generic
        // sentence for a ten-file pick.
        throw new Error(getUploadErrorMessage(err, files));
      }
    },
    [dirty, syncForm],
  );

  const handleRemove = useCallback(
    async (slot: KycSlot, fileId: string) => {
      setRemovingId(fileId);
      try {
        const next = await deleteKycDocument(slot, fileId);
        if (dirty) setRecord(next);
        else syncForm(next);
      } catch (err) {
        toast.error(apiErrorMessage(err));
      } finally {
        setRemovingId(null);
      }
    },
    [dirty, syncForm],
  );

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const next = await submitKycRecord();
      syncForm(next);
      setSubmitOpen(false);
      toast.success(t('account.verification.submitted'));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }, [syncForm, t]);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-48 w-full rounded-lg" />
      </div>
    );
  }

  if (loadError || !record || !checklist) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
        {loadError ?? t('errors.unknown')}
      </div>
    );
  }

  const docs = record.documents;
  const phase = kycPhase(record);
  const requiredOf = (id: KycChecklistItemId) =>
    checklist.items.find((item) => item.id === id)?.required ?? false;

  return (
    <>
      <SettingsSections>
        <SettingsSection
          title={t('account.verification.title')}
          icon={ShieldCheck}
          info={
            <div className="space-y-2">
              <p>{t('account.verification.info1')}</p>
              <p>{t('account.verification.info2')}</p>
              <p>{t('account.verification.info3')}</p>
            </div>
          }
          contentClassName="space-y-4"
        >
          <KycStatusBanner record={record} />

          {/* The reviewers' bar, as a live list. Shown while there is still
              something to do and hidden once the record is verified — a
              completed checklist on a frozen record is noise. */}
          {phase !== 'verified' && (
            <div className="rounded-lg border p-3 md:p-4">
              <p className="mb-2 text-sm font-medium">
                {checklist.complete
                  ? t('account.verification.checklist.complete')
                  : t('account.verification.checklist.remaining', { count: checklist.missing.length })}
              </p>
              <ul className="space-y-1.5">
                {checklist.items
                  .filter((item) => item.required)
                  .map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm">
                      {item.satisfied ? (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                      ) : (
                        <Circle className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className={item.satisfied ? 'text-muted-foreground line-through' : ''}>
                        {t(CHECKLIST_LABELS[item.id])}
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </SettingsSection>

        <SettingsSection
          title={t('account.verification.identity.title')}
          icon={FileCheck2}
          description={locked ? undefined : t('account.verification.uploadsSaveImmediately')}
          contentClassName="space-y-5"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="kyc-id-number">{t('account.verification.identity.idNumber')}</Label>
            </div>
            <Input
              id="kyc-id-number"
              value={idNumber}
              maxLength={64}
              disabled={locked}
              placeholder={t('account.verification.identity.idNumberPlaceholder')}
              onChange={(e) => {
                setIdNumber(e.target.value);
                setDirty(true);
              }}
            />
            {/* No format check, on purpose — Cameroonian ID formats have changed
                more than once and a regex from today's cards silently refuses a
                valid older one. A person checks it against the scans. */}
            <p className="text-xs text-muted-foreground">
              {t('account.verification.identity.idNumberHint')}
            </p>
          </div>

          <KycSlotField
            slot="id_card_front"
            label={t('account.verification.slots.idCardFront')}
            hint={t('account.verification.slots.idCardFrontHint')}
            required={requiredOf('idCardFront')}
            files={docs.idCardFront ? [docs.idCardFront] : []}
            max={1}
            locked={locked}
            onUpload={handleUpload}
            onRemove={handleRemove}
            onOpen={(doc, label) => setPreview({ doc, label })}
            removingId={removingId}
          />

          <KycSlotField
            slot="id_card_back"
            label={t('account.verification.slots.idCardBack')}
            hint={t('account.verification.slots.idCardBackHint')}
            required={requiredOf('idCardBack')}
            files={docs.idCardBack ? [docs.idCardBack] : []}
            max={1}
            locked={locked}
            onUpload={handleUpload}
            onRemove={handleRemove}
            onOpen={(doc, label) => setPreview({ doc, label })}
            removingId={removingId}
          />

          <KycSlotField
            slot="selfie_with_id"
            label={t('account.verification.slots.selfieWithId')}
            hint={t('account.verification.slots.selfieWithIdHint')}
            required={requiredOf('selfieWithId')}
            files={docs.selfieWithId ? [docs.selfieWithId] : []}
            max={1}
            locked={locked}
            onUpload={handleUpload}
            onRemove={handleRemove}
            onOpen={(doc, label) => setPreview({ doc, label })}
            removingId={removingId}
          />
        </SettingsSection>

        <SettingsSection
          title={t('account.verification.locations.title')}
          icon={MapPin}
          info={<p>{t('account.verification.locations.info')}</p>}
          contentClassName="space-y-5"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>{t('account.verification.locations.homeAddress')}</Label>
            </div>
            {locked ? (
              <p className="rounded-lg border bg-muted/40 p-3 text-sm">
                {record.homeAddress?.formattedAddress ?? t('account.verification.locations.noHomeAddress')}
              </p>
            ) : (
              <AddressSearch
                value={homeAddress}
                countryBias={session?.role_entity?.country}
                placeholder={t('account.verification.locations.homeAddressPlaceholder')}
                onSelect={(candidate) => {
                  // The candidate goes through unmodified. `geocoded: true` on
                  // the way back IS the reviewer's badge for "this address is
                  // valid" — a hand-assembled object with invented coordinates
                  // passes that check and fails the human one.
                  setHomeAddress(candidate);
                  setDirty(true);
                }}
                onClear={() => {
                  setHomeAddress(null);
                  setDirty(true);
                }}
              />
            )}
            {/* A stored address that never geocoded cannot be rendered on the
                pinned panel, so say so rather than showing an empty box. */}
            {!locked && !homeAddress && record.homeAddress?.formattedAddress && (
              <p className="text-xs text-amber-600">
                {t('account.verification.locations.notGeocoded', {
                  address: record.homeAddress.formattedAddress,
                })}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {t('account.verification.locations.homeAddressHint')}
            </p>
          </div>

          <KycSlotField
            slot="home_address_sketch"
            label={t('account.verification.slots.homeAddressSketch')}
            hint={t('account.verification.slots.homeAddressSketchHint')}
            required={requiredOf('homeAddressSketch')}
            files={docs.homeAddressSketches}
            max={maxSketches}
            locked={locked}
            onUpload={handleUpload}
            onRemove={handleRemove}
            onOpen={(doc, label) => setPreview({ doc, label })}
            removingId={removingId}
          />

          <KycSlotField
            slot="store_address_sketch"
            label={t('account.verification.slots.storeAddressSketch')}
            hint={t('account.verification.slots.storeAddressSketchHint')}
            required={requiredOf('storeAddressSketch')}
            files={docs.storeAddressSketches}
            max={maxSketches}
            locked={locked}
            onUpload={handleUpload}
            onRemove={handleRemove}
            onOpen={(doc, label) => setPreview({ doc, label })}
            removingId={removingId}
          />
        </SettingsSection>

        {!locked && (
          <SettingsSection
            title={t('account.verification.submit.title')}
            contentClassName="space-y-3"
          >
            <p className="text-sm text-muted-foreground">
              {phase === 'rejected'
                ? t('account.verification.submit.resubmitBody')
                : t('account.verification.submit.body')}
            </p>
            <Button type="button" onClick={() => setSubmitOpen(true)} className="w-full md:w-auto">
              {phase === 'rejected'
                ? t('account.verification.submit.resubmitAction')
                : t('account.verification.submit.action')}
            </Button>
          </SettingsSection>
        )}
      </SettingsSections>

      <UnsavedChangesBar
        visible={dirty || saving}
        saving={saving}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />

      <KycDocumentPreviewDialog
        doc={preview?.doc ?? null}
        label={preview?.label ?? ''}
        onClose={() => setPreview(null)}
      />

      <ResponsiveModal
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        title={t('account.verification.submit.confirmTitle')}
        description={
          checklist.complete
            ? t('account.verification.submit.confirmBody')
            : t('account.verification.submit.confirmIncomplete', {
                count: checklist.missing.length,
              })
        }
        footer={
          <div className="flex flex-col gap-2 md:flex-row md:justify-end">
            <Button variant="outline" onClick={() => setSubmitOpen(false)} disabled={submitting}>
              {t('common.actions.cancel')}
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
              {t('account.verification.submit.confirmAction')}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          {/* Submitting freezes the record until a reviewer decides, so the
              consequence is stated before the click rather than discovered as a
              409 on the next edit. */}
          <p>{t('account.verification.submit.freezeWarning')}</p>

          {!checklist.complete && (
            <ul className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/10 p-3">
              {checklist.missing.map((item) => (
                <li key={item.id} className="flex items-center gap-2">
                  <Circle className="size-3.5 shrink-0" />
                  {t(CHECKLIST_LABELS[item.id])}
                </li>
              ))}
            </ul>
          )}

          {/* Unsaved typed edits are NOT part of the submission — the PATCH and
              the submit are two calls, and the record freezes on the second. */}
          {dirty && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive">
              {t('account.verification.submit.unsavedWarning')}
            </p>
          )}
        </div>
      </ResponsiveModal>
    </>
  );
}
