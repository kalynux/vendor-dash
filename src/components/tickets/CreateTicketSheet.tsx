import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { EntityPicker } from '@/components/tickets/EntityPicker';
import {
  createTicketSchema, type CreateTicketFormValues,
} from '@/components/tickets/schemas/ticket.schemas';
import {
  TICKET_TYPE_GROUPS, TICKET_IMPORTANCES, IMPORTANCE_LABELS, ENTITY_TYPES, ENTITY_TYPE_LABELS,
  responsiveSheetProps, DESCRIPTION_MAX_LENGTH,
} from '@/components/tickets/ticket.constants';
import { useIsMobile } from '@/hooks/use-mobile';
import { createTicket } from '@/services/tickets.service';
import { ApiError } from '@/types/api';
import type { ApiTicketDetail, TicketEntityType, TicketImportance, TicketType } from '@/types/tickets.types';

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
};

export function CreateTicketSheet({ open, onOpenChange, onCreated }: CreateTicketSheetProps) {
  const {
    register, handleSubmit, control, reset, setValue, setError, watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateTicketFormValues>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: DEFAULT_VALUES,
  });

  // Reset the form whenever the sheet is re-opened.
  useEffect(() => {
    if (open) reset(DEFAULT_VALUES);
  }, [open, reset]);

  const entityType = watch('entityType');
  const isMobile = useIsMobile();
  const sheet = responsiveSheetProps(isMobile);

  async function onSubmit(values: CreateTicketFormValues) {
    try {
      const ticket = await createTicket({
        subject: values.subject,
        description: values.description,
        type: values.type as TicketType,
        importance: values.importance as TicketImportance,
        entityType: values.entityType as TicketEntityType,
        entityId: values.entityId,
      });
      toast.success('Ticket created successfully');
      onCreated(ticket);
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError) {
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

            {/* Type (grouped) */}
            <div className="space-y-1.5">
              <Label>
                Type <span className="text-destructive">*</span>
              </Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-invalid={!!errors.type} className="w-full">
                      <SelectValue placeholder="Select a ticket type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_TYPE_GROUPS.map((g) => (
                        <SelectGroup key={g.groupLabel}>
                          <SelectLabel>{g.groupLabel}</SelectLabel>
                          {g.values.map((v) => (
                            <SelectItem key={v.value} value={v.value}>
                              {v.label}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
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
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        // Clear the entity id when the entity type changes.
                        setValue('entityId', '');
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ENTITY_TYPES.map((et) => (
                          <SelectItem key={et} value={et}>
                            {ENTITY_TYPE_LABELS[et]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>

              <div className="space-y-1.5">
                <Label>
                  Entity <span className="text-destructive">*</span>
                </Label>
                <Controller
                  control={control}
                  name="entityId"
                  render={({ field }) => (
                    <EntityPicker
                      entityType={entityType as TicketEntityType}
                      value={field.value}
                      onChange={field.onChange}
                      invalid={!!errors.entityId}
                    />
                  )}
                />
                {errors.entityId && (
                  <p className="text-xs text-destructive">{errors.entityId.message}</p>
                )}
              </div>
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
    </Sheet>
  );
}
