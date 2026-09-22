import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Loader2, MapPin, LocateFixed, X } from 'lucide-react';
import { toast } from 'sonner';

import { searchAddresses, reverseGeocode } from '@/services/geo.service';
import { getCurrentPosition } from '@/platform/geolocation';
import { onNextResume, openAppSettings } from '@/platform/permissions';
import { useTranslation, useApiError } from '@/i18n';
import type { GeoAddress, GeoAddressCandidate } from '@/types/geo.types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LocationAccessDialog, type LocationAccessProblem } from './LocationAccessDialog';

const DEBOUNCE_MS = 350;
const MIN_QUERY = 3;

interface AddressSearchProps {
  /** Called with the picked candidate and the raw query the user typed. */
  onSelect: (candidate: GeoAddressCandidate, rawInput: string) => void;
  /**
   * The address already pinned on this row. Rendered as a confirmation panel
   * under the box so the vendor can see which place the coordinates belong to —
   * the search field itself always clears after a pick.
   */
  value?: GeoAddress | GeoAddressCandidate | null;
  /** Clears the pinned address. Omit to render the panel without a clear button. */
  onClear?: () => void;
  /** ISO-2 country code(s) to bias results (e.g. the vendor's country). */
  countryBias?: string | null;
  placeholder?: string;
  /** Marks the box when the surrounding form is blocked on a missing pin. */
  hasError?: boolean;
  className?: string;
}

/**
 * Maps-style address search box. Debounced calls to `GET /api/geo/search`; the
 * vendor picks a candidate, which the parent stores as the canonical `geo` and
 * uses to fill the loose address fields. Geo is off the critical path, so errors
 * degrade gracefully (a hint, never a block — the vendor can still type manually).
 * Also offers "use my location" via reverse geocoding.
 */
