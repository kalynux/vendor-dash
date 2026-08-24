import { useCallback, useEffect, useState } from 'react';
import { Loader2, ExternalLink, RefreshCw, CheckCircle2, Mail } from 'lucide-react';
import { toast } from 'sonner';

import { sendEmailVerification } from '@/services/notification-channels.service';
import { redeemConnectionCode } from '@/services/connections.service';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { ApiError } from '@/types/api';
import type { SecondaryChannel } from '@/types/notifications.types';
import type { ConnectionInstructions } from '@/types/connections.types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Trans, useMessage, useTranslation, type TranslationKey } from '@/i18n';

const CHANNEL_LABELS: Record<SecondaryChannel, string> = {
  email: 'Email',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
};

/**
 * What to tell the vendor when a redeem fails.
 *
 * Every one of these means "get a new code" rather than "try that again" — a code
 * is consumed atomically BEFORE the ownership check, so even a 409 has already
 * spent it. Copy that says "try again" sends the vendor into a second, more
 * confusing failure (`CONNECTION_CODE_INVALID` on a code the bot already burned).
 */
const REDEEM_ERROR_KEYS: Record<string, TranslationKey> = {
  CONNECTION_CODE_INVALID: 'notifications.settings.setup.codeInvalid',
  CONNECTION_CODE_EXPIRED: 'notifications.settings.setup.codeExpired',
  CONNECTION_CODE_ATTEMPTS_EXCEEDED: 'notifications.settings.setup.codeAttemptsExceeded',
  MESSAGING_IDENTITY_ALREADY_LINKED: 'notifications.settings.setup.identityAlreadyLinked',
};

type Phase = 'initiating' | 'ready' | 'verified';

interface ChannelSetupDialogProps {
  channel: SecondaryChannel | null;
  /** Whether `channel` is already verified (controls the success view). */
  verified: boolean;
  vendorEmail?: string | null;
  /**
   * Bot handle + deep link for an unlinked messaging channel, straight from
   * `GET /api/me/connections`. Absent for email, and absent once linked.
   */
  instructions?: ConnectionInstructions;
  /** Re-fetch preferences; resolves to whether THIS channel is now verified. */
  onRefresh: () => Promise<boolean>;
  onClose: () => void;
}

/**
 * Drives the "Connect" flow for a secondary notification channel.
 *
 * 🔴 Telegram and WhatsApp run the INVERTED handshake. The platform used to mint
 * a token the vendor carried to the bot; the bot now mints a 6-character code the
 * vendor carries back here. There is no deep-link-and-wait step and **nothing to
 * poll** — the platform is entirely passive while the vendor talks to the bot, so
 * this is an input box, not a spinner. See api-doc/connections/README.md.
 *
 * Email is unchanged: it still sends a link and the vendor comes back to re-check.
 */
