import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from '@/services/notifications.service';
import { PushPermissionBanner } from '@/components/notifications/PushPermissionBanner';
import {
  asMessagingChannel,
  disconnectChannel,
  listConnections,
} from '@/services/connections.service';
import { ChannelSetupDialog } from '@/components/vendor-settings/ChannelSetupDialog';
import { UnsavedChangesBar } from '@/components/vendor-settings/UnsavedChangesBar';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { ApiError } from '@/types/api';
import type {
  NotificationPreferences,
  NotificationEventKey,
  NotificationEventPreferences,
  DeliveryChannelChoice,
  SecondaryChannel,
  PreferredLanguage,
} from '@/types/notifications.types';
import type { MessagingChannel, MessagingConnection } from '@/types/connections.types';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  SettingsSection,
  SettingsSections,
} from '@/components/vendor-settings/SettingsSection';
import { InfoHint } from '@/components/ui/info-hint';
import { cn } from '@/lib/utils';
import { useMessage, useTranslation, type TranslationKey } from '@/i18n';

// ─── Static config ──────────────────────────────────────────────────────────

const TelegramIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
  </svg>
);

const WhatsappIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898 1.866 1.869 2.893 4.352 2.892 6.993 0 5.45-4.435 9.884-9.886 9.884l0 0z" />
  </svg>
);

type ChannelMeta = {
  value: SecondaryChannel;
  /** Brand names (Telegram, WhatsApp) still go through the catalog so a locale can transliterate them. */
  labelKey: TranslationKey;
  Icon: (props: { className?: string }) => React.JSX.Element;
  /** Brand colour for the bare icon. */
  iconColor: string;
  verifyKey: 'emailVerified' | 'telegramVerified' | 'whatsappVerified';
  /** Whether the link can be removed in-app (email can't be un-verified). */
  unlinkable: boolean;
};

const SECONDARY_CHANNELS: ChannelMeta[] = [
  {
    value: 'telegram',
    labelKey: 'notifications.settings.channels.telegram',
    Icon: TelegramIcon,
    iconColor: 'text-[#0088cc]',
    verifyKey: 'telegramVerified',
    unlinkable: true,
  },
  {
    value: 'email',
    labelKey: 'notifications.settings.channels.email',
    Icon: ({ className }) => <Mail className={className} />,
    iconColor: 'text-muted-foreground',
    verifyKey: 'emailVerified',
    unlinkable: false,
  },
  {
    value: 'whatsapp',
    labelKey: 'notifications.settings.channels.whatsapp',
    Icon: WhatsappIcon,
    iconColor: 'text-[#25D366]',
    verifyKey: 'whatsappVerified',
    unlinkable: true,
  },
];

type EventMeta = {
  key: NotificationEventKey;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  /**
   * Show the explanation behind an info icon. Only for labels that are easy to
   * mix up — the rest say what they are, and twelve icons read as clutter.
   */
  hint?: boolean;
  /**
   * Returned by GET and honoured at send time, but absent from the update
   * schema — sending it is silently stripped, so the switch would report a
   * successful save and change nothing. Rendered disabled instead.
   */
  readOnly?: boolean;
};

