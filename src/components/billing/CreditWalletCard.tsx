import { Wallet, Plus, AlertTriangle } from 'lucide-react';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslation, useFormatters } from '@/i18n';
import { purchasesEnabled } from '@/platform/purchases';
import type { CreditPack } from '@/types/billing.types';
import { PurchasesUnavailable } from './PurchasesUnavailable';

interface CreditWalletCardProps {
  balance: number;
  packs: CreditPack[];
  onBuyPack: (pack: CreditPack) => void;
}

export function CreditWalletCard({ balance, packs, onBuyPack }: CreditWalletCardProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  // A chargeback/refund claw-back can drive the wallet below zero. Surface it and
  // nudge the vendor to top back up (credit-spending actions are blocked server-side).
  const negative = balance < 0;
  return (
    <SettingsSection
      title={t('billing.credits.title')}
      icon={Wallet}
      info={t('billing.credits.info')}
      contentClassName="space-y-5"
    >
        <div className={cn('rounded-lg p-0 sm:border sm:p-4', negative ? 'sm:border-red-200 sm:bg-red-50' : 'sm:bg-muted/30')}>
          <p className="text-xs text-muted-foreground">{t('billing.credits.currentBalance')}</p>
          <p className={cn('text-3xl font-bold', negative && 'text-red-600')}>
            {fmt.number(balance)}
          </p>
          <p className="text-xs text-muted-foreground">{t('billing.credits.unit')}</p>
          {negative && (
            <div className="mt-3 flex items-start gap-2 text-xs text-red-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <p>{t('billing.credits.negativeWarning')}</p>
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">{t('billing.credits.topUp')}</p>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            {packs.map((pack) => (
              <div
                key={pack.code}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-semibold">
                    {t('billing.credits.packCredits', { credits: fmt.number(pack.credits) })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {fmt.currency(pack.price, pack.currency)}
                  </p>
                </div>
                {purchasesEnabled && (
                  <Button size="sm" onClick={() => onBuyPack(pack)} className="gap-1">
                    <Plus className="h-4 w-4" /> {t('billing.credits.buy')}
                  </Button>
                )}
              </div>
            ))}
            {packs.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('billing.credits.noPacks')}</p>
            )}
          </div>
          {/* The packs stay listed — what a top-up costs is information, and the
              balance above is the reason a vendor looks here at all. Only the
              buying moved (P5.2). */}
          {!purchasesEnabled && packs.length > 0 && (
            <PurchasesUnavailable className="mt-3" message={t('billing.mobile.credits')} />
          )}
        </div>
    </SettingsSection>
  );
}
