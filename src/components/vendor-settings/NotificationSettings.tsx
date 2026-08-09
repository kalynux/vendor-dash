import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Mail,
  Loader2,
  Lock,
  ShoppingCart,
  PackageX,
  CalendarPlus,
  CalendarX2,
  CircleDollarSign,
  CheckCircle2,
  HardDrive,
  Warehouse,
  Handshake,
  Wallet,
  CalendarClock,
  ShieldCheck,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { useOnboarding } from '@/onboarding/store/onboarding.store';
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
} from '@/services/notifications.service';
import { PushPermissionBanner } from '@/components/notifications/PushPermissionBanner';
import {
  disconnectTelegram,
  unlinkWhatsapp,
} from '@/services/notification-channels.service';
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

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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
  iconWrap: string;
  verifyKey: 'emailVerified' | 'telegramVerified' | 'whatsappVerified';
  /** Whether the link can be removed in-app (email can't be un-verified). */
  unlinkable: boolean;
};

const SECONDARY_CHANNELS: ChannelMeta[] = [
  {
    value: 'telegram',
    labelKey: 'notifications.settings.channels.telegram',
    Icon: TelegramIcon,
    iconWrap: 'bg-[#0088cc]/10 text-[#0088cc]',
    verifyKey: 'telegramVerified',
    unlinkable: true,
  },
  {
    value: 'email',
    labelKey: 'notifications.settings.channels.email',
    Icon: ({ className }) => <Mail className={className} />,
    iconWrap: 'bg-primary/10 text-primary',
    verifyKey: 'emailVerified',
    unlinkable: false,
  },
  {
    value: 'whatsapp',
    labelKey: 'notifications.settings.channels.whatsapp',
    Icon: WhatsappIcon,
    iconWrap: 'bg-[#25D366]/10 text-[#25D366]',
    verifyKey: 'whatsappVerified',
    unlinkable: true,
  },
];

type EventMeta = {
  key: NotificationEventKey;
  labelKey: TranslationKey;
  descriptionKey: TranslationKey;
  Icon: LucideIcon;
};