const EVENTS: EventMeta[] = [
  { key: 'orderCreated', labelKey: 'notifications.settings.events.orderCreated', descriptionKey: 'notifications.settings.events.orderCreatedHint' },
  { key: 'orderCancelled', labelKey: 'notifications.settings.events.orderCancelled', descriptionKey: 'notifications.settings.events.orderCancelledHint' },
  { key: 'bookingCreated', labelKey: 'notifications.settings.events.bookingCreated', descriptionKey: 'notifications.settings.events.bookingCreatedHint' },
  { key: 'bookingCancelled', labelKey: 'notifications.settings.events.bookingCancelled', descriptionKey: 'notifications.settings.events.bookingCancelledHint' },
  { key: 'paymentReceivedPartial', labelKey: 'notifications.settings.events.paymentReceivedPartial', descriptionKey: 'notifications.settings.events.paymentReceivedPartialHint' },
  { key: 'paymentReceivedFull', labelKey: 'notifications.settings.events.paymentReceivedFull', descriptionKey: 'notifications.settings.events.paymentReceivedFullHint' },
  // These two share only the word "storage": `storageAlert` is the media-file
  // quota, `agencyStorageUpdates` is physical goods in an agency's building.
  // Kept adjacent so their labels are read against each other.
  { key: 'storageAlert', labelKey: 'notifications.settings.events.storageAlert', descriptionKey: 'notifications.settings.events.storageAlertHint', hint: true },
  { key: 'agencyStorageUpdates', labelKey: 'notifications.settings.events.agencyStorageUpdates', descriptionKey: 'notifications.settings.events.agencyStorageUpdatesHint', hint: true },
  { key: 'connectionUpdated', labelKey: 'notifications.settings.events.connectionUpdated', descriptionKey: 'notifications.settings.events.connectionUpdatedHint' },
  { key: 'payoutUpdates', labelKey: 'notifications.settings.events.payoutUpdates', descriptionKey: 'notifications.settings.events.payoutUpdatesHint' },
  { key: 'shipmentRejected', labelKey: 'notifications.settings.events.shipmentRejected', descriptionKey: 'notifications.settings.events.shipmentRejectedHint' },
  { key: 'codLimitUpdates', labelKey: 'notifications.settings.events.codLimitUpdates', descriptionKey: 'notifications.settings.events.codLimitUpdatesHint' },
  { key: 'deliveryFeeProposals', labelKey: 'notifications.settings.events.deliveryFeeProposals', descriptionKey: 'notifications.settings.events.deliveryFeeProposalsHint' },
  { key: 'planUpdates', labelKey: 'notifications.settings.events.planUpdates', descriptionKey: 'notifications.settings.events.planUpdatesHint', readOnly: true },
];

/** The events a PATCH can actually change — everything except `planUpdates`. */
const WRITABLE_EVENTS = EVENTS.filter((e) => !e.readOnly);

const LANGUAGES: { value: PreferredLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'pt', label: 'Português' },
  { value: 'es', label: 'Español' },
  { value: 'ar', label: 'العربية' },
];

const ALLOWED_LANGS = LANGUAGES.map((l) => l.value);

// ─── Helpers ────────────────────────────────────────────────────────────────

/** The single active secondary channel, in backend priority order, else in-app. */
function deriveChannel(p: NotificationPreferences): DeliveryChannelChoice {
  if (p.telegramEnabled) return 'telegram';
  if (p.emailEnabled) return 'email';
  if (p.whatsappEnabled) return 'whatsapp';
  return 'in-app';
}

