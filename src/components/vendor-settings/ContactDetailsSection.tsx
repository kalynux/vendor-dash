import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AtSign, BadgeCheck, Info, Loader2, MessageCircle, Phone } from 'lucide-react';
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
import {
  confirmPhoneVerification,
  fetchPhoneVerificationState,
  phoneVerificationAttemptsLeft,
  requestPhoneVerificationCode,
} from '@/services/phone-verification.service';
import { listConnections } from '@/services/connections.service';
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
 * ── The two proofs of a phone number ─────────────────────────────────────────
 *
 * There are two, and they are not alternatives the vendor picks between — each
 * reaches accounts the other cannot:
 *
 *  - **A WhatsApp connection** (`POST /me/phone/confirm`, no body) is the
 *    stronger proof: a message actually arrived *from* the number. But it serves
 *    customers, who reach the platform through the bot.
 *  - **A six-digit code** (`/me/phone/verify/*`) is weaker — we sent it
 *    ourselves — and is what serves dashboard roles. A vendor never registers
 *    through the bot, so without this `phone_verified` could never become true
 *    for them at all.
 *
 * So the code path is offered unconditionally, and the connection path only when
 * a WhatsApp connection actually exists — otherwise it is a button whose only
 * possible outcome is `CONTACT_CHANGE_PHONE_UNPROVEN`.
 * See api-doc/me/phone-verification.md.
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
  /**
   * WhatsApp's masked identity hint (`"••••1234"`), or `null` when the channel is
   * not linked. This is the whole reason the phone half needs a second request.
   */
  const [whatsappHint, setWhatsappHint] = useState<string | null>(null);
  const [whatsappLinked, setWhatsappLinked] = useState<boolean | null>(null);

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

  // The connection proof is the stronger of the two, so its state is still worth
  // knowing — it decides whether the no-code confirm is offered at all.
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
        // Unknown, not "absent". Rendering a notice off a failed request would
        // tell a vendor with a perfectly good connection the wrong thing.
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
      toast.success(t('account.contact.codeSent'));
    } catch (err) {
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

  /**
   * Shown only once the vendor is actually in the phone flow. It used to stand on
   * the page unconditionally, back when a linked connection was the *only* proof
   * and its absence meant the flow was closed to them. It no longer is, so this
   * is guidance rather than a blocker and belongs next to the decision.
   *
   * Still worth saying, and "Manage connections" is still the useful link: the
   * code is delivered over WhatsApp, and messaging the bot is what holds Meta's
   * 24-hour service window open — which on this deployment is the only way a code
   * gets delivered at all (there is no approved template yet).
   */
  const showWhatsappNotice =
    whatsappLinked === false &&
    !phoneVerified &&
    (openForm === 'phone' || state.pendingPhone !== null);

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
                {t('account.contact.change')}
              </Button>
            )}
          </div>
        </div>

        {/* The reason to press Verify, said beside the button rather than in a
            banner — an unverified number is not an error state. */}
        {canVerify && (
          <p className="text-xs text-muted-foreground">{t('account.contact.verifyPrompt')}</p>
        )}

        {/*
          The code is delivered over WhatsApp, so the number has to have WhatsApp
          on it — a weaker requirement than the old one, which needed a *linked*
          account. See `showWhatsappNotice` for why it is still worth saying.
        */}
        {showWhatsappNotice && (
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

        {state.pendingPhone && (
          <PendingBanner
            pending={state.pendingPhone}
            noticeKey="account.contact.phonePendingNotice"
            busy={busy === 'cancel-phone'}
            onCancel={() =>
              void run('cancel-phone', cancelPhoneChange, 'account.contact.phoneChangeCancelled')
            }
            action={
              <>
                {/* The code path — the one that works for a dashboard role. */}
                {!codeOpen && (
                  <Button size="sm" disabled={sending} onClick={() => void sendCode()}>
                    {sending && <Loader2 className="size-4 animate-spin" />}
                    {t('account.contact.sendCode')}
                  </Button>
                )}
                {/* The connection path: stronger, and no code to type — but only
                    offered when a WhatsApp connection actually exists, or it is a
                    button whose only outcome is CONTACT_CHANGE_PHONE_UNPROVEN. */}
                {whatsappLinked === true && (
                  <Button
                    variant="outline"
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
                )}
              </>
            }
          />
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
