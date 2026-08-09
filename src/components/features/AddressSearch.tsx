import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Loader2, MapPin, LocateFixed, X } from 'lucide-react';
import { toast } from 'sonner';

import { searchAddresses, reverseGeocode } from '@/services/geo.service';
import { useTranslation, useApiError } from '@/i18n';
import type { GeoAddress, GeoAddressCandidate } from '@/types/geo.types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

  const useMyLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      toast.error(t('common.address.geolocationUnavailable'));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const candidate = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
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
      },
      () => {
        toast.error(t('common.address.permissionDenied'));
        setLocating(false);
      },
      { timeout: 10000 },
    );
  }, [onSelect]);

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
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
          onClick={useMyLocation}
          disabled={locating}
          className="h-10 gap-1.5 flex-shrink-0"
          title={t('common.address.useMyLocation')}
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          <span className="hidden sm:inline">{t('common.address.myLocation')}</span>
        </Button>
      </div>

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

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
              className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
