import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AtSign, BadgeCheck, Loader2, MessageCircle, Phone } from 'lucide-react';
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
  fetchContactState,
  requestEmailChange,
  requestPhoneChange,
} from '@/services/contact-change.service';
import {
  confirmPhoneVerification,
  fetchPhoneVerificationState,
  phoneVerificationAttemptsLeft,
  requestPhoneVerificationCode,
} from '@/services/phone-verification.service';
import { isValidEmail, normalizeEmail } from '@/lib/email';
import { ApiError } from '@/types/api';
import type { ContactState, PendingContactChange } from '@/types/contact-change.types';
import type { PhoneVerificationState } from '@/types/phone-verification.types';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { useApiError, useFormatters, useTranslation } from '@/i18n';

/** Which half of the panel has a form open. */
type OpenForm = 'email' | 'phone' | null;

/**
 * Digits in a verification code. The confirm schema tolerates 4–12, but this flow
 * mints exactly six (`OTP_LENGTH` in the backend's phone-verification module), so
 * the field is sized to what a vendor will actually be holding.
 */
const CODE_LENGTH = 6;

/**
 * Mirrors `PHONE_VERIFY_RESEND_COOLDOWN_SECONDS`, applied optimistically after a
 * send so the resend button is not offered into a certain 429.
 *
 * ⚠ A local copy of a server default, not the authority. The real cooldown is
 * account-scoped and only the backend knows where it stands, so a
 * `PHONE_VERIFICATION_RESEND_TOO_SOON` always overrides this with its
 * `retryAfterSeconds`.
 */
