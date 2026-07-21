import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Loader2, MapPin, LocateFixed, X } from 'lucide-react';
import { toast } from 'sonner';

import { searchAddresses, reverseGeocode, GEO_ERROR_MESSAGES } from '@/services/geo.service';
import { ApiError } from '@/types/api';
import type { GeoAddressCandidate } from '@/types/geo.types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DEBOUNCE_MS = 350;
const MIN_QUERY = 3;

interface AddressSearchProps {
  /** Called with the picked candidate and the raw query the user typed. */
  onSelect: (candidate: GeoAddressCandidate, rawInput: string) => void;
  /** ISO-2 country code(s) to bias results (e.g. the vendor's country). */
  countryBias?: string | null;
  placeholder?: string;
  className?: string;
}

/**
 * Maps-style address search box. Debounced calls to `GET /api/geo/search`; the
 * vendor picks a candidate, which the parent stores as the canonical `geo` and
 * uses to fill the loose address fields. Geo is off the critical path, so errors
 * degrade gracefully (a hint, never a block — the vendor can still type manually).
 * Also offers "use my location" via reverse geocoding.
 */
export function AddressSearch({ onSelect, countryBias, placeholder, className }: AddressSearchProps) {
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
          setHint(err instanceof ApiError ? (GEO_ERROR_MESSAGES[err.code] ?? 'Address search is unavailable right now.') : 'Address search is unavailable right now.');
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
      toast.error('Location is not available in this browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const candidate = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          if (candidate) {
            onSelect(candidate, candidate.formatted_address);
            toast.success('Address filled from your location');
          } else {
            toast.error('Could not resolve your location to an address.');
          }
        } catch (err) {
          toast.error(err instanceof ApiError ? (GEO_ERROR_MESSAGES[err.code] ?? 'Could not resolve your location.') : 'Could not resolve your location.');
        } finally {
          setLocating(false);
        }
      },
      () => {
        toast.error('Location permission denied.');
        setLocating(false);
      },
      { timeout: 10000 },
    );
  }, [onSelect]);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          {loading ? (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : query ? (
            <button
              type="button"
              aria-label="Clear"
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
            className="h-10 pl-10 pr-9"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={useMyLocation}
          disabled={locating}
          className="h-10 gap-1.5 flex-shrink-0"
          title="Use my current location"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
          <span className="hidden sm:inline">My location</span>
        </Button>
      </div>

      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}

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
                <span className="min-w-0">{r.formatted_address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && query.trim().length >= MIN_QUERY && results.length === 0 && !hint && (
        <p className="mt-1 text-xs text-muted-foreground">No matches — refine your search or type the address manually.</p>
      )}
    </div>
  );
}
