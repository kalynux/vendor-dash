// ─── Image count limits per product type ─────────────────────────────────────
// Caps enforced client-side for product galleries and variant images. These are
// product-management UI constraints (the file-upload endpoint itself is generic).
//
//   physical product → 7 images   |  physical variant → 3 images
//   digital  product → 1 image    |  digital  variant → 1 image
//
// A digital variant's downloadable asset (variant.digital.asset) is separate from
// its image and is not counted here.

import type { ApiProductType } from '@/types/product.types';

export const PRODUCT_IMAGE_LIMIT: Record<ApiProductType, number> = {
  physical: 7,
  digital: 1,
};

export const VARIANT_IMAGE_LIMIT: Record<ApiProductType, number> = {
  physical: 3,
  digital: 1,
};
