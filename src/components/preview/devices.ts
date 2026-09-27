/** Preview device presets, shared by `StorefrontFrame` and the preview pages. */

export type PreviewDevice = 'mobile' | 'tablet' | 'desktop';

/**
 * Frame widths, in CSS pixels.
 *
 * `mobile` is a 390pt phone and `tablet` a portrait tablet — both chosen to sit
 * on the far side of the storefront's own breakpoints (640 / 1024 / 1280) rather
 * than near them, so each option shows a distinctly different layout. `desktop`
 * is unconstrained: the storefront caps its own content at 1200px.
 */
export const DEVICE_WIDTHS: Record<PreviewDevice, number | null> = {
  mobile: 390,
  tablet: 820,
  desktop: null,
};