function isVerified(p: NotificationPreferences, channel: SecondaryChannel): boolean {
  if (channel === 'telegram') return p.telegramVerified;
  if (channel === 'email') return p.emailVerified;
  return p.whatsappVerified;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function NotificationSettings() {
  const { t } = useTranslation();
  const m = useMessage();
  const { session, updateVendorProfile } = useOnboarding();
  const roleEntity = session?.role_entity;

  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Editable local state
  const [channel, setChannel] = useState<DeliveryChannelChoice>('in-app');
  const [events, setEvents] = useState<NotificationEventPreferences | null>(null);
  const [language, setLanguage] = useState<PreferredLanguage>('en');

  // Server snapshots used for dirty-checking
  const [savedChannel, setSavedChannel] = useState<DeliveryChannelChoice>('in-app');
  const [savedLanguage, setSavedLanguage] = useState<PreferredLanguage>('en');

  // Channel setup / management
  const [setupChannel, setSetupChannel] = useState<SecondaryChannel | null>(null);
  const [unlinking, setUnlinking] = useState<SecondaryChannel | null>(null);
  /**
   * The messaging connections behind `telegramVerified` / `whatsappVerified`.
   *
   * The preference flags say *whether* a channel is linked; this says *what* it is
   * linked to — the masked identity to show on a connected row, and the bot handle
   * and deep link the setup dialog needs for one that isn't. Failing to load it
   * must not break the page, so it degrades to an empty list.
   */
  const [connections, setConnections] = useState<MessagingConnection[]>([]);

  const connectionFor = useCallback(
    (channel: MessagingChannel) => connections.find((c) => c.channel === channel),
    [connections],
  );

  const loadConnections = useCallback(async () => {
    try {
      setConnections(await listConnections());
    } catch {
      // Non-fatal: the *Verified flags still drive every gate on this screen.
      setConnections([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchNotificationPreferences();
      setPrefs(data);
      void loadConnections();
      const ch = deriveChannel(data);
      setChannel(ch);
      setSavedChannel(ch);
      // Keys an older document omits already read as ON — the service fills
      // them (`withEventDefaults`), so this copy and `prefs` agree.
      setEvents({ ...data.preferences });
    } catch (err) {
      setLoadError(mapProfileError(err));
    } finally {
      setLoading(false);
    }
  }, [loadConnections]);

  useEffect(() => {
    load();
  }, [load]);

  // Seed language from the vendor profile session.
  useEffect(() => {
    const raw = roleEntity?.preferred_language;
    const lang = (raw && ALLOWED_LANGS.includes(raw as PreferredLanguage) ? raw : 'en') as PreferredLanguage;
    setLanguage(lang);
    setSavedLanguage(lang);
  }, [roleEntity?.preferred_language]);

  // Only the writable events count. Including `planUpdates` would let the bar
  // appear for a change the backend strips, so Save would succeed and the row
  // would spring back.
  const eventsDirty = useMemo(() => {
    if (!prefs || !events) return false;
    return WRITABLE_EVENTS.some((e) => events[e.key] !== prefs.preferences[e.key]);
  }, [events, prefs]);

  const channelDirty = channel !== savedChannel;
  const languageDirty = language !== savedLanguage;
  const dirty = eventsDirty || channelDirty || languageDirty;

  const toggleEvent = useCallback((key: NotificationEventKey) => {
    setEvents((prev) => (prev ? { ...prev, [key]: !prev[key] } : prev));
  }, []);

  // Pick a secondary channel as active (or unpick → back to in-app only).
  const selectChannel = useCallback((next: DeliveryChannelChoice) => {
    setChannel((cur) => (cur === next ? 'in-app' : next));
  }, []);

  /**
   * Re-fetch preferences; return whether `ch` is now verified (for the dialog).
   *
   * Connections are re-read alongside, because a successful link flips the
   * matching `*Verified` flag AND changes what the row should say about itself.
   */
  const refreshForChannel = useCallback(
    async (ch: SecondaryChannel): Promise<boolean> => {
      const data = await fetchNotificationPreferences();
      setPrefs(data);
      setSavedChannel(deriveChannel(data));
      void loadConnections();
      return isVerified(data, ch);
    },
    [loadConnections],
  );

  const handleUnlink = useCallback(
    async (ch: SecondaryChannel) => {
      const messaging = asMessagingChannel(ch);
      // Email has no connection to remove — it is verified, not linked.
      if (!messaging) return;
      setUnlinking(ch);
      try {
        await disconnectChannel(messaging);
        const data = await fetchNotificationPreferences();
        setPrefs(data);
        void loadConnections();
        const derived = deriveChannel(data);
        setSavedChannel(derived);
        // If the unlinked channel was the active selection, fall back to in-app.
        setChannel((cur) => (cur === ch ? derived : cur));
        toast.success(
          t('notifications.settings.disconnected', {
            channel: ch === 'telegram' ? 'Telegram' : 'WhatsApp',
          }),
        );
      } catch (err) {
        toast.error(m(mapProfileError(err)));
      } finally {
        setUnlinking(null);
      }
    },
    [t, m, loadConnections],
  );

  // Roll every editable field back to the last server snapshot.
  const handleDiscard = useCallback(() => {
    setChannel(savedChannel);
    setLanguage(savedLanguage);
    setEvents(prefs ? { ...prefs.preferences } : null);
  }, [prefs, savedChannel, savedLanguage]);

  const handleSave = useCallback(async () => {
    if (!prefs || !events) return;
    setSaving(true);
    try {
      if (channelDirty || eventsDirty) {
        const updated = await updateNotificationPreferences({
          ...(channelDirty
            ? {
                emailEnabled: channel === 'email',
                telegramEnabled: channel === 'telegram',
                whatsappEnabled: channel === 'whatsapp',
              }
            : {}),
          // `planUpdates` is stripped server-side, so send only what can land.
          ...(eventsDirty
            ? {
                preferences: Object.fromEntries(
                  WRITABLE_EVENTS.map((e) => [e.key, events[e.key]]),
                ) as Partial<NotificationEventPreferences>,
              }
            : {}),
        });
        setPrefs(updated);
        const ch = deriveChannel(updated);
        setChannel(ch);
        setSavedChannel(ch);
        setEvents({ ...updated.preferences });
      }

      if (languageDirty) {
        await updateVendorProfile({ preferred_language: language });
        setSavedLanguage(language);
      }

      toast.success(t('notifications.settings.saved'));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'VENDOR_NOTIFICATION_CHANNEL_NOT_VERIFIED') {
        toast.error(t('notifications.settings.channelNotVerified'));
        load();
      } else {
        toast.error(m(mapProfileError(err)));
      }
    } finally {
      setSaving(false);
    }
  }, [prefs, events, channel, channelDirty, eventsDirty, languageDirty, language, updateVendorProfile, load, t, m]);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <PushPermissionBanner />
        <SettingsSections>
          <SettingsSection title={t('notifications.settings.delivery.title')} contentClassName="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[4.75rem] w-full rounded-lg" />
            ))}
          </SettingsSection>
          <SettingsSection title={t('notifications.settings.events.title')} contentClassName="space-y-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </SettingsSection>
        </SettingsSections>
      </div>
    );
  }

  if (loadError || !prefs || !events) {
    return (
      <div className="space-y-6">
        <PushPermissionBanner />
        <SettingsSections>
          <SettingsSection title={t('notifications.settings.title')} contentClassName="space-y-4">
            <div role="alert" className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
              {loadError ? m(loadError) : t('notifications.settings.loadFailed')}
            </div>
            <Button variant="outline" onClick={load}>{t('common.actions.retry')}</Button>
          </SettingsSection>
        </SettingsSections>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PushPermissionBanner />
      <SettingsSections>
        {/* Delivery channel — plain rows, not a stack of cards with badges: one
            icon, the name, one status line, one action. */}
        <SettingsSection
          title={t('notifications.settings.delivery.title')}
          info={
            <div className="space-y-2">
              <p>{t('notifications.settings.delivery.info')}</p>
              <p>{t('notifications.settings.delivery.inAppHint')}</p>
            </div>
          }
        >
          <div className="divide-y">
            {/* In-app — always on, locked */}
            <div className="flex min-h-14 items-center gap-3 pb-3">
              <Bell className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t('notifications.settings.delivery.inApp')}</p>
                <p className="text-sm text-muted-foreground">{t('notifications.settings.delivery.alwaysOn')}</p>
              </div>
            </div>

            {/* Secondary channels — connect first, then make one active */}
            <div className="divide-y" role="radiogroup" aria-label={t('notifications.settings.delivery.groupLabel')}>
              {SECONDARY_CHANNELS.map((c) => {
                const verified = prefs[c.verifyKey];
                const selected = channel === c.value;
                const busy = unlinking === c.value;
                const messaging = asMessagingChannel(c.value);
                const connection = messaging ? connectionFor(messaging) : undefined;
                const identityHint = connection?.identityHint ?? null;
                // A linked channel shows what it is linked TO. `identityHint` is
                // null for a Telegram account with no @handle — a normal state for
                // a connected channel — so it falls back to "Connected".
                const status = !verified
                  ? t('notifications.settings.delivery.notConnected')
                  : c.value === 'email' && roleEntity?.email
                    ? roleEntity.email
                    : identityHint ?? t('notifications.settings.delivery.connected');
                return (
                  <div key={c.value} className="flex min-h-14 items-center gap-3 py-3 last:pb-0">
                    <c.Icon className={cn('size-5 shrink-0', c.iconColor)} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{t(c.labelKey)}</p>
                      <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                        <span className="truncate">{status}</span>
                        {verified && c.unlinkable && (
                          <>
                            <span aria-hidden>·</span>
                            <button
                              type="button"
                              className="shrink-0 hover:text-destructive hover:underline disabled:opacity-50"
                              disabled={busy}
                              onClick={() => handleUnlink(c.value)}
                            >
                              {busy
                                ? <Loader2 className="size-3.5 animate-spin" />
                                : t('notifications.settings.disconnect')}
                            </button>
                          </>
                        )}
                      </p>
                    </div>

                    {!verified ? (
                      <Button variant="outline" size="sm" className="shrink-0" onClick={() => setSetupChannel(c.value)}>
                        {t('notifications.settings.delivery.connect')}
                      </Button>
                    ) : (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={t(
                          selected
                            ? 'notifications.settings.delivery.turnOff'
                            : 'notifications.settings.delivery.makeActive',
                          { channel: t(c.labelKey) },
                        )}
                        onClick={() => selectChannel(c.value)}
                        className={cn(
                          'tap-target flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                          selected
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-input text-muted-foreground hover:border-primary hover:text-primary',
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'flex size-3.5 items-center justify-center rounded-full border',
                            selected ? 'border-primary' : 'border-current',
                          )}
                        >
                          {selected && <span className="size-1.5 rounded-full bg-primary" />}
                        </span>
                        {t(selected
                          ? 'notifications.settings.delivery.active'
                          : 'notifications.settings.delivery.use')}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </SettingsSection>

        {/* Language */}
        {/* <SettingsSection
          title="Language"
          info="The language every notification is written in — email, WhatsApp, Telegram and in-app alike. It doesn't change the language of this dashboard."
        >
          <Select value={language} onValueChange={(v) => setLanguage(v as PreferredLanguage)}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsSection> */}

        {/* Events */}
        <SettingsSection
          title={t('notifications.settings.events.title')}
          info={t('notifications.settings.events.info')}
        >
          <div className="divide-y">
            {EVENTS.map((e) => (
              <div key={e.key} className="flex min-h-12 items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-center gap-1">
                  <p className="truncate text-sm font-medium">{t(e.labelKey)}</p>
                  {e.hint && (
                    <InfoHint label={t('notifications.settings.events.about', { event: t(e.labelKey) })}>
                      {t(e.descriptionKey)}
                    </InfoHint>
                  )}
                </div>
                <Switch
                  className="shrink-0"
                  checked={events[e.key]}
                  onCheckedChange={() => toggleEvent(e.key)}
                  // The update schema has no key for this one, so a toggle would
                  // report a save and change nothing.
                  disabled={e.readOnly}
                  aria-label={t(e.labelKey)}
                />
              </div>
            ))}
          </div>
        </SettingsSection>
      </SettingsSections>

      <UnsavedChangesBar
        visible={dirty || saving}
        saving={saving}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />

      <ChannelSetupDialog
        channel={setupChannel}
        verified={setupChannel ? isVerified(prefs, setupChannel) : false}
        vendorEmail={roleEntity?.email}
        instructions={
          setupChannel && asMessagingChannel(setupChannel)
            ? connectionFor(asMessagingChannel(setupChannel)!)?.howToConnect
            : undefined
        }
        onRefresh={() => (setupChannel ? refreshForChannel(setupChannel) : Promise.resolve(false))}
        onClose={() => setSetupChannel(null)}
      />
    </div>
  );
}
