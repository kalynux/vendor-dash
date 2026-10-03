import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';

import { fetchCodTerms, updateCodTerms } from '@/services/cod-terms.service';
import { MAX_CASH_PER_AGENCY_LIMIT } from '@/types/cod-limits.types';
import { ApiError } from '@/types/api';
import { useApiError, useFormatters, useTranslation } from '@/i18n';
import { UnsavedChangesBar } from '@/components/vendor-settings/UnsavedChangesBar';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';
import { Input } from '@/components/ui/input';
import { LabelWithHint } from '@/components/ui/info-hint';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';

/** Anchor the COD-limit dialog links to (`/dashboard/settings/policies#cod-terms`). */
const ANCHOR = 'cod-terms';

interface Snapshot {
  codEnabled: boolean;
  /** The amount as typed; `''` = no cap (`null`). */
  maxCash: string;
}

/**
 * Cash-on-delivery terms (2026-10-02) — a card on the Policies tab with its own
 * save. ⚠ Never folded into the policies form: `PATCH /vendor/profile` bumps
 * `policy_version` and pauses every agency connection; `PUT /cod-terms` does
 * neither. Both keys are always sent (full replace).
 */
export function CodTermsSettings() {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();
  const location = useLocation();
  const sectionRef = useRef<HTMLElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverFieldError, setServerFieldError] = useState(false);

  const [codEnabled, setCodEnabled] = useState(true);
  const [maxCash, setMaxCash] = useState('');
  const [saved, setSaved] = useState<Snapshot>({ codEnabled: true, maxCash: '' });
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const applyServer = useCallback((terms: { codEnabled: boolean; maxCashPerAgency: number | null; updatedAt: string | null }) => {
    const next = {
      codEnabled: terms.codEnabled,
      maxCash: terms.maxCashPerAgency === null ? '' : String(terms.maxCashPerAgency),
    };
    setCodEnabled(next.codEnabled);
    setMaxCash(next.maxCash);
    setSaved(next);
    setUpdatedAt(terms.updatedAt);
  }, []);

  useEffect(() => {
    let active = true;
    fetchCodTerms()
      .then((terms) => active && applyServer(terms))
      .catch((err) => active && setLoadError(apiError.resolve(err, { fallbackKey: 'settings.codTerms.loadFailed' })))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [apiError, applyServer]);

  // Landed here from the COD-limit dialog's "Change my COD terms".
  useEffect(() => {
    if (!loading && location.hash === `#${ANCHOR}`) {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading, location.hash]);

  const maxNum = Number(maxCash);
  const maxInvalid =
    maxCash.trim() !== '' && (!Number.isInteger(maxNum) || maxNum < 0 || maxNum > MAX_CASH_PER_AGENCY_LIMIT);
  const dirty = codEnabled !== saved.codEnabled || maxCash.trim() !== saved.maxCash;

  const handleDiscard = useCallback(() => {
    setError(null);
    setServerFieldError(false);
    setCodEnabled(saved.codEnabled);
    setMaxCash(saved.maxCash);
  }, [saved]);

  const handleSave = useCallback(async () => {
    if (maxInvalid) return;
    setSaving(true);
    setError(null);
    setServerFieldError(false);
    try {
      const terms = await updateCodTerms({
        codEnabled,
        maxCashPerAgency: maxCash.trim() === '' ? null : maxNum,
      });
      applyServer(terms);
      toast.success(t('settings.codTerms.saved'));
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors.some((f) => f.field.endsWith('maxCashPerAgency'))) {
        setServerFieldError(true);
      } else {
        setError(apiError.resolve(err, { fallbackKey: 'settings.codTerms.saveFailed' }));
      }
    } finally {
      setSaving(false);
    }
  }, [codEnabled, maxCash, maxNum, maxInvalid, applyServer, apiError, t]);

  const showMaxError = maxInvalid || serverFieldError;

  return (
    <div id={ANCHOR}>
      <SettingsSection
        ref={sectionRef}
        title={t('settings.codTerms.title')}
        info={t('settings.codTerms.info')}
        contentClassName="space-y-5"
        className="scroll-mt-20"
      >
        {loading ? (
          <>
            <Skeleton className="h-11 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </>
        ) : loadError ? (
          <div role="alert" className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
            {loadError}
          </div>
        ) : (
          <>
            {error && (
              <div role="alert" className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <div className="flex min-h-11 items-center justify-between gap-4">
                <label htmlFor="cod-enabled" className="text-sm font-medium">
                  {t('settings.codTerms.acceptLabel')}
                </label>
                <Switch id="cod-enabled" checked={codEnabled} onCheckedChange={setCodEnabled} />
              </div>
              <p className="text-xs text-muted-foreground">{t('settings.codTerms.acceptHint')}</p>
            </div>

            {/* Kept (and still sent) while COD is off — only greyed out. */}
            <div className="space-y-2">
              <LabelWithHint
                htmlFor="cod-max-cash"
                optional
                hintLabel={t('settings.codTerms.maxLabel')}
                hint={t('settings.codTerms.maxHint')}
              >
                {t('settings.codTerms.maxLabel')}
              </LabelWithHint>
              <Input
                id="cod-max-cash"
                type="number"
                inputMode="numeric"
                min={0}
                max={MAX_CASH_PER_AGENCY_LIMIT}
                step={1}
                placeholder={t('settings.codTerms.maxPlaceholder')}
                value={maxCash}
                disabled={!codEnabled}
                onChange={(e) => {
                  setServerFieldError(false);
                  setMaxCash(e.target.value);
                }}
                aria-invalid={showMaxError}
                className="h-11 max-w-xs"
              />
              {showMaxError && (
                <p className="text-xs text-destructive">
                  {t('settings.codTerms.maxInvalid', { max: fmt.number(MAX_CASH_PER_AGENCY_LIMIT) })}
                </p>
              )}
            </div>

            <div className="space-y-0.5 text-xs text-muted-foreground">
              {updatedAt && <p>{t('settings.codTerms.lastChanged', { date: fmt.dateTime(updatedAt) })}</p>}
              <p>{t('settings.codTerms.agenciesTold')}</p>
            </div>
          </>
        )}
      </SettingsSection>

      <UnsavedChangesBar
        visible={dirty || saving}
        saving={saving}
        saveDisabled={maxInvalid}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />
    </div>
  );
}