export function ChannelSetupDialog({
  channel,
  verified,
  vendorEmail,
  instructions,
  onRefresh,
  onClose,
}: ChannelSetupDialogProps) {
  const { t } = useTranslation();
  const m = useMessage();
  const [phase, setPhase] = useState<Phase>('initiating');
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isMessaging = channel === 'telegram' || channel === 'whatsapp';

  const initiateEmail = useCallback(async () => {
    setPhase('initiating');
    setError(null);
    try {
      await sendEmailVerification();
      setPhase('ready');
    } catch (err) {
      // "Already verified" isn't a failure — the vendor is done.
      if (err instanceof ApiError && err.code === 'AUTH_EMAIL_ALREADY_VERIFIED') {
        setPhase('verified');
        return;
      }
      setError(mapProfileError(err));
      setPhase('ready');
    }
  }, []);

  // Open the dialog into the right state. Only email has a step to kick off; the
  // messaging channels are ready immediately, because the instructions they need
  // arrived with the connections list.
  useEffect(() => {
    if (!channel) return;
    setCode('');
    setError(null);
    if (verified) {
      setPhase('verified');
      return;
    }
    if (channel === 'email') {
      void initiateEmail();
      return;
    }
    setPhase('ready');
  }, [channel, verified, initiateEmail]);

  const handleRedeem = useCallback(async () => {
    if (!isMessaging || !code.trim()) return;
    setRedeeming(true);
    setError(null);
    try {
      // 🔴 Send exactly what was typed. The server strips whitespace and dashes,
      // uppercases, and maps O→0 / I→1 / L→1; its schema is loose (6–32 chars)
      // precisely so `a7k9p-2` reaches that normaliser intact. Normalising here
      // gets it subtly wrong and rejects codes that would have worked.
      await redeemConnectionCode(code);
      await onRefresh();
      setPhase('verified');
    } catch (err) {
      if (err instanceof ApiError) {
        const key = REDEEM_ERROR_KEYS[err.code];
        if (key) {
          setError(key);
          // Every redeem failure spends the code, so clear the field — leaving it
          // populated invites a retry that cannot succeed.
          setCode('');
          return;
        }
      }
      setError(mapProfileError(err));
    } finally {
      setRedeeming(false);
    }
  }, [isMessaging, code, onRefresh]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const nowVerified = await onRefresh();
      if (nowVerified) {
        setPhase('verified');
      } else {
        toast.info(t('notifications.settings.setup.notVerifiedYet'));
      }
    } catch (err) {
      setError(mapProfileError(err));
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, t]);

  if (!channel) return null;
  const label = CHANNEL_LABELS[channel];

  return (
    <Dialog open={!!channel} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {t(phase === 'verified'
              ? 'notifications.settings.setup.connectedTitle'
              : 'notifications.settings.setup.connectTitle', { channel: label })}
          </DialogTitle>
          <DialogDescription>
            {t(phase === 'verified'
              ? 'notifications.settings.setup.connectedDescription'
              : 'notifications.settings.setup.connectDescription', { channel: label })}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div role="alert" className="p-3 text-sm bg-destructive/10 text-destructive rounded-lg border border-destructive/20">
            {m(error)}
          </div>
        )}

        {phase === 'verified' ? (
          <div className="flex flex-col items-center text-center py-4 gap-3">
            <div className="p-3 rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <p className="text-sm text-muted-foreground">
              {t('notifications.settings.setup.allSet', { channel: label })}
            </p>
          </div>
        ) : phase === 'initiating' ? (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" /> {t('notifications.settings.setup.preparing')}
          </div>
        ) : (
          <div className="space-y-4 py-1">
            {channel === 'email' && (
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <StepNumber n={1} />
                  <span>
                    <Trans
                      i18nKey="notifications.settings.setup.emailStep1"
                      params={{
                        email: vendorEmail ?? t('notifications.settings.setup.emailFallback'),
                      }}
                      components={[<span className="font-medium text-foreground" />]}
                    />
                  </span>
                </li>
                <li className="flex gap-3">
                  <StepNumber n={2} />
                  <span>{t('notifications.settings.setup.emailStep2')}</span>
                </li>
                <li>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => void initiateEmail()}>
                    <Mail className="w-4 h-4" /> {t('notifications.settings.setup.resendEmail')}
                  </Button>
                </li>
              </ol>
            )}

            {isMessaging && (
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <StepNumber n={1} />
                  <span>
                    {/* `botHandle` is null when the deployment hasn't configured
                        one. The flow still works — the vendor just has to find the
                        bot themselves — so this never gates the instructions. */}
                    {instructions?.botHandle
                      ? t('notifications.settings.setup.botStep1', {
                          command: instructions.command,
                          bot: instructions.botHandle,
                        })
                      : t('notifications.settings.setup.botStep1NoHandle', {
                          command: instructions?.command ?? '/connect',
                          channel: label,
                        })}
                  </span>
                </li>
                {instructions?.deepLink && (
                  <li>
                    <Button asChild variant="outline" size="sm" className="gap-2">
                      <a href={instructions.deepLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                        {t(channel === 'telegram'
                          ? 'notifications.settings.setup.openTelegram'
                          : 'notifications.settings.setup.openWhatsapp')}
                      </a>
                    </Button>
                  </li>
                )}
                <li className="flex gap-3">
                  <StepNumber n={2} />
                  <span>{t('notifications.settings.setup.botStep2')}</span>
                </li>
                <li className="space-y-1.5 pl-8">
                  <Label htmlFor="connection-code">
                    {t('notifications.settings.setup.codeLabel')}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="connection-code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleRedeem();
                        }
                      }}
                      // Uppercased VISUALLY only — the raw value is what gets sent.
                      // The server maps the confusable characters itself, so O, I
                      // and L are deliberately not filtered out of the input.
                      className="font-mono uppercase tracking-[0.2em] placeholder:tracking-normal placeholder:normal-case"
                      placeholder={t('notifications.settings.setup.codePlaceholder')}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      disabled={redeeming}
                    />
                    <Button
                      className="shrink-0 gap-2"
                      onClick={() => void handleRedeem()}
                      disabled={redeeming || code.trim().length === 0}
                    >
                      {redeeming && <Loader2 className="w-4 h-4 animate-spin" />}
                      {t('notifications.settings.setup.connectAction')}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('notifications.settings.setup.codeHint')}
                  </p>
                </li>
              </ol>
            )}
          </div>
        )}

        <DialogFooter>
          {phase === 'verified' ? (
            <Button onClick={onClose}>{t('common.actions.done')}</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>{t('common.actions.cancel')}</Button>
              {/* Only email has anything to re-check. There is nothing to poll on
                  the messaging channels — the code in the field IS the signal. */}
              {channel === 'email' && (
                <Button onClick={handleRefresh} disabled={refreshing || phase === 'initiating'} className="gap-2">
                  {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {t('notifications.settings.setup.checkAgain')}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">
      {n}
    </span>
  );
}
