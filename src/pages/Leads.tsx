import { useCallback, useEffect, useState } from 'react';
import { Flag, MessageSquare, PhoneCall } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ActiveFilterChips,
  FilterChips,
  FilterSection,
  FilterSheet,
  FilterTriggerButton,
} from '@/components/filters';
import { ProviderEmpty, ProviderList, ProviderPage } from '@/components/listings/ProviderPage';
import { CallMeSheet, MessageSheet, ReportSheet, WhatsAppWindowSheet } from '@/components/listings/LeadSheets';
import { LEAD_FIELD_KEYS, leadName } from '@/components/listings/listingStatus';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { fetchLeads, fetchListings, useListingActionCosts } from '@/services/listings.service';
import type { VendorLead, VendorListingSummary } from '@/types/listings.types';
import { useFormatters, useTranslation } from '@/i18n';
import { cn } from '@/lib/utils';

/**
 * Leads — every customer who unlocked one of the provider's contacts, one row
 * per customer, per listing, per 30-day window.
 *
 * ⛔ The customer is masked on purpose (first name, last initial, two digits).
 * This list is never cached — no `cacheKey`, no storage, no logging — so a row
 * lives only as long as the screen does.
 *
 * Messages go through Wi-Mall and only to a customer who opted in. "Send a
 * message" stays visible but greyed when WhatsApp's own 24-hour rule closes it,
 * and tapping it says so — a hidden button would look like a Wi-Mall fault.
 */