export function AddressSearch({
  onSelect,
  value = null,
  onClear,
  countryBias,
  placeholder,
  hasError,
  className,
}: AddressSearchProps) {
  const { t } = useTranslation();
  const apiError = useApiError();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoAddressCandidate[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [accessOpen, setAccessOpen] = useState(false);
  const [accessProblem, setAccessProblem] = useState<LocationAccessProblem>('denied');
  const containerRef = useRef<HTMLDivElement>(null);

  const country = countryBias ? countryBias.toLowerCase() : undefined;

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setHint(null);
    const t = setTimeout(async () => {
      try {
        const res = await searchAddresses({ q, limit: 6, country });
        if (!cancelled) {
          setResults(res);
          setOpen(true);
        }
      } catch (err) {
        if (!cancelled) {
          setResults([]);
          setHint(apiError.resolve(err, { fallbackKey: 'common.address.searchUnavailable' }));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, country]);

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const pick = useCallback(
    (candidate: GeoAddressCandidate) => {
      onSelect(candidate, query.trim());
      setQuery('');
      setResults([]);
      setOpen(false);
    },
    [onSelect, query],
  );

  // The toast's retry and the return from settings outlive the render that
  // created them, so they go through a ref to the current callback.
  const retryRef = useRef<() => Promise<void>>(async () => undefined);

  /**
   * Fill the address from where the vendor is standing.
   *
   * ⚠ `navigator.geolocation` is not used directly any more (CAPACITOR-PLAN.md
   * → P4.4). It exists in an Android WebView but is bound to the *app's* runtime
   * permission, and a WebView cannot raise an Android runtime prompt on the
   * app's behalf — so without the grant it fails with `PERMISSION_DENIED`
   * instantly and the vendor has no way to act on the toast.
   * `@/platform/geolocation` prompts properly and answers in six states, which
   * is the point: each failure needs a different thing said about it.
   *
   * ⚠ A refusal or a switched-off location opens `LocationAccessDialog`, never
   * a bare "denied" toast: most vendors do not know how to re-allow a
   * permission by hand, so the dialog always ends in a button that asks again
   * or goes to the switch.
   */
  const fillFromCurrentLocation = useCallback(async () => {
    setLocating(true);
    try {
      const fix = await getCurrentPosition();

      if (fix.status !== 'granted') {
        if (fix.status === 'denied' || fix.status === 'blocked' || fix.status === 'off') {
          setAccessProblem(fix.status);
          setAccessOpen(true);
        } else if (fix.status === 'unavailable') {
          toast.error(t('common.address.geolocationUnavailable'));
        } else {
          // Permission was fine and no position arrived, even after waiting and
          // falling back to the phone's last known one.
          toast.error(t('common.address.locationFixFailed'), {
            action: {
              label: t('common.actions.retry'),
              onClick: () => void retryRef.current(),
            },
          });
        }
        return;
      }

      const candidate = await reverseGeocode(fix.latitude, fix.longitude);
      if (candidate) {
        onSelect(candidate, candidate.formatted_address);
        toast.success(t('common.address.filledFromLocation'));
      } else {
        toast.error(t('common.address.resolveFailed'));
      }
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'common.address.resolveFailed' });
    } finally {
      setLocating(false);
    }
  }, [onSelect, t, apiError]);

  useEffect(() => {
    retryRef.current = fillFromCurrentLocation;
  }, [fillFromCurrentLocation]);

  // Cancel a pending "carry on when back from settings" if the box unmounts.
  const cancelResumeRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelResumeRef.current?.(), []);

  const openSettingsThenRetry = useCallback(() => {
    cancelResumeRef.current?.();
    cancelResumeRef.current = onNextResume(() => {
      cancelResumeRef.current = null;
      void retryRef.current();
    });
    void openAppSettings();
  }, []);

  return (
    <div ref={containerRef} className={cn('relative space-y-2', className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          {loading ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : query ? (
            <button
              type="button"
              aria-label={t('common.actions.clear')}
              onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground tap-target"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => results.length && setOpen(true)}
            placeholder={placeholder ?? 'Search an address…'}
            className={cn('h-10 pl-10 pr-9', hasError && 'border-destructive')}
            aria-invalid={hasError}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void fillFromCurrentLocation()}
          disabled={locating}
          className="h-10 gap-1.5 flex-shrink-0"
          title={t('common.address.useMyLocation')}
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          <span className="hidden sm:inline">{t('common.address.myLocation')}</span>
        </Button>
      </div>

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {/* A first fix outdoors can take several seconds; say so rather than
          leave a bare spinner that looks stuck. */}
      {locating && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {t('common.address.locating')}
        </p>
      )}

      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-popover p-1 shadow-md">
          {results.map((r, i) => (
            <li key={`${r.provider_place_id ?? 'c'}-${i}`}>
              <button
                type="button"
                onClick={() => pick(r)}
                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
              >
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block">{r.formatted_address}</span>
                  {(r.components?.city || r.components?.region) && (
                    <span className="block text-xs text-muted-foreground">
                      {[r.components?.city, r.components?.region].filter(Boolean).join(', ')}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && query.trim().length >= MIN_QUERY && results.length === 0 && !hint && (
        <p className="text-xs text-muted-foreground">{t('common.address.noMatches')}</p>
      )}

      {/* The pin that is actually stored — the coordinate delivery agencies route
          to, so it stays on screen rather than living in a one-line "pinned" note. */}
      {value && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900 dark:bg-emerald-950/40">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm">{value.formatted_address}</p>
            <p className="text-[11px] text-muted-foreground">
              {t('common.address.pinnedAt', {
                lat: value.coordinates.coordinates[1].toFixed(4),
                lng: value.coordinates.coordinates[0].toFixed(4),
              })}
            </p>
          </div>
          {onClear && (
            <button
              type="button"
              aria-label={t('common.address.clearPinned')}
              onClick={onClear}
              className="shrink-0 text-muted-foreground transition-colors hover:text-destructive tap-target"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <LocationAccessDialog
        open={accessOpen}
        problem={accessProblem}
        onOpenChange={setAccessOpen}
        onRetry={() => void fillFromCurrentLocation()}
        onOpenSettings={openSettingsThenRetry}
      />
    </div>
  );
}
