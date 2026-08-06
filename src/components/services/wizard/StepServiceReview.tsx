import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, CalendarClock, Globe, Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useTranslation, useFormatters } from '@/i18n';
import { validateServiceActivation } from '@/components/services/schemas/service.schemas';
import {
  formatDuration, BOOKING_MODE_LABEL_KEYS, SERVICE_STATUS_META,
} from '@/components/services/service.constants';
import type { ServiceProduct, ServiceConfig } from '@/types/services.types';

interface StepServiceReviewProps {
  service: ServiceProduct | null;
  price: number | null;
  config: ServiceConfig | null;
  isSaving: boolean;
  stepError: string | null;
  onPublish: (values: { vectorisationEnabled: boolean }) => void;
  onSaveDraft: (values: { vectorisationEnabled: boolean }) => void;
  onBack: () => void;
}

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  archived: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  pending_review: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  suspended: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export function StepServiceReview({
  service,
  price,
  config,
  isSaving,
  stepError,
  onPublish,
  onSaveDraft,
  onBack,
}: StepServiceReviewProps) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const [vectorisationEnabled, setVectorisationEnabled] = useState<boolean>(
    service?.vectorisationEnabled ?? false,
  );

  // Sync local form value when the underlying service changes (load, save, refresh).
  useEffect(() => {
    setVectorisationEnabled(service?.vectorisationEnabled ?? false);
  }, [service?.vectorisationEnabled, service?.id]);

  const isLockedForVectorisation = service?.vectorisationStatus === 'pending';

  // Vendor-triggered activation is only allowed from draft (allowed-transitions
  // table in api-doc/vendor/products.md). archived/pending_review services also
  // reject content updates (CATALOG_PRODUCT_INVALID_STATE).
  const serviceStatus = service?.status ?? null;
  const isReadOnlyStatus = serviceStatus === 'archived' || serviceStatus === 'pending_review';
  const showPublish = serviceStatus === 'draft' || !service;
  const showSaveChanges = serviceStatus === 'active' || serviceStatus === 'suspended';

  const activationErrors = service
    ? validateServiceActivation({
        description: service.description,
        durationMinutes: config?.durationMinutes ?? null,
        price,
        hasDefaultVariant: !!service.defaultVariantId,
        bookingMode: config?.bookingMode ?? null,
        maxBookings: config?.maxBookings ?? null,
      })
    : (['services.activation.notCreated'] as const);

  const canPublish = activationErrors.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">{t('services.review.title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('services.review.description')}
        </p>
      </div>

      {stepError && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{stepError}</AlertDescription>
        </Alert>
      )}

      {isLockedForVectorisation && (
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{t('services.review.indexingNotice')}</AlertDescription>
        </Alert>
      )}

      {serviceStatus === 'archived' && (
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{t('services.review.archivedNotice')}</AlertDescription>
        </Alert>
      )}
      {serviceStatus === 'pending_review' && (
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{t('services.review.pendingReviewNotice')}</AlertDescription>
        </Alert>
      )}
      {serviceStatus === 'suspended' && (
        <Alert>
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{t('services.review.suspendedNotice')}</AlertDescription>
        </Alert>
      )}

      {/* Service summary card */}
      {service && (
        <div className="rounded-xl border border-border p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{service.title}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[service.status] ?? ''}`}
                >
                  {t(SERVICE_STATUS_META[service.status]?.labelKey ?? 'services.status.draft')}
                </span>
                <span className="text-xs text-muted-foreground">{t('services.review.typeLabel')}</span>
                <span className="text-xs text-muted-foreground">{service.category}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">{t('services.review.duration')}</span>
              <p className="font-medium">{formatDuration(config?.durationMinutes ?? null, t)}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">{t('services.review.price')}</span>
              <p className="font-medium">
                {price != null ? fmt.currency(price) : t('common.labels.emptyValue')}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">{t('services.review.mode')}</span>
              <p className="font-medium">
                {config?.bookingMode
                  ? t(BOOKING_MODE_LABEL_KEYS[config.bookingMode])
                  : t('common.labels.emptyValue')}
              </p>
            </div>
            {config?.bookingMode === 'capacity' && (
              <div>
                <span className="text-muted-foreground text-xs">{t('services.review.seats')}</span>
                <p className="font-medium">{config?.maxBookings ?? t('common.labels.emptyValue')}</p>
              </div>
            )}
            {service.tags.length > 0 && (
              <div className="col-span-2">
                <span className="text-muted-foreground text-xs">{t('services.review.tags')}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {service.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs font-normal">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vectorisation toggle — pure form field, saved on publish/draft */}
      <div className="rounded-xl border border-border p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-sm">{t('services.vectorisation.toggleLabel')}</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                  {t('services.vectorisation.toggleHelp')}
                </p>
              </div>
              <Switch
                checked={vectorisationEnabled}
                onCheckedChange={setVectorisationEnabled}
                disabled={isSaving || isLockedForVectorisation || isReadOnlyStatus}
                aria-label={t('services.vectorisation.toggleLabel')}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Activation checklist */}
      <div className="space-y-2">
        <p className="text-sm font-medium">{t('services.review.requirements')}</p>
        {canPublish ? (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            {t('services.review.requirementsMet')}
          </div>
        ) : (
          <ul className="space-y-1.5">
            {activationErrors.map((errorKey) => (
              <li key={errorKey} className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {t(errorKey)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="w-4 h-4" />
          {t('common.actions.back')}
        </Button>
        <div className="flex items-center gap-2">
          {service?.status === 'draft' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onSaveDraft({ vectorisationEnabled })}
              disabled={isSaving || isLockedForVectorisation}
            >
              {t('services.review.keepDraft')}
            </Button>
          )}
          {showPublish && (
            <Button
              type="button"
              onClick={() => onPublish({ vectorisationEnabled })}
              disabled={isSaving || !canPublish || isLockedForVectorisation}
              className="gap-1.5"
            >
              {isSaving ? (
                t('services.review.publishing')
              ) : (
                <>
                  <Globe className="w-4 h-4" />
                  {t('services.review.publish')}
                </>
              )}
            </Button>
          )}
          {showSaveChanges && (
            <Button
              type="button"
              onClick={() => onSaveDraft({ vectorisationEnabled })}
              disabled={isSaving || isLockedForVectorisation}
              className="gap-1.5"
            >
              {isSaving ? t('common.actions.saving') : t('common.actions.saveChanges')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
