import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ActiveFilterChips,
  FilterChips,
  FilterSection,
  FilterSheet,
  SearchFilterBar,
} from '@/components/filters';
import { ProviderEmpty, ProviderList, ProviderPage } from '@/components/listings/ProviderPage';
import { listingStatusLine, STATUS_KEYS, TONE_DOT } from '@/components/listings/listingStatus';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { fetchListings } from '@/services/listings.service';
import { fetchCreditBalance } from '@/services/billing.service';
import { LISTING_STATUSES, type ListingStatus, type VendorListingSummary } from '@/types/listings.types';
import { useFormatters, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Service listings — a provider's home screen.
 *
 * The credit balance sits on top because it decides whether customers can
 * reach the provider at all: a listing pauses itself when credits run out. The
 * balance may be negative and is shown as such. How unlocks are priced is
 * explained once, in Listing settings (owner's call, 2026-11-08) — not here.
 *
 * Search is the server's (`q`: title and business name, any accents), so it
 * finds every listing, not just the rows already loaded.
 */
const SEARCH_DEBOUNCE_MS = 300;

export function Listings() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [status, setStatus] = useState<ListingStatus | undefined>(undefined);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  // What the list actually asks for, ~300 ms after the typing stops.
  const [query, setQuery] = useState('');
  useEffect(() => {
    const next = search.trim().slice(0, 200);
    const timer = window.setTimeout(() => setQuery(next), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceToken, setBalanceToken] = useState(0);

  useEffect(() => {
    let active = true;
    fetchCreditBalance()
      .then((b) => active && setBalance(b))
      .catch(() => active && setBalance(null));
    return () => {
      active = false;
    };
  }, [balanceToken]);

  const { items, loading, loadingMore, error, sentinelRef, reload, refresh: refreshList } = useInfiniteList<VendorListingSummary>({
    fetchPage: (page, limit) => fetchListings({ status, q: query || undefined, page, limit }),
    rowHeight: 84,
    deps: [status, query],
    // Only the plain list is kept for the way back; a search result is not.
    cacheKey: query ? undefined : `listings:${status ?? 'all'}`,
    // Rows are edited on another route; returning must show the new status.
    revalidateOnRestore: true,
  });

  const searching = query.length > 0;
  const rows = items;

  const refresh = useCallback(async () => {
    setBalanceToken((n) => n + 1);
    await refreshList();
  }, [refreshList]);

  const create = useCallback(() => navigate('/dashboard/listings/new'), [navigate]);

  const statusOptions = LISTING_STATUSES.map((s) => ({ value: s, labelKey: STATUS_KEYS[s] }));

  return (
    <ProviderPage
      title={t('listings.list.title')}
      description={t('listings.list.description')}
      onRefresh={refresh}
      actions={[{ id: 'create', icon: Plus, label: t('listings.list.create'), onClick: create }]}
    >
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground">{t('listings.charging.balance')}</span>
          <span className="flex items-baseline gap-3">
            {balance === null ? (
              <Skeleton className="h-5 w-20" />
            ) : (
              <span className={cn('text-lg font-semibold tabular-nums', balance < 0 && 'text-red-600')}>
                {t('listings.charging.credits', { count: balance })}
              </span>
            )}
            <Link to="/dashboard/account/billing" className="text-sm font-medium text-primary">
              {t('listings.charging.topUp')}
            </Link>
          </span>
        </div>
        {balance !== null && balance < 0 && (
          <p className="text-sm text-red-600">{t('listings.charging.negative')}</p>
        )}
      </div>

      <div className="space-y-2">
        <SearchFilterBar
          value={search}
          onChange={setSearch}
          placeholder={t('listings.list.searchPlaceholder')}
          activeFilterCount={status ? 1 : 0}
          onOpenFilters={() => setFiltersOpen(true)}
          filterLabel={t('listings.list.filterStatus')}
        />
        <ActiveFilterChips
          chips={
            status
              ? [{ key: 'status', label: t(STATUS_KEYS[status]), onRemove: () => setStatus(undefined) }]
              : []
          }
        />
      </div>

      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title={t('listings.list.filterStatus')}
        activeCount={status ? 1 : 0}
        onClear={() => setStatus(undefined)}
      >
        <FilterSection title={t('listings.list.filterStatus')}>
          <FilterChips
            options={statusOptions}
            value={status}
            onChange={setStatus}
            allLabel={t('listings.list.allStatuses')}
          />
        </FilterSection>
      </FilterSheet>

      {loading ? (
        <ProviderList>
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2 px-4 py-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </ProviderList>
      ) : error ? (
        <ProviderEmpty
          title={t('listings.list.loadFailed')}
          action={
            <Button variant="outline" className="w-full md:w-auto" onClick={reload}>
              {t('common.actions.retry')}
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        searching ? (
          <ProviderEmpty title={t('listings.list.noMatch', { query })} />
        ) : status ? (
          <ProviderEmpty title={t('listings.list.emptyFiltered')} />
        ) : (
          <ProviderEmpty
            title={t('listings.list.emptyTitle')}
            body={t('listings.list.emptyBody')}
            action={
              <Button className="h-11 w-full md:w-auto" onClick={create}>
                {t('listings.list.emptyAction')}
              </Button>
            }
          />
        )
      ) : (
        <ProviderList>
          {rows.map((l) => (
            <ListingRow key={l.id} listing={l} onOpen={() => navigate(`/dashboard/listings/${l.id}`)} />
          ))}
          <div ref={sentinelRef} />
          {loadingMore && (
            <div className="px-4 py-4">
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}
        </ProviderList>
      )}
    </ProviderPage>
  );
}

function ListingRow({ listing, onOpen }: { listing: VendorListingSummary; onOpen: () => void }) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const line = listingStatusLine(listing);
  const updated = listing.updatedAt ?? listing.createdAt;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent/50"
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate font-medium">{listing.title || t('listings.list.untitled')}</p>
        {(listing.companyName || updated) && (
          <p className="truncate text-sm text-muted-foreground">
            {[listing.companyName, updated ? t('listings.list.updated', { date: fmt.date(updated) }) : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        <p className="flex items-center gap-2 text-sm">
          <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', TONE_DOT[line.tone])} />
          <span className="truncate">{t(line.key)}</span>
        </p>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
