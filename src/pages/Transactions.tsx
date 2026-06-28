import { Receipt } from 'lucide-react';
import { TransactionsTab } from '@/components/transactions/TransactionsTab';

export function Transactions() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Receipt className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Your payment and payout transaction history.
          </p>
        </div>
      </div>

      <TransactionsTab />
    </div>
  );
}
