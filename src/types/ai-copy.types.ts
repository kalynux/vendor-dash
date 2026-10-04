/**
 * AI listing copy — the "Generate" button beside a product or service
 * description.
 *
 * Contract: `api-doc/vendor/ai-listing-copy.md`, the backend's answer
 * (2026-10-04) to `ai-listing-copy-requirement.md`. It kept every shape asked
 * for; its four differences are listed at the end of that doc.
 */

import type { RichDoc } from '@/lib/richtext';
import type { ApiProductType } from './product.types';

/** What the vendor can ask the AI to write. Each one costs credits on its own. */
export type AiCopyField = 'description' | 'tags' | 'seoTitle' | 'seoDescription' | 'categories';

/** The languages the storefront renders in — the AI writes in exactly one. */
export type AiCopyLanguage = 'en' | 'fr' | 'es' | 'pt' | 'ar';

export type AiCopyTarget = 'product' | 'service';

/** A category the form already has: picked ones carry an id, typed ones only a name. */
export interface AiCopyCategoryInput {
  id?: string;
  name: string;
}

export interface AiCopyRequest {
  target: AiCopyTarget;
  /** Products only. Services have no type. */
  productType?: ApiProductType;
  /** Set on the edit pages; lets the backend log the generation against the listing. */
  listingId?: string;
  language: AiCopyLanguage;
  /** At least one, never repeated. */
  fields: AiCopyField[];
  input: {
    title: string;
    /** Empty when the vendor has not chosen any — then `categories` may be in `fields`. */
    categories: AiCopyCategoryInput[];
    /** Free text from the vendor: facts the AI must use and must not contradict. */
    notes?: string;
    /** Media-library file ids, 1–4, images only. The first one is the main photo. */
    imageFileIds: string[];
  };
  /**
   * Regenerate only: what the AI wrote last time for each requested field, so
   * the new attempt reads differently instead of returning the same text.
   */
  previous?: Partial<AiCopyResults>;
}

export interface AiCopyCategorySuggestion {
  /** Present when the suggestion is an existing Wi-Mall category. */
  id?: string;
  name: string;
}

export interface AiCopyResults {
  description: {
    /** The structured document the editor holds. */
    descriptionRich: RichDoc;
  };
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  /** First entry is the suggested main category. 1–3 entries. */
  categories: AiCopyCategorySuggestion[];
}

export interface AiCopyResponseData {
  /** Only the fields that were written. A requested field that is missing failed. */
  results: Partial<AiCopyResults>;
  /** Requested fields the AI could not write. Not charged. */
  failed: AiCopyField[];
  /** Credits taken for this call — one per field in `results`. */
  creditsCharged: number;
  /** Wallet balance after the charge. */
  balance: number;
  generationId: string;
}

export interface AiCopyResponse {
  success: boolean;
  data: AiCopyResponseData;
}

/** Error codes this feature reacts to by name. The rest go through `useApiError`. */
export const AI_COPY_ERROR = {
  INSUFFICIENT_CREDITS: 'BILLING_INSUFFICIENT_CREDITS',
  IMAGE_INVALID: 'AI_COPY_IMAGE_INVALID',
  UNAVAILABLE: 'AI_COPY_UNAVAILABLE',
  FAILED: 'AI_COPY_FAILED',
  RATE_LIMITED: 'RATE_LIMIT_EXCEEDED',
} as const;
