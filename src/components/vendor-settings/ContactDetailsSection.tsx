import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AtSign, Info, Loader2, MessageCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';
import { PhoneInput } from '@/components/phone';
import { formatPhoneInternational, isValidPhone, phoneErrorKey } from '@/lib/phone';
import {
  cancelEmailChange,
  cancelPhoneChange,
  confirmPhoneChange,
  fetchContactState,
  requestEmailChange,
  requestPhoneChange,
} from '@/services/contact-change.service';
import { listConnections } from '@/services/connections.service';
import { isValidEmail, normalizeEmail } from '@/lib/email';
import type { ContactState, PendingContactChange } from '@/types/contact-change.types';
import { useApiError, useFormatters, useTranslation } from '@/i18n';

/** Which half of the panel has a form open. */
type OpenForm = 'email' | 'phone' | null;

/**
 * The account's sign-in identifiers — email and phone — and the two-step change
 * flow behind each.
 *
 * 🔴 **This is not the Profile tab's phone.** That field writes the vendor role
 * profile (`PATCH /vendor/profile`) and is a contact number on a business record.
 * This one is the account identifier you sign in with (`PATCH /api/me/phone`),
 * which is why it lives on Security beside the password rather than beside it.
 * The backend propagates a confirmed change out to every role profile
 * best-effort, so they converge — but they are two records and can differ.
 *
 * Two things this panel must never say:
 *
 *  - ⚠ **Do not warn about being signed out.** Neither change stamps the
 *    password epoch, so every existing token on every device keeps working.
 *    (Changing a *password* does sign other sessions out — different endpoint.)
 *  - ⚠ **The pending value is not the identifier.** Sign-in keeps using the old
 *    value until confirmation, which is why every pending banner says so
 *    explicitly. Without that line, a vendor who changes their email and closes
 *    the tab will try signing in with the new one and fail.
 */
