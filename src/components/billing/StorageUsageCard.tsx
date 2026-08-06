import { useNavigate } from 'react-router-dom';
import { HardDrive, ImageIcon, Video, FileText, Music, Archive, File as FileIcon } from 'lucide-react';
import { SettingsSection } from '@/components/vendor-settings/SettingsSection';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { storagePercent, storageBarColor } from '@/lib/utils';
import { useTranslation, useFormatters, type TranslationKey } from '@/i18n';
import type { StorageUsage, MediaCategory } from '@/types/file.types';

interface StorageUsageCardProps {
  storage: StorageUsage;
  /** Scroll the billing page to the Plans section (for the upgrade CTA). */
  onViewPlans?: () => void;
}

const CATEGORY_META: Record<MediaCategory, { labelKey: TranslationKey; icon: typeof HardDrive }> = {
  image: { labelKey: 'billing.storage.categories.image', icon: ImageIcon },
  video: { labelKey: 'billing.storage.categories.video', icon: Video },
  document: { labelKey: 'billing.storage.categories.document', icon: FileText },
  audio: { labelKey: 'billing.storage.categories.audio', icon: Music },
  archive: { labelKey: 'billing.storage.categories.archive', icon: Archive },
  other: { labelKey: 'billing.storage.categories.other', icon: FileIcon },
};

const CATEGORY_ORDER: MediaCategory[] = ['image', 'video', 'document', 'audio', 'archive', 'other'];

export function StorageUsageCard({ storage, onViewPlans }: StorageUsageCardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const fmt = useFormatters();
  const { usedBytes, limitBytes } = storage;
  const hasLimit = limitBytes !== null && limitBytes > 0;
  const pct = storagePercent(usedBytes, limitBytes);
  // Surface a free-up / upgrade nudge once usage crosses the first alert band.
  const nearFull = hasLimit && pct >= 80;

  // Only show categories that actually hold bytes, in a stable order.
  const categories = CATEGORY_ORDER.filter((c) => (storage.byCategory?.[c]?.bytes ?? 0) > 0);

  return (
    <SettingsSection
      title={t('billing.storage.title')}
      icon={HardDrive}
      description={
        hasLimit
          ? t('billing.storage.used', {
              used: fmt.fileSize(usedBytes),
              limit: fmt.fileSize(limitBytes),
            })
          : t('billing.storage.usedNoLimit', { used: fmt.fileSize(usedBytes) })
      }
      info={t('billing.storage.info')}
      contentClassName="space-y-4"
    >
        {/* Usage bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t('billing.storage.usedLabel')}</span>
            <span className="font-medium">
              {hasLimit ? `${pct}%` : fmt.fileSize(usedBytes)}
            </span>
          </div>
          {hasLimit && <Progress value={pct} indicatorClassName={storageBarColor(pct)} />}
          {hasLimit && storage.remainingBytes !== null && (
            <p className="text-xs text-muted-foreground">
              {t('billing.storage.remaining', { size: fmt.fileSize(storage.remainingBytes) })}
            </p>
          )}
        </div>

        {/* Per-category breakdown */}
        {categories.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {categories.map((c) => {
              const entry = storage.byCategory![c];
              const { labelKey, icon: Icon } = CATEGORY_META[c];
              return (
                <div key={c} className="rounded-lg p-0 sm:border sm:bg-muted/30 sm:p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    {t(labelKey)}
                  </div>
                  <p className="mt-1 font-semibold">{fmt.fileSize(entry.bytes)}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('billing.storage.fileCount', { count: entry.count })}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Near/over-full nudge */}
        {nearFull && (
          <div className="flex flex-col gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-amber-700 dark:text-amber-500">
              {pct >= 100
                ? t('billing.storage.full')
                : t('billing.storage.nearFull', { percent: pct })}
            </p>
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard/media')}>
                {t('billing.storage.freeUpSpace')}
              </Button>
              {onViewPlans && (
                <Button size="sm" onClick={onViewPlans}>
                  {t('billing.storage.upgradePlan')}
                </Button>
              )}
            </div>
          </div>
        )}
    </SettingsSection>
  );
}