const RESEND_COOLDOWN_SECONDS = 60;

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
 * ── Proving a phone number ───────────────────────────────────────────────────
 *
 * One way only: a six-digit code sent over WhatsApp (`/me/phone/verify/*`). It
 * verifies the number already on the account, and it completes a change to a new
 * one — `PATCH /me/phone`, then request the code, then enter it.
 *
 * ⛔ There used to be a second button here, "Confirm with WhatsApp", which
 * completed a change through a linked WhatsApp *connection* on the new number,
 * with a notice and a mismatch warning built around it. All three are gone: since
 * 2026-09-21 every frontend confirms with the code and the connection route is
 * left to the bot (see contact-change.service.ts). When the code completes a
 * change, the backend moves the WhatsApp link off the old number by itself.
 * See api-doc/me/contact-change.md and api-doc/me/phone-verification.md.
 *
 * Three things this panel must never say:
 *
 *  - ⛔ **Never tell the vendor to message the WhatsApp bot to get a code
 *    through.** When a send fails, every route has already been tried; the
 *    answer is "try again", then support. See `deliveryError`.
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
  const fmt = useFormatters();
  const apiError = useApiError();
  const { session } = useOnboarding();

  const [state, setState] = useState<ContactState | null>(null);
  const [verification, setVerification] = useState<PhoneVerificationState | null>(null);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState<OpenForm>(null);
  const [emailDraft, setEmailDraft] = useState('');
  const [phoneDraft, setPhoneDraft] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  // ── A send WhatsApp refused ────────────────────────────────────────────────
  /**
   * The `PHONE_VERIFICATION_DELIVERY_FAILED` message, shown in place rather than
   * as a toast: it needs a "try again" beside it, and a toast would take the
   * explanation away while the vendor is still deciding what to do.
   */
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  /**
   * Consecutive refusals. Support is offered from the second one ("if it happens
   * again", per the doc) — a single refusal is usually just WhatsApp being slow,
   * and a support link on the first reads as "this is broken".
   */
  const [deliveryFailures, setDeliveryFailures] = useState(0);

  // ── Code entry ─────────────────────────────────────────────────────────────
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  /** Masked target of the code in flight, as the send reported it. */
  const [codeTarget, setCodeTarget] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null);
  /**
   * Absolute instant the resend becomes available. Held as a deadline rather than
   * a counter so a re-render cannot lose seconds.
   */
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  /**
   * Set on a successful confirm so the row stops nagging immediately — the badge
   * otherwise reads the role profile, which this page does not re-fetch.
   */
  const [verifiedNow, setVerifiedNow] = useState(false);

  const reload = useCallback(async () => {
    try {
      // The verification state is an enhancement, not the backbone: if it fails
      // the panel still has to render the identifiers. Degrading to "no verify
      // affordance" beats blanking the whole section.
      const [contact, verifyState] = await Promise.all([
        fetchContactState(),
        fetchPhoneVerificationState().catch(() => null),
      ]);
      setState(contact);
      setVerification(verifyState);
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'account.contact.errors.loadFailed' });
    } finally {
      setLoading(false);
    }
  }, [apiError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Only ticks while a cooldown is actually running.
  useEffect(() => {
    if (resendAt === null) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [resendAt]);

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

  /**
   * Send a code, and open the entry panel.
   *
   * No body: the target is chosen **server-side** — the pending number when a
   * change is in flight, otherwise the current one. The caller never names it.
   */
  const sendCode = useCallback(async () => {
    setBusy('send-code');
    try {
      const result = await requestPhoneVerificationCode();
      setCode('');
      setCodeError(null);
      setAttemptsLeft(null);
      setCodeTarget(result.phoneMasked);
      setCodeExpiresAt(result.expiresAt);
      setResendAt(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);
      setNow(Date.now());
      setCodeOpen(true);
      setOpenForm(null);
      setDeliveryError(null);
      setDeliveryFailures(0);
      toast.success(t('account.contact.codeSent'));
    } catch (err) {
      // WhatsApp refused every route. Explained in place, never as "message the
      // bot" — see the component comment. No cooldown was started (the backend
      // stores a code only once a send works), so the button that sent it can be
      // pressed again straight away.
      if (err instanceof ApiError && err.code === 'PHONE_VERIFICATION_DELIVERY_FAILED') {
        setDeliveryError(apiError.resolve(err, { fallbackKey: 'account.contact.errors.actionFailed' }));
        setDeliveryFailures((n) => n + 1);
        return;
      }
      // A cooldown refusal means a code IS in flight, so the useful response is
      // to open the entry panel anyway — the vendor is holding a live code, and
      // dead-ending them on "wait" would make them wait for nothing.
      if (err instanceof ApiError && err.code === 'PHONE_VERIFICATION_RESEND_TOO_SOON') {
        setCodeOpen(true);
        setOpenForm(null);
        if (err.retryAfterSeconds != null) {
          setResendAt(Date.now() + err.retryAfterSeconds * 1000);
          setNow(Date.now());
        }
      }
      apiError.toast(err, { fallbackKey: 'account.contact.errors.actionFailed' });
    } finally {
      setBusy(null);
    }
  }, [t, apiError]);

  /** Spend the code. Sends only `code` — the confirm schema is `.strict()`. */
  const submitCode = useCallback(async () => {
    setBusy('confirm-code');
    try {
      const result = await confirmPhoneVerification(code);
      setCodeOpen(false);
      setCode('');
      setCodeError(null);
      setAttemptsLeft(null);
      setResendAt(null);
      setVerifiedNow(true);
      toast.success(
        t(
          result.changed
            ? 'account.contact.phoneChangedAndVerified'
            : 'account.contact.phoneVerified',
        ),
      );
      await reload();
    } catch (err) {
      // Stay put and let them try again. Clearing the field is deliberate: the
      // next attempt is a fresh code, not an edit of this one.
      setAttemptsLeft(phoneVerificationAttemptsLeft(err));
      setCodeError(apiError.resolve(err, { fallbackKey: 'account.contact.errors.actionFailed' }));
      setCode('');
      // Both of these destroy the code outright, so a new one is the only way
      // forward — release the cooldown rather than leaving the vendor staring at
      // a disabled button. The server is still the authority and may still 429.
      if (
        err instanceof ApiError &&
        (err.code === 'PHONE_VERIFICATION_TOO_MANY_ATTEMPTS' ||
          err.code === 'PHONE_VERIFICATION_CODE_EXPIRED')
      ) {
        setResendAt(null);
      }
    } finally {
      setBusy(null);
    }
  }, [code, t, reload, apiError]);

  /**
   * Open a phone change, then ask for the code straight away.
   *
   * Two calls, on purpose: `PATCH /me/phone` only writes the pending change, and
   * the backend leaves the send to an explicit request so the resend cooldown is
   * not already running when it arrives. Doing both here spares the vendor a
   * "Send code" tap the form's own hint already promised would happen. If the send
   * fails, the pending banner is already on screen with its own Send code button.
   */
  const submitPhoneChange = useCallback(async () => {
    setBusy('request-phone');
    try {
      await requestPhoneChange(phoneDraft);
    } catch (err) {
      apiError.toast(err, { fallbackKey: 'account.contact.errors.actionFailed' });
      setBusy(null);
      return;
    }
    setOpenForm(null);
    await reload();
    await sendCode();
  }, [phoneDraft, reload, sendCode, apiError]);

  /** Abandon the pending change, and the code that was on its way to it. */
  const cancelPhone = useCallback(async () => {
    setCodeOpen(false);
    setCode('');
    setCodeError(null);
    setDeliveryError(null);
    setDeliveryFailures(0);
    await run('cancel-phone', cancelPhoneChange, 'account.contact.phoneChangeCancelled');
  }, [run]);

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
  //
  // ⚠ `state.email` may be `null` — a vendor's email is optional at sign-up — and
  // `normalizeEmail(null)` throws. This used to be unguarded, so typing a valid
  // address into the form of an account with no email crashed the whole tab.
  const emailValid =
    isValidEmail(emailDraft) &&
    (state.email === null || normalizeEmail(emailDraft) !== normalizeEmail(state.email));
  const phoneValid =
    isValidPhone(phoneDraft) && phoneDraft !== state.phone && phoneErrorKey(phoneDraft) === null;

  /**
   * `phone_verified` lives on the role profile and describes the number on *that*
   * record, so it is only evidence about the account identifier while the two
   * agree. They converge after any confirmed change, but they are separate
   * records — and a stale "Verified" beside a number it does not describe is
   * worse than no badge at all.
   */
  const roleEntity = session?.role_entity;
  const phoneVerified =
    verifiedNow ||
    (roleEntity?.phone_verified === true && !!state.phone && roleEntity.phone === state.phone);

  // `phoneMasked: null` is the GET's way of saying the account carries no number
  // — the signal not to offer the flow. Only `request` raises NO_TARGET.
  const hasVerifiableNumber = verification?.phoneMasked != null;
  const canVerify = !state.pendingPhone && !phoneVerified && hasVerifiableNumber && !codeOpen;
  const cooldownLeft = resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000));
  const sending = busy === 'send-code';

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
            <p className="truncate text-sm font-medium">
              {state.email ?? t('common.labels.emptyValue')}
            </p>
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
              {t(state.email === null ? 'account.contact.add' : 'account.contact.change')}
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
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="truncate text-sm font-medium">
                {state.phone
                  ? formatPhoneInternational(state.phone)
                  : t('common.labels.emptyValue')}
              </p>
              {phoneVerified && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <BadgeCheck className="size-3.5" />
                  {t('account.contact.verified')}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {canVerify && (
              <Button variant="outline" size="sm" disabled={sending} onClick={() => void sendCode()}>
                {sending && <Loader2 className="size-4 animate-spin" />}
                {t('account.contact.verify')}
              </Button>
            )}
            {!state.pendingPhone && openForm !== 'phone' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setPhoneDraft('');
                  setOpenForm('phone');
                }}
              >
                {t(state.phone === null ? 'account.contact.add' : 'account.contact.change')}
              </Button>
            )}
          </div>
        </div>

        {/* The reason to press Verify, said beside the button rather than in a
            banner — an unverified number is not an error state. */}
        {canVerify && (
          <p className="text-xs text-muted-foreground">{t('account.contact.verifyPrompt')}</p>
        )}

        {state.pendingPhone && (
          <PendingBanner
            pending={state.pendingPhone}
            noticeKey="account.contact.phonePendingNotice"
            busy={busy === 'cancel-phone'}
            onCancel={() => void cancelPhone()}
            action={
              !codeOpen && (
                <Button size="sm" disabled={sending} onClick={() => void sendCode()}>
                  {sending && <Loader2 className="size-4 animate-spin" />}
                  {t('account.contact.sendCode')}
                </Button>
              )
            }
          />
        )}

        {/*
          WhatsApp refused the send on every route. The doc's contract: say it is
          temporary, let them try again, and offer support if it keeps happening —
          never "message the bot first", which used to make things worse.

          No retry button of its own: whichever button sent the code (Verify on
          the row, Send code on the pending banner, Send a new code on the code
          panel) is still on screen and is the retry — a second one here would
          read as a different action. A code sent earlier still works; a failed
          resend leaves it untouched on the server.

          Neutral, not destructive-red: the doc frames this as temporary, and a red
          box reads as "the platform is broken".
        */}
        {deliveryError && (
          <Alert>
            <MessageCircle className="size-4" />
            <AlertDescription className="space-y-2">
              <p>{deliveryError}</p>
              {deliveryFailures > 1 && (
                <>
                  <p>{t('account.contact.deliverySupportHint')}</p>
                  <div className="pt-1">
                    <Button asChild variant="outline" size="sm">
                      <Link to="/dashboard/tickets" state={{ create: true }}>
                        {t('account.contact.contactSupport')}
                      </Link>
                    </Button>
                  </div>
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        {codeOpen && (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                {t('account.contact.codeSentTo', {
                  phone: codeTarget ?? verification?.phoneMasked ?? '',
                })}
              </p>
              {/*
                🔴 `completesPendingChange` is the field that decides this copy.
                True: the code proves the NEW number and spending it swaps the
                account's identifier. False: it only proves the number already on
                the account. Backwards, it tells a vendor their sign-in number is
                about to move when it is not.
              */}
              <p className="text-xs text-muted-foreground">
                {verification?.completesPendingChange || state.pendingPhone
                  ? t('account.contact.codeCompletesChange')
                  : t('account.contact.codeVerifiesCurrent')}
                {codeExpiresAt !== null && (
                  <>
                    {' '}
                    {t('account.contact.codeExpires', {
                      when: fmt.relativeTime(codeExpiresAt),
                    })}
                  </>
                )}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone-code" className="text-xs text-muted-foreground">
                {t('account.contact.codeLabel')}
              </Label>
              <Input
                id="phone-code"
                value={code}
                onChange={(e) => {
                  // The field only ever holds a code, so non-digits are dropped
                  // as they are typed rather than rejected on submit.
                  setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, CODE_LENGTH));
                  setCodeError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || code.length !== CODE_LENGTH || busy !== null) return;
                  e.preventDefault();
                  void submitCode();
                }}
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                maxLength={CODE_LENGTH}
                placeholder={t('account.contact.codePlaceholder')}
                aria-invalid={!!codeError}
                aria-describedby={codeError ? 'phone-code-error' : undefined}
                disabled={busy === 'confirm-code'}
                className="text-center text-lg tracking-[0.4em]"
              />
            </div>

            {codeError && (
              <p id="phone-code-error" className="text-sm text-destructive" role="alert">
                {codeError}
                {/* Only when the backend actually said so — an invented number
                    here is worse than none. */}
                {attemptsLeft !== null && (
                  <>{' '}{t('account.contact.attemptsLeft', { count: attemptsLeft })}</>
                )}
              </p>
            )}

            <p className="text-xs text-muted-foreground">{t('account.contact.codeDeliveryHint')}</p>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={code.length !== CODE_LENGTH || busy === 'confirm-code'}
                onClick={() => void submitCode()}
              >
                {busy === 'confirm-code' && <Loader2 className="size-4 animate-spin" />}
                {t('account.contact.submitCode')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={cooldownLeft > 0 || sending}
                onClick={() => void sendCode()}
              >
                {sending && <Loader2 className="size-4 animate-spin" />}
                {cooldownLeft > 0
                  ? t('account.contact.resendIn', { seconds: cooldownLeft })
                  : t('account.contact.resendCode')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCodeOpen(false);
                  setCode('');
                  setCodeError(null);
                  setAttemptsLeft(null);
                  setDeliveryError(null);
                  setDeliveryFailures(0);
                }}
              >
                {t('common.actions.cancel')}
              </Button>
            </div>
          </div>
        )}

        {!state.pendingPhone && openForm === 'phone' && (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-phone" className="text-xs text-muted-foreground">
                {t('account.contact.newPhoneLabel')}
              </Label>
              <PhoneInput id="new-phone" value={phoneDraft} onChange={setPhoneDraft} />
            </div>

            <p className="text-xs text-muted-foreground">{t('account.contact.phoneFlowHint')}</p>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!phoneValid || busy === 'request-phone'}
                onClick={() => void submitPhoneChange()}
              >
                {busy === 'request-phone' && <Loader2 className="size-4 animate-spin" />}
                {t('common.actions.continue')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setOpenForm(null)}>
                {t('common.actions.cancel')}
              </Button>
            </div>
          </div>
        )}
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
