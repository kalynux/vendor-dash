import type { Locale } from '@/i18n/config';

/**
 * Wi-Mall's official legal documents — the ONE place their addresses live.
 *
 * The text is hosted on the CDN and is never copied into this app: link to it.
 * Always the `.html` page, never the `.pdf` — the page has its own "Download
 * PDF" button, and on a phone that only works in a real browser, which is why
 * `LegalLink` opens these outside the WebView on native.
 *
 * Only English and French exist. French UI gets `-fr`; every other language
 * (es / pt / ar included) gets `-en`.
 */
export type LegalDocument = 'terms' | 'privacy';

const LEGAL_URLS: Record<LegalDocument, { en: string; fr: string }> = {
  terms: {
    en: 'https://cdn.wi-mall.com/legal/terms-of-service-en.html',
    fr: 'https://cdn.wi-mall.com/legal/terms-of-service-fr.html',
  },
  privacy: {
    en: 'https://cdn.wi-mall.com/legal/privacy-policy-en.html',
    fr: 'https://cdn.wi-mall.com/legal/privacy-policy-fr.html',
  },
};

/** The address of a legal document in the language closest to `locale`. */
export function legalUrl(doc: LegalDocument, locale: Locale): string {
  return locale === 'fr' ? LEGAL_URLS[doc].fr : LEGAL_URLS[doc].en;
}