const EVENTS: EventMeta[] = [
  { key: 'orderCreated', labelKey: 'notifications.settings.events.orderCreated', descriptionKey: 'notifications.settings.events.orderCreatedHint', Icon: ShoppingCart },
  { key: 'orderCancelled', labelKey: 'notifications.settings.events.orderCancelled', descriptionKey: 'notifications.settings.events.orderCancelledHint', Icon: PackageX },
  { key: 'bookingCreated', labelKey: 'notifications.settings.events.bookingCreated', descriptionKey: 'notifications.settings.events.bookingCreatedHint', Icon: CalendarPlus },
  { key: 'bookingCancelled', labelKey: 'notifications.settings.events.bookingCancelled', descriptionKey: 'notifications.settings.events.bookingCancelledHint', Icon: CalendarX2 },
  { key: 'paymentReceivedPartial', labelKey: 'notifications.settings.events.paymentReceivedPartial', descriptionKey: 'notifications.settings.events.paymentReceivedPartialHint', Icon: CircleDollarSign },
  { key: 'paymentReceivedFull', labelKey: 'notifications.settings.events.paymentReceivedFull', descriptionKey: 'notifications.settings.events.paymentReceivedFullHint', Icon: CheckCircle2 },
  // These two share only the word "storage": `storageAlert` is the media-file
  // quota, `agencyStorageUpdates` is physical goods in an agency's building.
  // Kept adjacent so their labels are read against each other.
  { key: 'storageAlert', labelKey: 'notifications.settings.events.storageAlert', descriptionKey: 'notifications.settings.events.storageAlertHint', Icon: HardDrive },
  { key: 'agencyStorageUpdates', labelKey: 'notifications.settings.events.agencyStorageUpdates', descriptionKey: 'notifications.settings.events.agencyStorageUpdatesHint', Icon: Warehouse },
  { key: 'connectionUpdated', labelKey: 'notifications.settings.events.connectionUpdated', descriptionKey: 'notifications.settings.events.connectionUpdatedHint', Icon: Handshake },
  { key: 'payoutUpdates', labelKey: 'notifications.settings.events.payoutUpdates', descriptionKey: 'notifications.settings.events.payoutUpdatesHint', Icon: Wallet },
  { key: 'shipmentRejected', labelKey: 'notifications.settings.events.shipmentRejected', descriptionKey: 'notifications.settings.events.shipmentRejectedHint', Icon: PackageX },
  { key: 'planUpdates', labelKey: 'notifications.settings.events.planUpdates', descriptionKey: 'notifications.settings.events.planUpdatesHint', Icon: CalendarClock },
];

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

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchNotificationPreferences();
      setPrefs(data);
      const ch = deriveChannel(data);
      setChannel(ch);
      setSavedChannel(ch);
      // A backend that predates a key omits it, and `undefined` would render
      // the row as off — the opposite of its documented default. Coalesce after
      // the spread so the stored value still wins when it is present.
      setEvents({
        ...data.preferences,
        agencyStorageUpdates: data.preferences.agencyStorageUpdates ?? true,
      });
    } catch (err) {
      setLoadError(mapProfileError(err));
    } finally {
      setLoading(false);
    }
  }, []);

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

  const eventsDirty = useMemo(() => {
    if (!prefs || !events) return false;
    return EVENTS.some((e) => events[e.key] !== prefs.preferences[e.key]);
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

  /** Re-fetch preferences; return whether `ch` is now verified (for the dialog). */
  const refreshForChannel = useCallback(
    async (ch: SecondaryChannel): Promise<boolean> => {
      const data = await fetchNotificationPreferences();
      setPrefs(data);
      setSavedChannel(deriveChannel(data));
      return isVerified(data, ch);
    },
    [],
  );

  const handleUnlink = useCallback(
    async (ch: SecondaryChannel) => {
      setUnlinking(ch);
      try {
        if (ch === 'telegram') await disconnectTelegram();
        else if (ch === 'whatsapp') await unlinkWhatsapp();
        const data = await fetchNotificationPreferences();
        setPrefs(data);
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
    [t, m],
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
          ...(eventsDirty ? { preferences: events } : {}),
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
        {/* Delivery channel */}
        <SettingsSection
          title={t('notifications.settings.delivery.title')}
          info={t('notifications.settings.delivery.info')}
          contentClassName="space-y-3"
        >
          {/* In-app — always on, locked */}
          <div className="rounded-lg border bg-muted/30 p-3 sm:p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bell className="size-5" />
              </div>
              <p className="min-w-0 flex-1 font-medium leading-none">
                {t('notifications.settings.delivery.inApp')}
              </p>
              <Badge variant="secondary" className="shrink-0">
                <Lock /> {t('notifications.settings.delivery.alwaysOn')}
              </Badge>
            </div>
            <p className="mt-2.5 text-sm text-muted-foreground sm:pl-12">
              {t('notifications.settings.delivery.inAppHint')}
            </p>
          </div>

          {/* Secondary channels — connect first, then make one active */}
          <div className="space-y-3" role="radiogroup" aria-label={t('notifications.settings.delivery.groupLabel')}>
            {SECONDARY_CHANNELS.map((c) => {
              const verified = prefs[c.verifyKey];
              const selected = channel === c.value;
              const busy = unlinking === c.value;
              return (
                <div
                  key={c.value}
                  className={cn(
                    'rounded-lg border p-3 transition-colors sm:p-4',
                    selected && 'border-primary ring-1 ring-primary',
                    !verified && 'bg-muted/20',
                  )}
                >
                  {/* Identity, with the active indicator pinned to the top right.
                      The old leading radio dot cost the label row ~32px and a 20px
                      tap target; folding it into this pill gives the text the width
                      and makes the state readable at a glance. */}
                  <div className="flex items-center gap-3">
                    <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', c.iconWrap)}>
                      <c.Icon className="size-5" />
                    </div>

                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-medium leading-none">{t(c.labelKey)}</p>
                      {verified ? (
                        <Badge className="border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck /> {t('notifications.settings.delivery.connected')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          <ShieldAlert /> {t('notifications.settings.delivery.notConnected')}
                        </Badge>
                      )}
                    </div>

                    {/* Only rendered once verified — before that "Connect" below is
                        the only meaningful action, and a dead control just crowds
                        the row. */}
                    {verified && (
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
                          'flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold transition-colors',
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

                  {/* Helper copy + action share a full-width row, so neither has to
                      fight the icon and the indicator for horizontal space. */}
                  <div className="mt-2.5 flex items-center justify-between gap-3 sm:pl-12">
                    <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                      {c.value === 'email' && verified && roleEntity?.email
                        ? roleEntity.email
                        : !verified
                          ? t('notifications.settings.delivery.connectToUse')
                          : selected
                            ? t('notifications.settings.delivery.alsoGoHere')
                            : t('notifications.settings.delivery.tapUse')}
                    </p>

                    {!verified ? (
                      <Button variant="outline" size="sm" className="shrink-0" onClick={() => setSetupChannel(c.value)}>
                        {t('notifications.settings.delivery.connect')}
                      </Button>
                    ) : c.unlinkable ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        disabled={busy}
                        onClick={() => handleUnlink(c.value)}
                      >
                        {busy
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : t('notifications.settings.disconnect')}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </SettingsSection>

        {/* Language */}
        {/* <SettingsSection
          title="Language"
          icon={Languages}
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
              <div key={e.key} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <e.Icon className="size-4" />
                  </div>
                  <div className="flex min-w-0 items-center gap-1">
                    <p className="truncate font-medium">{t(e.labelKey)}</p>
                    <InfoHint label={t('notifications.settings.events.about', { event: t(e.labelKey) })}>
                      {t(e.descriptionKey)}
                    </InfoHint>
                  </div>
                </div>
                <Switch
                  className="shrink-0"
                  checked={events[e.key]}
                  onCheckedChange={() => toggleEvent(e.key)}
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
        onRefresh={() => (setupChannel ? refreshForChannel(setupChannel) : Promise.resolve(false))}
        onClose={() => setSetupChannel(null)}
      />
    </div>
  );
}
