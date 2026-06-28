import { Wallet, Plus, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CreditPack } from '@/types/billing.types';
import { formatMoney, formatCredits } from './billing.constants';

interface CreditWalletCardProps {
  balance: number;
  packs: CreditPack[];
  onBuyPack: (pack: CreditPack) => void;
}

export function CreditWalletCard({ balance, packs, onBuyPack }: CreditWalletCardProps) {
  // A chargeback/refund claw-back can drive the wallet below zero. Surface it and
  // nudge the vendor to top back up (credit-spending actions are blocked server-side).
  const negative = balance < 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" /> Credit wallet
        </CardTitle>
        <CardDescription>
          Credits pay for AI product indexing and WhatsApp messages. They never expire.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className={cn('rounded-lg border p-4', negative ? 'border-red-200 bg-red-50' : 'bg-muted/30')}>
          <p className="text-xs text-muted-foreground">Current balance</p>
          <p className={cn('text-3xl font-bold', negative && 'text-red-600')}>{formatCredits(balance)}</p>
          <p className="text-xs text-muted-foreground">credits</p>
          {negative && (
            <div className="mt-3 flex items-start gap-2 text-xs text-red-700">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <p>
                Your balance is negative after a refunded or disputed top-up. Credit-based
                features (AI indexing, WhatsApp messages) are paused until you top back up.
              </p>
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">Top up</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {packs.map((pack) => (
              <div
                key={pack.code}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-semibold">{formatCredits(pack.credits)} credits</p>
                  <p className="text-sm text-muted-foreground">{formatMoney(pack.price, pack.currency)}</p>
                </div>
                <Button size="sm" onClick={() => onBuyPack(pack)} className="gap-1">
                  <Plus className="h-4 w-4" /> Buy
                </Button>
              </div>
            ))}
            {packs.length === 0 && (
              <p className="text-sm text-muted-foreground">No credit packs available right now.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
