import type { ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';
import { CardSkeleton } from '@/components/billing/BillingSkeletons';
import { useTranslation, type TranslationKey } from '@/i18n';
import { earningsErrorMessage } from './earnings.constants';
import type { usePagedList } from './usePagedList';

interface PagedSectionProps<T> {
  list: ReturnType<typeof usePagedList<T>>;
  titleKey: TranslationKey;
  infoKey: TranslationKey;
  emptyKey: TranslationKey;
  /** A short line under the title. */
  description?: ReactNode;
  renderItem: (item: T) => ReactNode;
  getKey: (item: T) => string;
}

export function PagedSection<T>({ list, titleKey, infoKey, emptyKey, description, renderItem, getKey }: PagedSectionProps<T>) {
  const { t } = useTranslation();

  if (list.loading) return <CardSkeleton lines={2} />;

  return (
    <SettingsSection title={t(titleKey)} info={<p>{t(infoKey)}</p>} description={description}>
      {list.error ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">
            {earningsErrorMessage(list.error, 'account.earnings.adjustments.loadFailed')}
          </p>
          <Button variant="outline" size="sm" onClick={list.load}>
            {t('common.actions.retry')}
          </Button>
        </div>
      ) : list.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(emptyKey)}</p>
      ) : (
        <div className="space-y-3">
          <ul className="divide-y">
            {list.items.map((item) => (
              <li key={getKey(item)} className="space-y-1 py-3 first:pt-0">
                {renderItem(item)}
              </li>
            ))}
          </ul>
          {list.hasMore && (
            <Button
              variant="outline"
              size="sm"
              onClick={list.loadMore}
              disabled={list.loadingMore}
              className="w-full gap-2 sm:w-auto"
            >
              {list.loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('common.actions.loadMore')}
            </Button>
          )}
        </div>
      )}
    </SettingsSection>
  );
}
