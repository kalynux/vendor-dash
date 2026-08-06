import type { DeepPartial } from '../../types';
import type { Messages } from '../../catalogs';

/**
 * Spanish — registered but not yet translated.
 *
 * Every key falls through to English, so the dashboard stays usable while the
 * catalog is written. Completing it is pure content: copy the module layout
 * from `../fr`, list the namespaces here, then flip `complete: true` for `es`
 * in `src/i18n/config.ts` to make it selectable in the Profile tab. No
 * component changes are required.
 *
 * `DeepPartial<Messages>` means a mistyped or renamed key is a build error, and
 * partial progress compiles — you can ship one namespace at a time.
 */
export const es: DeepPartial<Messages> = {};

export default es;
