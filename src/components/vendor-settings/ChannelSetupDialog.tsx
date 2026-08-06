import { useCallback, useEffect, useState } from 'react';
import {
  Loader2,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Mail,
  Copy,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';

import {
  sendEmailVerification,
  requestTelegramLink,
  requestWhatsappVerification,
} from '@/services/notification-channels.service';
import { mapProfileError } from '@/components/vendor-settings/errors';
import { ApiError } from '@/types/api';
import type { SecondaryChannel } from '@/types/notifications.types';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Trans, useFormatters, useMessage, useTranslation } from '@/i18n';

const CHANNEL_LABELS: Record<SecondaryChannel, string> = {
  email: 'Email',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
};

type Phase = 'initiating' | 'ready' | 'verified';

interface ChannelSetupDialogProps {
  channel: SecondaryChannel | null;
  /** Whether `channel` is already verified (controls the success view). */
  verified: boolean;
  vendorEmail?: string | null;
  /** Re-fetch preferences; resolves to whether THIS channel is now verified. */
  onRefresh: () => Promise<boolean>;
  onClose: () => void;
}

/**
 * Drives the "Connect" (link/verify) flow for a secondary channel.
 * Step 1 (request link/code) is auto-initiated on open; the vendor completes
 * Step 2 outside the app, then refreshes to detect verification.
 */
export function ChannelSetupDialog({
  channel,
  verified,
  vendorEmail,
  onRefresh,
  onClose,
}: ChannelSetupDialogProps) {
  const { t } = useTranslation();
  const m = useMessage();
  const fmt = useFormatters();
  const [phase, setPhase] = useState<Phase>('initiating');
  const [error, setError] = useState<string | null>(null);
  const [actionUrl, setActionUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [waCommand, setWaCommand] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const initiate = useCallback(async (ch: SecondaryChannel) => {
    setPhase('initiating');
    setError(null);
    setActionUrl(null);
    setExpiresAt(null);
    setWaCommand(null);
    try {
      if (ch === 'email') {
        await sendEmailVerification();
      } else if (ch === 'telegram') {
        const res = await requestTelegramLink();
        setActionUrl(res.bot_url);
        setExpiresAt(res.expires_at);
      } else {
        const res = await requestWhatsappVerification();
        setActionUrl(res.wa_link);
        setWaCommand(res.command);
      }
      setPhase('ready');
    } catch (err) {
      // "Already verified" isn't a failure — the vendor is done.
      if (
        err instanceof ApiError &&
        (err.code === 'AUTH_EMAIL_ALREADY_VERIFIED' || err.code === 'AUTH_WA_ALREADY_VERIFIED')
      ) {
        setPhase('verified');
        return;
      }
      setError(mapProfileError(err));
      setPhase('ready');
    }
  }, []);

  // Auto-start Step 1 when the dialog opens for a channel.
  useEffect(() => {
    if (!channel) return;
    if (verified) {
      setPhase('verified');
      return;
    }
    initiate(channel);
  }, [channel, verified, initiate]);

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

  const copyCommand = useCallback(() => {
    if (!waCommand) return;
    navigator.clipboard.writeText(waCommand).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [waCommand]);

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
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">1</span>
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
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">2</span>
                  <span>{t('notifications.settings.setup.emailStep2')}</span>
                </li>
                <li>
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => initiate('email')}>
                    <Mail className="w-4 h-4" /> {t('notifications.settings.setup.resendEmail')}
                  </Button>
                </li>
              </ol>
            )}

            {channel === 'telegram' && (
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">1</span>
                  <span>
                    <Trans
                      i18nKey="notifications.settings.setup.telegramStep1"
                      components={[<span className="font-medium text-foreground" />]}
                    />
                  </span>
                </li>
                {actionUrl && (
                  <li>
                    <Button asChild variant="outline" size="sm" className="gap-2">
                      <a href={actionUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" /> {t('notifications.settings.setup.openTelegram')}
                      </a>
                    </Button>
                    {expiresAt && (
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {t('notifications.settings.setup.linkExpires', {
                          time: fmt.time(expiresAt),
                        })}
                      </p>
                    )}
                  </li>
                )}
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">2</span>
                  <span>{t('notifications.settings.setup.telegramStep2')}</span>
                </li>
              </ol>
            )}

            {channel === 'whatsapp' && (
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">1</span>
                  <span>{t('notifications.settings.setup.whatsappStep1')}</span>
                </li>
                {actionUrl && (
                  <li>
                    <Button asChild variant="outline" size="sm" className="gap-2">
                      <a href={actionUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" /> {t('notifications.settings.setup.openWhatsapp')}
                      </a>
                    </Button>
                  </li>
                )}
                {waCommand && (
                  <li className="flex items-center gap-2">
                    <code className="flex-1 px-2.5 py-1.5 rounded bg-muted text-xs font-mono truncate">{waCommand}</code>
                    <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={copyCommand} aria-label={t('notifications.settings.setup.copyCommand')}>
                      {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </li>
                )}
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center">2</span>
                  <span>{t('notifications.settings.setup.whatsappStep2')}</span>
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
              <Button onClick={handleRefresh} disabled={refreshing || phase === 'initiating'} className="gap-2">
                {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {t('notifications.settings.setup.checkAgain')}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
