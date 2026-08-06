import { ApiError } from '@/types/api';
import {
  SIMPLE_MODE_ERROR_KEYS,
  getSimpleProductErrorMessage,
} from '@/services/products.service';
import type { SimpleProductFormValues } from '@/components/products/schemas/simple-product.schemas';
import type { SimpleFieldErrors } from './SimpleProductForm';

/**
 * What the page should render after a failed simple-mode write.
 *
 * `formError` and each `fieldErrors` entry may be either a translation key or a
 * message the backend already gave us in words; `SimpleProductForm` runs both
 * through `useMessage()`, which resolves the first kind and passes the second
 * through untouched.
 */
export interface SimpleErrorProjection {
  formError: string | null;
  fieldErrors?: SimpleFieldErrors;
  /** True for BILLING_LIMIT_EXCEEDED on publish — offer "Save as draft instead". */
  offerDraftFallback: boolean;
}

const FORM_KEYS = new Set<string>([
  'title',
  'category',
  'description',
  'tags',
  'seoTitle',
  'seoDescription',
  'fileIds',
  'price',
  'compareAtPrice',
  'stock',
  'isInfiniteStock',
  'sku',
  'lowStockThreshold',
  'allowOversell',
  'weight',
  'length',
  'width',
  'height',
]);

/**
 * Maps an API failure onto the form. Shared by the create and edit pages so the
 * two cannot drift on which code lands where.
 */
export function projectSimpleError(err: unknown): SimpleErrorProjection {
  if (!(err instanceof ApiError)) {
    return { formError: getSimpleProductErrorMessage(err), offerDraftFallback: false };
  }

  switch (err.code) {
    // The field error IS the message here — a toast on top would be noise.
    case 'CATALOG_VARIANT_SKU_EXISTS':
      return {
        formError: null,
        fieldErrors: { sku: SIMPLE_MODE_ERROR_KEYS.CATALOG_VARIANT_SKU_EXISTS },
        offerDraftFallback: false,
      };

    // The whole transaction rolled back — nothing was created, so the form is
    // still valid and retrying is safe. Implicate the media section explicitly.
    case 'CATALOG_PRODUCT_ACCESS_DENIED':
      return {
        formError: SIMPLE_MODE_ERROR_KEYS.CATALOG_PRODUCT_ACCESS_DENIED,
        fieldErrors: { fileIds: 'products.simple.imageNotYours' },
        offerDraftFallback: false,
      };

    case 'CATALOG_IMAGE_LIMIT_EXCEEDED':
      return {
        formError: SIMPLE_MODE_ERROR_KEYS.CATALOG_IMAGE_LIMIT_EXCEEDED,
        fieldErrors: { fileIds: SIMPLE_MODE_ERROR_KEYS.CATALOG_IMAGE_LIMIT_EXCEEDED },
        offerDraftFallback: false,
      };

    case 'BILLING_LIMIT_EXCEEDED':
      return {
        formError: SIMPLE_MODE_ERROR_KEYS.BILLING_LIMIT_EXCEEDED,
        offerDraftFallback: true,
      };

    default:
      break;
  }

  // Generic field-level validation, from either documented `details` shape.
  const fieldErrors: SimpleFieldErrors = {};
  for (const detail of err.fieldErrors) {
    // Nested paths like "variant.price" still point at a flat form field here.
    const key = detail.field.split('.').pop() ?? detail.field;
    if (FORM_KEYS.has(key)) {
      fieldErrors[key as keyof SimpleProductFormValues] = detail.message;
    }
  }

  const matched = Object.keys(fieldErrors).length > 0;
  return {
    formError: matched ? null : getSimpleProductErrorMessage(err),
    fieldErrors: matched ? fieldErrors : undefined,
    offerDraftFallback: false,
  };
}
