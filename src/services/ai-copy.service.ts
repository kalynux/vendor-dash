import { api } from './api';
import { parseRichDoc, normalizeDoc } from '@/lib/richtext';
import type {
  AiCopyRequest,
  AiCopyResponse,
  AiCopyResponseData,
  AiCopyResults,
} from '@/types/ai-copy.types';

/**
 * Credits per field, per generation or regeneration — the fallback only. The
 * live price is `actionCosts.aiCopyField` on the public price list, which the
 * backend can change by environment; `fetchAiCopyFieldCost` reads it.
 */
export const AI_COPY_FIELD_COST = 1;

interface PublicCreditCatalogResponse {
  success: boolean;
  data: { actionCosts?: { aiCopyField?: number } };
}

let fieldCostRequest: Promise<number> | null = null;

/**
 * The live per-field price, fetched once per app session. Falls back to
 * `AI_COPY_FIELD_COST` when the price list cannot be read — the server
 * charges its own number regardless, and says so in `creditsCharged`.
 */
export function fetchAiCopyFieldCost(): Promise<number> {
  fieldCostRequest ??= api
    .get<PublicCreditCatalogResponse>('/public/credit-packs')
    .then((res) => {
      const cost = res.data?.actionCosts?.aiCopyField;
      return typeof cost === 'number' && Number.isFinite(cost) && cost >= 0 ? cost : AI_COPY_FIELD_COST;
    })
    .catch(() => {
      fieldCostRequest = null; // try again next time the popup opens
      return AI_COPY_FIELD_COST;
    });
  return fieldCostRequest;
}

/** The AI looks at this many photos at most; the first is the main one. */
export const AI_COPY_MAX_IMAGES = 4;

/** Mirrors the backend cap on `input.notes`. */
export const AI_COPY_NOTES_MAX = 500;

const SEO_TITLE_MAX = 60;
const SEO_DESCRIPTION_MAX = 160;
const TAGS_MAX = 10;

/**
 * Ask the AI to write the listing's copy.
 *
 * The answer is re-checked here rather than trusted: a model can return a
 * description the editor would refuse, an SEO title past its 60 characters, or
 * the same tag twice — and any of those would fail the vendor's save later,
 * far from the button that caused it. A field that does not survive the check
 * is reported as failed, never shown half-broken.
 */
export async function generateListingCopy(payload: AiCopyRequest): Promise<AiCopyResponseData> {
  const res = await api.post<AiCopyResponse>('/vendor/ai/listing-copy', payload);
  const data = res.data;
  const { results, rejected } = sanitizeResults(data.results ?? {});
  return {
    ...data,
    results,
    failed: [...new Set([...(data.failed ?? []), ...rejected])],
  };
}

function sanitizeResults(raw: Partial<AiCopyResults>) {
  const results: Partial<AiCopyResults> = {};
  const rejected: (keyof AiCopyResults)[] = [];

  if (raw.description !== undefined) {
    const doc = parseRichDoc(raw.description?.descriptionRich);
    if (doc && doc.blocks.length > 0) results.description = { descriptionRich: normalizeDoc(doc) };
    else rejected.push('description');
  }

  if (raw.tags !== undefined) {
    const seen = new Set<string>();
    const tags = (Array.isArray(raw.tags) ? raw.tags : [])
      .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
      .filter((tag) => {
        const key = tag.toLowerCase();
        if (!tag || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, TAGS_MAX);
    if (tags.length > 0) results.tags = tags;
    else rejected.push('tags');
  }

  if (raw.seoTitle !== undefined) {
    const value = typeof raw.seoTitle === 'string' ? raw.seoTitle.trim() : '';
    if (value) results.seoTitle = value.slice(0, SEO_TITLE_MAX);
    else rejected.push('seoTitle');
  }

  if (raw.seoDescription !== undefined) {
    const value = typeof raw.seoDescription === 'string' ? raw.seoDescription.trim() : '';
    if (value) results.seoDescription = value.slice(0, SEO_DESCRIPTION_MAX);
    else rejected.push('seoDescription');
  }

  if (raw.categories !== undefined) {
    const categories = (Array.isArray(raw.categories) ? raw.categories : [])
      .filter((c) => c && typeof c.name === 'string' && c.name.trim())
      .map((c) => (c.id ? { id: c.id, name: c.name.trim() } : { name: c.name.trim() }))
      .slice(0, 3);
    if (categories.length > 0) results.categories = categories;
    else rejected.push('categories');
  }

  return { results, rejected };
}
