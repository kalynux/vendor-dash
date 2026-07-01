import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Paperclip, X, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { EntityPicker } from '@/components/tickets/EntityPicker';
import { SearchSelectField, type PickerGroup } from '@/components/tickets/pickers/SearchSelectField';
import { MediaPicker } from '@/components/features/MediaPicker';
import {
  makeCreateTicketSchema, type CreateTicketFormValues,
} from '@/components/tickets/schemas/ticket.schemas';
import {
  TICKET_TYPE_GROUPS, TICKET_IMPORTANCES, IMPORTANCE_LABELS, ENTITY_TYPES, ENTITY_TYPE_LABELS,
  responsiveSheetProps, DESCRIPTION_MAX_LENGTH, TRACKING_NUMBER_MAX, MAX_CREATE_ATTACHMENTS,
  formatFileSize, humanizeEnum,
} from '@/components/tickets/ticket.constants';
import { useIsMobile } from '@/hooks/use-mobile';
import { useOnboarding } from '@/onboarding/store/onboarding.store';
import { createTicket } from '@/services/tickets.service';
import { ApiError } from '@/types/api';
import type {
  ApiTicketDetail, OrderTrackingOption, TicketEntityType, TicketImportance, TicketType,
} from '@/types/tickets.types';
import type { ApiFile } from '@/types/file.types';

// Static option groups for the searchable Type / Related-to fields.
const TYPE_GROUPS: PickerGroup[] = TICKET_TYPE_GROUPS.map((g) => ({
  label: g.groupLabel,
  options: g.values.map((v) => ({ value: v.value, label: v.label })),
}));
const ENTITY_TYPE_GROUPS: PickerGroup[] = [
  { options: ENTITY_TYPES.map((et) => ({ value: et, label: ENTITY_TYPE_LABELS[et] })) },
];

interface CreateTicketSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (ticket: ApiTicketDetail) => void;
}

const DEFAULT_VALUES: CreateTicketFormValues = {
  subject: '',
  description: '',
  type: '',
  importance: 'medium',
  entityType: 'order',
  entityId: '',
  trackingNumber: '',
  attachments: [],
};

