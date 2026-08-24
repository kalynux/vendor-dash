import { Receipt } from 'lucide-react';
import { TransactionsTab } from '@/components/transactions/TransactionsTab';
import { MobilePageHeader } from '@/components/layout/MobilePageHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from '@/i18n';

export function Transactions() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  // Mobile: full-bleed list — the page header replaces the card header and the
  // rows below run edge-to-edge, matching Products/Orders.
  if (isMobile) {
    return (
      <div className="-mx-6 -mt-6">
        <MobilePageHeader
          title={t('transactions.title')}
          description={t('transactions.subtitle')}
        />
        <div className="pb-28">
          <TransactionsTab />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Receipt className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('transactions.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('transactions.subtitle')}</p>
        </div>
      </div>

      <TransactionsTab />
    </div>
  );
}
