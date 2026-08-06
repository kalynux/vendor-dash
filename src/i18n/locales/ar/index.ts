import type { DeepPartial } from '../../types';
import type { Messages } from '../../catalogs';

/**
 * Arabic — registered but not yet translated.
 *
 * Beyond the catalog itself (see `../es/index.ts`), Arabic is right-to-left.
 * `dir: 'rtl'` in `src/i18n/config.ts` already flips `<html dir>`, and
 * `useI18n().isRTL` is available to components — but the Tailwind utilities
 * across the app are still physical (`ml-`, `pl-`, `right-`, `text-left`).
 * Convert those to their logical equivalents (`ms-`, `ps-`, `end-`, `text-start`)
 * before flipping `complete: true`, or the layout will mirror incorrectly.
 */
export const ar: DeepPartial<Messages> = {};

export default ar;