export function CreateTicketSheet({ open, onOpenChange, onCreated }: CreateTicketSheetProps) {
  const { session } = useOnboarding();
  // The vendor creates tickets against its own entities, so the relevant support
  // policy is the logged-in vendor's. `required_info` drives the extra requirements.
  const requiredInfo = useMemo(
    () => session?.role_entity?.policies?.support_policy?.required_info ?? [],
    [session],
  );

  const resolver = useMemo(() => zodResolver(makeCreateTicketSchema(requiredInfo)), [requiredInfo]);

  const {
    register, handleSubmit, control, reset, setValue, setError, watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateTicketFormValues>({
    resolver,
    defaultValues: DEFAULT_VALUES,
  });

  // Selected files kept alongside the form value so we can render name/size.
  const [selectedFiles, setSelectedFiles] = useState<ApiFile[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Tracking numbers offered for the selected order (so the vendor can pick instead of type).
  // Populated inline from the order's shipments when it's picked (see handleOrderSelected).
  const [trackingOptions, setTrackingOptions] = useState<OrderTrackingOption[]>([]);
  const [trackingManual, setTrackingManual] = useState(false);

  // Reset the form whenever the sheet is re-opened.
  useEffect(() => {
    if (open) {
      reset(DEFAULT_VALUES);
      setSelectedFiles([]);
    }
  }, [open, reset]);

  const entityType = watch('entityType');
  const entityId = watch('entityId');
  const trackingValue = watch('trackingNumber');
  const isMobile = useIsMobile();
  const sheet = responsiveSheetProps(isMobile);

  // Policy requirements are order/product-centric — enforced only on the relevant context.
  const entityRequired = entityType !== 'other';
  const trackingRequired = entityType === 'order' && requiredInfo.includes('tracking_number');
  const attachmentsRequired =
    (entityType === 'order' || entityType === 'product') &&
    requiredInfo.includes('product_photo_video');

  // Clear tracking state whenever we leave order context.
  useEffect(() => {
    if (entityType !== 'order') {
      setTrackingOptions([]);
      setTrackingManual(false);
    }
  }, [entityType]);

  // Tracking numbers arrive inline with the selected order's shipments (no extra fetch).
  function handleOrderSelected(options: OrderTrackingOption[] | null) {
    setValue('trackingNumber', '', { shouldValidate: false });
    setTrackingOptions(options ?? []);
    // For an order with no tracking numbers yet, drop straight to manual entry.
    setTrackingManual(options !== null && options.length === 0);
  }

  function handleFilesSelected(files: ApiFile[]) {
    setPickerOpen(false);
    setSelectedFiles((prev) => {
      const byId = new Map(prev.map((f) => [f.id, f]));
      for (const f of files) byId.set(f.id, f);
      const next = Array.from(byId.values()).slice(0, MAX_CREATE_ATTACHMENTS);
      setValue('attachments', next.map((f) => f.id), { shouldValidate: true });
      return next;
    });
  }

  function removeFile(id: string) {
    setSelectedFiles((prev) => {
      const next = prev.filter((f) => f.id !== id);
      setValue('attachments', next.map((f) => f.id), { shouldValidate: true });
      return next;
    });
  }

  async function onSubmit(values: CreateTicketFormValues) {
    try {
      const trackingNumber = values.trackingNumber.trim();
      const entityId = values.entityId.trim();
      const isOrder = values.entityType === 'order';
      const ticket = await createTicket({
        subject: values.subject,
        description: values.description,
        type: values.type as TicketType,
        importance: values.importance as TicketImportance,
        entityType: values.entityType as TicketEntityType,
        // Optional for `other` (defaults server-side); sent for every other type.
        ...(entityId ? { entityId } : {}),
        // Tracking number only applies to order tickets.
        ...(isOrder && trackingNumber ? { trackingNumber } : {}),
        ...(values.attachments.length ? { attachments: values.attachments } : {}),
      });
      toast.success('Ticket created successfully');
      onCreated(ticket);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'TICKET_ENTITY_NOT_FOUND') {
          toast.error('The selected order, product, or booking no longer exists.');
          return;
        }
        if (err.code === 'TICKET_REQUIRED_INFO_MISSING') {
          toast.error(
            err.message ||
              'Your support policy requires more information before this ticket can be created.',
          );
          return;
        }
        if (err.details?.length) {
          // Map backend validation errors onto the matching fields.
          err.details.forEach((d) => {
            if (d.field in DEFAULT_VALUES) {
              setError(d.field as keyof CreateTicketFormValues, { message: d.message });
            }
          });
        }
        toast.error(err.message);
      } else {
        toast.error('Failed to create ticket');
      }
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={sheet.side} className={sheet.className}>
        <SheetHeader>
          <SheetTitle>New support ticket</SheetTitle>
          <SheetDescription>
            Describe your issue and link it to the related order, product, or account.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="space-y-5 px-4 pb-4">
            {/* Subject */}
            <div className="space-y-1.5">
              <Label htmlFor="subject">
                Subject <span className="text-destructive">*</span>
              </Label>
              <Input
                id="subject"
                placeholder="Brief summary of the issue"
                {...register('subject')}
                aria-invalid={!!errors.subject}
              />
              {errors.subject && <p className="text-xs text-destructive">{errors.subject.message}</p>}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                rows={5}
                maxLength={DESCRIPTION_MAX_LENGTH}
                placeholder="Provide as much detail as possible…"
                {...register('description')}
                aria-invalid={!!errors.description}
              />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description.message}</p>
              )}
            </div>

            {/* Type (grouped, searchable) */}
            <div className="space-y-1.5">
              <Label>
                Type <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <SearchSelectField
                    groups={TYPE_GROUPS}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Select a ticket type"
                    modalTitle="Select a ticket type"
                    modalDescription="Search by keyword to find the closest match."
                    searchPlaceholder="Search ticket types…"
                    invalid={!!errors.type}
                  />
                )}
              />
              {errors.type && <p className="text-xs text-destructive">{errors.type.message}</p>}
            </div>

            {/* Importance */}
            <div className="space-y-1.5">
              <Label>
                Importance <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="importance"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-invalid={!!errors.importance} className="w-full">
                      <SelectValue placeholder="Select importance" />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_IMPORTANCES.map((imp) => (
                        <SelectItem key={imp} value={imp}>
                          {IMPORTANCE_LABELS[imp]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.importance && (
                <p className="text-xs text-destructive">{errors.importance.message}</p>
              )}
            </div>

            {/* Related entity */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  Related to <span className="text-destructive">*</span>
                </Label>
                <Controller
                  control={control}
                  name="entityType"
                  render={({ field }) => (
                    <SearchSelectField
                      groups={ENTITY_TYPE_GROUPS}
                      value={field.value}
                      onChange={(v) => {
                        field.onChange(v);
                        // Clear the entity id when the entity type changes.
                        setValue('entityId', '');
                      }}
                      placeholder="Select"
                      modalTitle="Related to"
                      modalDescription="What is this ticket about?"
                      searchPlaceholder="Search…"
                    />
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  Entity{' '}
                  {entityRequired ? (
                    <span className="text-destructive">*</span>
                  ) : (
                    <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  )}
                </Label>
                <Controller
                  control={control}
                  name="entityId"
                  render={({ field }) => (
                    <EntityPicker
                      entityType={entityType as TicketEntityType}
                      value={field.value}
                      onChange={field.onChange}
                      onOrderSelected={handleOrderSelected}
                      invalid={!!errors.entityId}
                    />
                  )}
                />
                {errors.entityId && (
                  <p className="text-xs text-destructive">{errors.entityId.message}</p>
                )}
              </div>
            </div>

            {/* Tracking number — only relevant for order tickets */}
            {entityType === 'order' && (
              <div className="space-y-1.5">
                <Label htmlFor="trackingNumber">
                  Tracking number{' '}
                  {trackingRequired ? (
                    <span className="text-destructive">*</span>
                  ) : (
                    <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                  )}
                </Label>

                {!entityId ? (
                  <p className="text-xs text-muted-foreground">
                    Select an order above to choose its tracking number.
                  </p>
                ) : !trackingManual && trackingOptions.length > 0 ? (
                  <Select
                    value={trackingOptions.some((o) => o.trackingNumber === trackingValue) ? trackingValue : ''}
                    onValueChange={(v) => {
                      if (v === '__manual__') {
                        setTrackingManual(true);
                        setValue('trackingNumber', '', { shouldValidate: true });
                      } else {
                        setValue('trackingNumber', v, { shouldValidate: true });
                      }
                    }}
                  >
                    <SelectTrigger aria-invalid={!!errors.trackingNumber} className="w-full">
                      <SelectValue placeholder="Select a tracking number" />
                    </SelectTrigger>
                    <SelectContent>
                      {trackingOptions.map((o) => (
                        <SelectItem key={o.trackingNumber} value={o.trackingNumber}>
                          <span className="flex flex-col">
                            <span className="font-medium">{o.trackingNumber}</span>
                            <span className="text-xs text-muted-foreground">
                              {o.agencyName ?? 'Delivery agency'}
                              {o.deliveryStatus ? ` · ${humanizeEnum(o.deliveryStatus)}` : ''}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                      <SelectItem value="__manual__">Enter manually…</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <>
                    <Input
                      id="trackingNumber"
                      placeholder="e.g. shipment or carrier tracking number"
                      maxLength={TRACKING_NUMBER_MAX}
                      {...register('trackingNumber')}
                      aria-invalid={!!errors.trackingNumber}
                    />
                    {trackingOptions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No tracking numbers found for this order yet — it may not be dispatched.
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setTrackingManual(false)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Choose from the order's tracking numbers instead
                      </button>
                    )}
                  </>
                )}

                {errors.trackingNumber && (
                  <p className="text-xs text-destructive">{errors.trackingNumber.message}</p>
                )}
              </div>
            )}

            {/* Attachments */}
            <div className="space-y-1.5">
              <Label>
                Attachments{' '}
                {attachmentsRequired ? (
                  <span className="text-destructive">*</span>
                ) : (
                  <span className="text-xs font-normal text-muted-foreground">(optional)</span>
                )}
              </Label>
              {selectedFiles.length > 0 && (
                <ul className="space-y-2">
                  {selectedFiles.map((f) => {
                    const isImage = f.mimeType.startsWith('image/');
                    return (
                      <li key={f.id} className="flex items-center gap-3 rounded-lg border bg-card p-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                          {isImage && f.url ? (
                            <img src={f.url} alt={f.originalName ?? ''} crossOrigin="use-credentials" className="h-full w-full object-cover" />
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{f.originalName ?? f.key}</p>
                          <p className="truncate text-xs text-muted-foreground">{formatFileSize(f.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(f.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                          aria-label={`Remove ${f.originalName ?? 'file'}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {selectedFiles.length < MAX_CREATE_ATTACHMENTS && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setPickerOpen(true)}
                >
                  <Paperclip className="h-4 w-4" />
                  Add attachment
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                {selectedFiles.length}/{MAX_CREATE_ATTACHMENTS} files. Photos and videos supported.
              </p>
              {errors.attachments && (
                <p className="text-xs text-destructive">{errors.attachments.message as string}</p>
              )}
            </div>
          </SheetBody>

          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create ticket
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleFilesSelected}
        multiple={MAX_CREATE_ATTACHMENTS - selectedFiles.length > 1}
        maxFiles={MAX_CREATE_ATTACHMENTS - selectedFiles.length}
        acceptedTypes={['image', 'video']}
        alreadySelectedIds={selectedFiles.map((f) => f.id)}
      />
    </Sheet>
  );
}