export function Leads() {
  const { t } = useTranslation();
  const costs = useListingActionCosts();

  const [listingId, setListingId] = useState<string | undefined>(undefined);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listings, setListings] = useState<VendorListingSummary[]>([]);

  const [callMe, setCallMe] = useState<VendorLead | null>(null);
  const [message, setMessage] = useState<VendorLead | null>(null);
  const [report, setReport] = useState<VendorLead | null>(null);
  const [windowOpen, setWindowOpen] = useState(false);

  // Listing titles for the filter. Best effort: without them there is no filter.
  useEffect(() => {
    let active = true;
    fetchListings({ page: 1, limit: 100 })
      .then((res) => active && setListings(res.items.filter((l) => l.status !== 'draft')))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const { items, loading, loadingMore, error, sentinelRef, reload, refresh: refreshList, updateItems } = useInfiniteList<VendorLead>({
    fetchPage: (page, limit) => fetchLeads({ listingId, page, limit }),
    rowHeight: 180,
    deps: [listingId],
  });

  const refresh = useCallback(() => refreshList(), [refreshList]);
  // After a message or a call-me, re-read the rows: messages left, the one
  // call-me and the 24-hour window are the server's to say.
  const afterSend = useCallback(() => {
    void refreshList().catch(() => {});
  }, [refreshList]);

  const markReported = useCallback(
    (id: string) => updateItems((l) => (l.id === id ? { ...l, reportOpen: true } : l)),
    [updateItems],
  );

  const selected = listings.find((l) => l.id === listingId);

  return (
    <ProviderPage
      title={t('listings.leads.title')}
      description={t('listings.leads.description')}
      onRefresh={refresh}
    >
      {listings.length > 1 && (
        <div className="flex items-center gap-2">
          <FilterTriggerButton onClick={() => setFiltersOpen(true)} activeCount={listingId ? 1 : 0} />
          <ActiveFilterChips
            chips={
              listingId
                ? [
                    {
                      key: 'listing',
                      label: selected?.title || t('listings.list.untitled'),
                      onRemove: () => setListingId(undefined),
                    },
                  ]
                : []
            }
          />
        </div>
      )}

      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title={t('listings.leads.filterListing')}
        activeCount={listingId ? 1 : 0}
        onClear={() => setListingId(undefined)}
      >
        <FilterSection title={t('listings.leads.filterListing')}>
          <FilterChips
            options={listings.map((l) => ({ value: l.id, label: l.title || t('listings.list.untitled') }))}
            value={listingId}
            onChange={setListingId}
            allLabel={t('listings.leads.allListings')}
          />
        </FilterSection>
      </FilterSheet>

      {loading ? (
        <ProviderList>
          {[0, 1].map((i) => (
            <div key={i} className="space-y-2 px-4 py-4">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-11 w-full" />
            </div>
          ))}
        </ProviderList>
      ) : error ? (
        <ProviderEmpty
          title={t('listings.leads.loadFailed')}
          action={
            <Button variant="outline" className="w-full md:w-auto" onClick={reload}>
              {t('common.actions.retry')}
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <ProviderEmpty title={t('listings.leads.emptyTitle')} body={t('listings.leads.emptyBody')} />
      ) : (
        <ProviderList>
          {items.map((lead) => (
            <LeadRow
              key={lead.id}
              lead={lead}
              showListing={!listingId}
              onCallMe={() => setCallMe(lead)}
              onMessage={() => (lead.freeTextAvailable ? setMessage(lead) : setWindowOpen(true))}
              onReport={() => setReport(lead)}
            />
          ))}
          <div ref={sentinelRef} />
          {loadingMore && (
            <div className="px-4 py-4">
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}
        </ProviderList>
      )}

      <CallMeSheet
        lead={callMe}
        cost={costs?.whatsappTemplate ?? null}
        onClose={() => setCallMe(null)}
        onSent={afterSend}
      />
      <MessageSheet lead={message} onClose={() => setMessage(null)} onSent={afterSend} />
      <WhatsAppWindowSheet open={windowOpen} onClose={() => setWindowOpen(false)} />
      <ReportSheet lead={report} onClose={() => setReport(null)} onSent={markReported} />
    </ProviderPage>
  );
}

function LeadRow({
  lead,
  showListing,
  onCallMe,
  onMessage,
  onReport,
}: {
  lead: VendorLead;
  showListing: boolean;
  onCallMe: () => void;
  onMessage: () => void;
  onReport: () => void;
}) {
  const { t } = useTranslation();
  const fmt = useFormatters();

  const consented = lead.consent === 'granted';
  const outOfMessages = lead.messagesLeft <= 0;
  // Greyed, never hidden, when only WhatsApp's 24-hour rule stands in the way:
  // tapping it explains. Any other reason (no messages left) is plainly off.
  const messageClosedByWhatsApp = !lead.freeTextAvailable && lead.channel === 'whatsapp' && !outOfMessages;

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="truncate font-medium">{leadName(lead, t('listings.leads.aCustomer'))}</p>
          {lead.customer.maskedPhone && (
            <p className="text-sm tabular-nums text-muted-foreground">{lead.customer.maskedPhone}</p>
          )}
          {showListing && <p className="truncate text-sm text-muted-foreground">{lead.listingTitle}</p>}
          <p className="text-sm text-muted-foreground">
            {t('listings.leads.window', { start: fmt.date(lead.windowStart), end: fmt.date(lead.windowEnd) })}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="-mr-2 shrink-0 gap-1.5 text-muted-foreground"
          disabled={lead.reportOpen}
          onClick={onReport}
        >
          <Flag className="h-4 w-4" />
          {lead.reportOpen ? t('listings.leads.reportOpen') : t('listings.leads.report')}
        </Button>
      </div>

      <ul className="space-y-1 text-sm">
        {lead.fields.map((f) => (
          <li key={f.revealId} className="flex items-baseline justify-between gap-3">
            <span className={cn(f.refunded && 'text-muted-foreground line-through')}>
              {t(LEAD_FIELD_KEYS[f.field] ?? 'listings.leads.unlocked')}
              <span className="text-muted-foreground"> · {fmt.date(f.at)}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {f.refunded ? t('listings.leads.refunded') : t('listings.leads.cost', { count: f.cost })}
            </span>
          </li>
        ))}
      </ul>

      {consented ? (
        <div className="space-y-2">
          <div className="grid gap-2 md:grid-cols-2">
            <Button
              variant="outline"
              className="h-11 gap-1.5 px-2 md:h-9"
              disabled={!lead.callMeAvailable || outOfMessages}
              onClick={onCallMe}
            >
              <PhoneCall className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {lead.callMeAvailable ? t('listings.leads.callMe') : t('listings.leads.callMeAlreadySent')}
              </span>
            </Button>
            <Button
              variant="outline"
              className={cn('h-11 gap-1.5 px-2 md:h-9', messageClosedByWhatsApp && 'opacity-50')}
              // Clickable when closed by WhatsApp: the tap opens the explanation.
              disabled={outOfMessages || (!lead.freeTextAvailable && !messageClosedByWhatsApp)}
              aria-disabled={messageClosedByWhatsApp || undefined}
              onClick={onMessage}
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="truncate">{t('listings.leads.message')}</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {outOfMessages
              ? t('listings.leads.noMessagesLeft')
              : t('listings.leads.messagesLeft', { count: lead.messagesLeft })}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t('listings.leads.needsOptIn')}</p>
      )}
    </div>
  );
}