export function ContactDetailsSection() {
  const { t } = useTranslation();
  const apiError = useApiError();

  const [state, setState] = useState<ContactState | null>(null);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState<OpenForm>(null);
  const [emailDraft, setEmailDraft] = useState('');
  const [phoneDraft, setPhoneDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  /**
   * WhatsApp's masked identity hint (`"••••1234"`), or `null` when the channel is
   * not linked. This is the whole reason the phone half needs a second request.
   */
  const [whatsappHint, setWhatsappHint] = useState<string | null>(null);
  const [whatsappLinked, setWhatsappLinked] = useState<boolean | null>(null);

  const reload = useCallback(async () => {
    try {
      setState(await fetchContactState());
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'account.contact.errors.loadFailed' });
    } finally {
      setLoading(false);
    }
  }, [apiError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // The phone flow is proven entirely by a WhatsApp connection, so its state is
  // needed before the form is offered — not after a 422.
  useEffect(() => {
    let cancelled = false;
    listConnections()
      .then((connections) => {
        if (cancelled) return;
        const whatsapp = connections.find((c) => c.channel === 'whatsapp');
        setWhatsappLinked(whatsapp?.connected ?? false);
        setWhatsappHint(whatsapp?.identityHint ?? null);
      })
      .catch(() => {
        // Unknown, not "absent". Rendering the blocking notice off a failed
        // request would tell a vendor with a perfectly good connection that they
        // cannot change their number.
        if (!cancelled) setWhatsappLinked(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const run = useCallback(
    async (key: string, action: () => Promise<void>, successKey: Parameters<typeof t>[0]) => {
      setBusy(key);
      try {
        await action();
        toast.success(t(successKey));
        setOpenForm(null);
        await reload();
      } catch (err) {
        apiError.toast(err, { fallbackKey: 'account.contact.errors.actionFailed' });
      } finally {
        setBusy(null);
      }
    },
    [t, reload, apiError],
  );

  if (loading) {
    return (
      <SettingsSection title={t('account.contact.title')} icon={AtSign}>
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </SettingsSection>
    );
  }

  if (!state) return null;

  // Compared against the canonical form the backend stores, so re-entering the
  // current address with different capitalisation is caught here rather than
  // coming back as 422 CONTACT_CHANGE_SAME_IDENTIFIER.
  const emailValid =
    isValidEmail(emailDraft) && normalizeEmail(emailDraft) !== normalizeEmail(state.email);
  const phoneValid =
    isValidPhone(phoneDraft) && phoneDraft !== state.phone && phoneErrorKey(phoneDraft) === null;

  // Weak by necessity: the connections surface exposes only the masked last four
  // digits, never the raw number, so this can spot an obvious mismatch but cannot
  // confirm a match. It warns rather than blocks — the server is the authority,
  // and a mask formatted differently must not lock a vendor out of the flow.
  const hintDigits = whatsappHint?.replace(/\D/g, '') ?? '';
  const draftDigits = phoneDraft.replace(/\D/g, '');
  const likelyMismatch =
    whatsappLinked === true &&
    hintDigits.length >= 4 &&
    draftDigits.length >= 4 &&
    !draftDigits.endsWith(hintDigits.slice(-4));

  return (
    <SettingsSection
      title={t('account.contact.title')}
      icon={AtSign}
      info={t('account.contact.info')}
      contentClassName="space-y-5"
    >
      {/* ── Email ──────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t('account.contact.emailLabel')}</p>
            <p className="truncate text-sm font-medium">{state.email}</p>
          </div>
          {!state.pendingEmail && openForm !== 'email' && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setEmailDraft('');
                setOpenForm('email');
              }}
            >
              {t('account.contact.change')}
            </Button>
          )}
        </div>

        {state.pendingEmail ? (
          <PendingBanner
            pending={state.pendingEmail}
            noticeKey="account.contact.emailPendingNotice"
            busy={busy === 'cancel-email'}
            onCancel={() =>
              void run('cancel-email', cancelEmailChange, 'account.contact.emailChangeCancelled')
            }
          />
        ) : openForm === 'email' ? (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-email" className="text-xs text-muted-foreground">
                {t('account.contact.newEmailLabel')}
              </Label>
              <Input
                id="new-email"
                type="email"
                autoComplete="email"
                value={emailDraft}
                onChange={(e) => setEmailDraft(e.target.value)}
                placeholder={t('account.contact.newEmailPlaceholder')}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('account.contact.emailFlowHint')}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!emailValid || busy === 'request-email'}
                onClick={() =>
                  void run(
                    'request-email',
                    () => requestEmailChange(normalizeEmail(emailDraft)),
                    'account.contact.emailChangeRequested',
                  )
                }
              >
                {busy === 'request-email' && <Loader2 className="size-4 animate-spin" />}
                {t('account.contact.sendLink')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setOpenForm(null)}>
                {t('common.actions.cancel')}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <Separator />

      {/* ── Phone ──────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{t('account.contact.phoneLabel')}</p>
            <p className="truncate text-sm font-medium">
              {state.phone ? formatPhoneInternational(state.phone) : t('common.labels.emptyValue')}
            </p>
          </div>
          {!state.pendingPhone && openForm !== 'phone' && (
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setPhoneDraft('');
                setOpenForm('phone');
              }}
            >
              {t('account.contact.change')}
            </Button>
          )}
        </div>

        {/*
          🔴 The one thing that surprises everyone about this flow: there is no
          SMS code. The proof is that the account already has a WhatsApp
          connection whose number IS the new one — and a Telegram connection does
          not count. Said before the form, not after a 422.
        */}
        {whatsappLinked === false && (
          <Alert>
            <MessageCircle className="size-4" />
            <AlertDescription className="space-y-2">
              <p>{t('account.contact.whatsappRequired')}</p>
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard/settings/notifications">
                  {t('account.contact.manageConnections')}
                </Link>
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {state.pendingPhone ? (
          <PendingBanner
            pending={state.pendingPhone}
            noticeKey="account.contact.phonePendingNotice"
            busy={busy === 'cancel-phone'}
            onCancel={() =>
              void run('cancel-phone', cancelPhoneChange, 'account.contact.phoneChangeCancelled')
            }
            action={
              <Button
                size="sm"
                disabled={busy === 'confirm-phone'}
                onClick={() =>
                  void run(
                    'confirm-phone',
                    async () => {
                      await confirmPhoneChange();
                    },
                    'account.contact.phoneChanged',
                  )
                }
              >
                {busy === 'confirm-phone' && <Loader2 className="size-4 animate-spin" />}
                {t('account.contact.confirmPhone')}
              </Button>
            }
          />
        ) : openForm === 'phone' ? (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-phone" className="text-xs text-muted-foreground">
                {t('account.contact.newPhoneLabel')}
              </Label>
              <PhoneInput id="new-phone" value={phoneDraft} onChange={setPhoneDraft} />
            </div>

            {likelyMismatch && (
              <Alert>
                <Info className="size-4" />
                <AlertDescription>
                  {t('account.contact.whatsappNumberMismatch', { hint: whatsappHint ?? '' })}
                </AlertDescription>
              </Alert>
            )}

            <p className="text-xs text-muted-foreground">{t('account.contact.phoneFlowHint')}</p>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!phoneValid || busy === 'request-phone'}
                onClick={() =>
                  void run(
                    'request-phone',
                    () => requestPhoneChange(phoneDraft),
                    'account.contact.phoneChangeRequested',
                  )
                }
              >
                {busy === 'request-phone' && <Loader2 className="size-4 animate-spin" />}
                {t('common.actions.continue')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setOpenForm(null)}>
                {t('common.actions.cancel')}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </SettingsSection>
  );
}

/**
 * The in-flight banner.
 *
 * `noticeKey` carries the "you still sign in with the old one" sentence, which
 * is the point of the banner — the countdown is secondary. Cancel is offered
 * unconditionally because it is a single call that only 409s when there was
 * nothing pending, which cannot be the case while this is rendered.
 */
function PendingBanner({
  pending,
  noticeKey,
  onCancel,
  busy,
  action,
}: {
  pending: PendingContactChange;
  noticeKey: Parameters<ReturnType<typeof useTranslation>['t']>[0];
  onCancel: () => void;
  busy: boolean;
  action?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  /**
   * `expiresAt` is absolute, so "expired" has to be re-evaluated over time
   * rather than rendered once — and it is read inside the interval callback
   * rather than during render, because `Date.now()` during render is impure.
   *
   * The cost is that an already-expired change takes one tick to say so. That
   * changes nothing a vendor would notice on a 1-hour (email) or 24-hour
   * (phone) window: the expiry time itself is shown from the first paint, and
   * `relativeTime` already renders a past instant in the past tense.
   */
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    const deadline = new Date(pending.expiresAt).getTime();
    const id = window.setInterval(() => setExpired(Date.now() >= deadline), 30_000);
    return () => window.clearInterval(id);
  }, [pending.expiresAt]);

  return (
    <Alert>
      <Phone className="size-4" />
      <AlertDescription className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          {t('account.contact.pendingTarget', { target: pending.target })}
        </p>
        <p>{t(noticeKey)}</p>
        <p className="text-xs">
          {expired
            ? t('account.contact.pendingExpired')
            : t('account.contact.pendingExpires', {
                when: fmt.relativeTime(pending.expiresAt),
              })}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {action}
          <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            {t('account.contact.cancelChange')}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
