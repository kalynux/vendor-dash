import { useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { confirmEmailChange } from '@/services/contact-change.service';
import { useApiError, useTranslation } from '@/i18n';
import { AuthLayout, AuthLink } from './AuthLayout';

type Phase = 'idle' | 'submitting' | 'done' | 'failed';

/**
 * Redeem the token from an email-change confirmation link.
 *
 * 🔴 **The confirm route is a POST, and this page is why.** `POST
 * /api/auth/email-change/confirm` is a POST specifically because mail clients
 * and security scanners prefetch URLs — a GET would confirm the change without
 * the user ever acting. So the emailed link points at a *page* carrying the
 * token in the query string, and the page posts it. Following the link is not
 * the confirmation; pressing the button is. That is the whole contract, and it
 * is why this screen does not auto-submit on mount.
 *
 * 🔴 **Public — no session required.** The route sits under `/api/auth` rather
 * than `/api/me` for the same reason this page is reachable signed-out: the
 * person clicking the link in their mailbox may not be signed in, or may be on
 * a different device entirely.
 *
 * ⚠ **Ownership of `/account/confirm-email` is an open question with the
 * backend.** The link is built from `<STOREFRONT_URL>/account/confirm-email`,
 * and that base is a single environment variable which today points at the
 * storefront, not at this dashboard. This route exists here anyway: it is inert
 * while the storefront owns the link, and correct the moment the variable is
 * repointed. If both apps end up with the page, they simply both work — the
 * token is redeemed once either way.
 *
 * ⚠ `CONTACT_CHANGE_IDENTIFIER_TAKEN` can arrive *here*, not just at request
 * time: the address was free an hour ago and someone claimed it since. It comes
 * through the shared error catalog like every other code, which is why there is
 * no special case for it below.
 */
export function ConfirmEmailChange() {
  const { t } = useTranslation();
  const apiError = useApiError();
  const [params] = useSearchParams();
  const token = params.get('token');

  const [phase, setPhase] = useState<Phase>('idle');
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A token is spent by a successful redeem, so a double-click must not fire a
  // second call that can only come back as CONTACT_CHANGE_TOKEN_INVALID and read
  // as a failure of a change that actually succeeded.
  const inFlight = useRef(false);

  async function submit() {
    if (!token || inFlight.current) return;
    inFlight.current = true;
    setPhase('submitting');
    setError(null);
    try {
      const result = await confirmEmailChange(token);
      setEmail(result.email);
      setPhase('done');
    } catch (err) {
      setError(apiError.resolve(err, { fallbackKey: 'account.contact.errors.confirmFailed' }));
      setPhase('failed');
      inFlight.current = false;
    }
  }

  if (phase === 'done') {
    return (
      <AuthLayout
        title={t('account.contact.confirmPage.doneTitle')}
        subtitle={
          email
            ? t('account.contact.confirmPage.doneSubtitle', { email })
            : undefined
        }
      >
        <div className="space-y-4 text-center">
          <CheckCircle2 className="mx-auto size-10 text-green-600" />
          {/* No "you have been signed out" line: neither contact change stamps
              the password epoch, so every existing session keeps working. */}
          <p className="text-sm text-muted-foreground">
            {t('account.contact.confirmPage.doneHint')}
          </p>
          <Button asChild className="h-11 w-full">
            <Link to="/dashboard/account/security">
              {t('account.contact.confirmPage.backToAccount')}
            </Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  // Some mail clients rewrite or truncate URLs. A page with no token is a dead
  // end, and saying so beats rendering a button whose only outcome is a 400.
  if (!token) {
    return (
      <AuthLayout
        title={t('account.contact.confirmPage.title')}
        footer={<AuthLink to="/login">{t('auth.forgot.backToLogin')}</AuthLink>}
      >
        <div className="space-y-4 text-center">
          <XCircle className="mx-auto size-10 text-destructive" />
          <p className="text-sm text-muted-foreground">
            {t('account.contact.confirmPage.missingToken')}
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t('account.contact.confirmPage.title')}
      subtitle={t('account.contact.confirmPage.subtitle')}
      footer={<AuthLink to="/login">{t('auth.forgot.backToLogin')}</AuthLink>}
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          className="h-11 w-full"
          disabled={phase === 'submitting'}
          onClick={() => void submit()}
        >
          {phase === 'submitting' && <Loader2 className="mr-2 size-4 animate-spin" />}
          {t('account.contact.confirmPage.confirm')}
        </Button>
      </div>
    </AuthLayout>
  );
}
