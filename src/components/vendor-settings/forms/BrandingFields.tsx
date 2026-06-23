import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2, Image as ImageIcon } from 'lucide-react';

import { step3Schema, type Step3FormValues } from '@/onboarding/schemas/onboarding.schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

// ─── Shared Branding & Addresses form body ────────────────────────────────────
// Renders just the <form> with fields. Submit is driven externally via a button
// with `form={formId}`.

export interface BrandingFieldsProps {
    formId: string;
    defaultValues: Step3FormValues;
    onSubmit: (values: Step3FormValues) => void | Promise<void>;
}

export function BrandingFields({ formId, defaultValues, onSubmit }: BrandingFieldsProps) {
    const {
        register,
        handleSubmit,
        control,
        formState: { errors },
    } = useForm<Step3FormValues>({
        resolver: zodResolver(step3Schema),
        defaultValues,
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'business_addresses',
    });

    return (
        <form id={formId} onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            {/* Branding */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    <h2 className="font-semibold text-sm">Branding</h2>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="logo_url">Logo URL</Label>
                    <Input
                        id="logo_url"
                        type="url"
                        placeholder="https://cdn.example.com/logo.png"
                        className={cn('h-11', errors.logo_url && 'border-destructive')}
                        aria-invalid={!!errors.logo_url}
                        {...register('logo_url')}
                    />
                    {errors.logo_url && (
                        <p className="text-sm text-destructive" role="alert">
                            {errors.logo_url.message}
                        </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                        Publicly accessible image URL (square, min 200×200px recommended)
                    </p>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="cover_image_url">Cover Image URL</Label>
                    <Input
                        id="cover_image_url"
                        type="url"
                        placeholder="https://cdn.example.com/cover.png"
                        className={cn('h-11', errors.cover_image_url && 'border-destructive')}
                        aria-invalid={!!errors.cover_image_url}
                        {...register('cover_image_url')}
                    />
                    {errors.cover_image_url && (
                        <p className="text-sm text-destructive" role="alert">
                            {errors.cover_image_url.message}
                        </p>
                    )}
                </div>
            </div>

            {/* Business addresses */}
            <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                    <h2 className="font-semibold text-sm">Business Addresses</h2>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            append({ label: '', address_line1: '', address_line2: '', city: '', state: '' })
                        }
                        className="h-8 gap-1.5 text-xs"
                    >
                        <Plus className="w-3 h-3" />
                        Add address
                    </Button>
                </div>

                {fields.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">
                        No addresses added. Customers won't see a pickup location until you add one.
                    </p>
                ) : (
                    <div className="space-y-4">
                        {fields.map((field, index) => (
                            <div
                                key={field.id}
                                className="rounded-lg border p-4 space-y-3 relative"
                            >
                                <button
                                    type="button"
                                    onClick={() => remove(index)}
                                    aria-label="Remove address"
                                    className="absolute top-3 right-3 text-muted-foreground hover:text-destructive transition-colors"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>

                                {/* Label — required by backend */}
                                <div className="space-y-2">
                                    <Label htmlFor={`addr-label-${index}`}>
                                        Label <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id={`addr-label-${index}`}
                                        placeholder="e.g. Main Shop, Warehouse"
                                        className={cn(
                                            'h-10',
                                            errors.business_addresses?.[index]?.label && 'border-destructive',
                                        )}
                                        aria-invalid={!!errors.business_addresses?.[index]?.label}
                                        {...register(`business_addresses.${index}.label`)}
                                    />
                                    {errors.business_addresses?.[index]?.label && (
                                        <p className="text-sm text-destructive" role="alert">
                                            {errors.business_addresses[index]?.label?.message}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor={`addr-line1-${index}`}>
                                        Street Address <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id={`addr-line1-${index}`}
                                        placeholder="123 Market Street"
                                        className={cn(
                                            'h-10',
                                            errors.business_addresses?.[index]?.address_line1 && 'border-destructive',
                                        )}
                                        aria-invalid={!!errors.business_addresses?.[index]?.address_line1}
                                        {...register(`business_addresses.${index}.address_line1`)}
                                    />
                                    {errors.business_addresses?.[index]?.address_line1 && (
                                        <p className="text-sm text-destructive" role="alert">
                                            {errors.business_addresses[index]?.address_line1?.message}
                                        </p>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor={`addr-line2-${index}`}>
                                        Address Line 2
                                    </Label>
                                    <Input
                                        id={`addr-line2-${index}`}
                                        placeholder="Suite 4B, Floor 2…"
                                        className="h-10"
                                        {...register(`business_addresses.${index}.address_line2`)}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-2">
                                        <Label htmlFor={`addr-city-${index}`}>
                                            City <span className="text-destructive">*</span>
                                        </Label>
                                        <Input
                                            id={`addr-city-${index}`}
                                            placeholder="Douala"
                                            className={cn(
                                                'h-10',
                                                errors.business_addresses?.[index]?.city && 'border-destructive',
                                            )}
                                            {...register(`business_addresses.${index}.city`)}
                                        />
                                        {errors.business_addresses?.[index]?.city && (
                                            <p className="text-sm text-destructive" role="alert">
                                                {errors.business_addresses[index]?.city?.message}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`addr-state-${index}`}>State / Region</Label>
                                        <Input
                                            id={`addr-state-${index}`}
                                            placeholder="Littoral"
                                            className="h-10"
                                            {...register(`business_addresses.${index}.state`)}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </form>
    );
}
