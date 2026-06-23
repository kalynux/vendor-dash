import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, CalendarClock, Globe, Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { validateServiceActivation } from '@/components/services/schemas/service.schemas';
import {
  formatDuration, formatPrice, BOOKING_MODE_LABELS,
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
  const [vectorisationEnabled, setVectorisationEnabled] = useState<boolean>(
    service?.vectorisationEnabled ?? false,
  );

  // Sync local form value when the underlying service changes (load, save, refresh).
  useEffect(() => {
    setVectorisationEnabled(service?.vectorisationEnabled ?? false);
  }, [service?.vectorisationEnabled, service?.id]);

  const isLockedForVectorisation = service?.vectorisationStatus === 'pending';

  const activationErrors = service
    ? validateServiceActivation({
        description: service.description,
        durationMinutes: config?.durationMinutes ?? null,
        price,
        hasDefaultVariant: !!service.defaultVariantId,
        bookingMode: config?.bookingMode ?? null,
        maxBookings: config?.maxBookings ?? null,
      })
    : ['Service has not been created yet'];

  const canPublish = activationErrors.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Review &amp; publish</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review your service before publishing. You can always save as draft and publish later.
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
          <AlertDescription>
            This service is being indexed for AI search. Editing is temporarily disabled.
          </AlertDescription>
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
                  {service.status.replace('_', ' ')}
                </span>
                <span className="text-xs text-muted-foreground">service</span>
                <span className="text-xs text-muted-foreground">{service.category}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Duration</span>
              <p className="font-medium">{formatDuration(config?.durationMinutes ?? null)}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Price</span>
              <p className="font-medium">{price != null ? formatPrice(price) : '—'}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Booking mode</span>
              <p className="font-medium">
                {config?.bookingMode ? BOOKING_MODE_LABELS[config.bookingMode] : '—'}
              </p>
            </div>
            {config?.bookingMode === 'capacity' && (
              <div>
                <span className="text-muted-foreground text-xs">Seats per slot</span>
                <p className="font-medium">{config?.maxBookings ?? '—'}</p>
              </div>
            )}
            {service.tags.length > 0 && (
              <div className="col-span-2">
                <span className="text-muted-foreground text-xs">Tags</span>
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
                <p className="font-medium text-sm">Enable AI vectorisation</p>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                  When enabled and the service is complete and active, service data is sent for
                  vectorisation so customers can find it via AI search. Status and retry options are
                  available from the service card.
                </p>
              </div>
              <Switch
                checked={vectorisationEnabled}
                onCheckedChange={setVectorisationEnabled}
                disabled={isSaving || isLockedForVectorisation}
                aria-label="Enable AI vectorisation"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Activation checklist */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Publishing requirements</p>
        {canPublish ? (
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            All requirements met — ready to publish
          </div>
        ) : (
          <ul className="space-y-1.5">
            {activationErrors.map((err, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {err}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="gap-1.5">
          <ChevronLeft className="w-4 h-4" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          {service?.status === 'draft' && (
            <Button
              type="button"
              variant="outline"
              onClick={() => onSaveDraft({ vectorisationEnabled })}
              disabled={isSaving || isLockedForVectorisation}
            >
              Keep as draft
            </Button>
          )}
          <Button
            type="button"
            onClick={() => onPublish({ vectorisationEnabled })}
            disabled={isSaving || !canPublish || isLockedForVectorisation}
            className="gap-1.5"
          >
            {isSaving ? (
              'Publishing…'
            ) : (
              <>
                <Globe className="w-4 h-4" />
                Publish
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
