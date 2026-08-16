import type { RichDoc } from '@/lib/richtext';

/**
 * Realistic product descriptions, in the shapes vendors actually write them.
 *
 * The chat output is the source of truth for this feature, so these exist to be
 * *read* as much as asserted on: `npm run richtext:verify` prints every one of
 * them through every formatter, and a rendering that looks wrong on the page is
 * a bug even when every assertion passes.
 *
 * `strictMarkers` marks the fixtures that contain no literal `*`, `_` or `~` of
 * their own, so the WhatsApp output may be checked for marker/whitespace
 * hugging without a literal character being mistaken for an unbalanced pair.
 */
export type Fixture = {
  name: string;
  doc: RichDoc;
  strictMarkers: boolean;
  /** Exact expected WhatsApp body, where pinning it down is worth more than prose. */
  expectWhatsApp?: string;
  /** Exact expected Telegram HTML body. */
  expectTelegramHtml?: string;
};

const doc = (blocks: RichDoc['blocks']): RichDoc => ({ version: 1, blocks });

export const FIXTURES: Fixture[] = [
  {
    name: 'bold product name + price + emoji',
    strictMarkers: true,
    doc: doc([
      {
        type: 'paragraph',
        text: [
          { type: 'text', text: '🔥 ' },
          { type: 'text', text: 'Sac en raphia tressé', bold: true },
          { type: 'text', text: ' — fait main à Douala.' },
        ],
      },
      {
        type: 'paragraph',
        text: [
          { type: 'text', text: 'Prix : ' },
          { type: 'text', text: '12.500 FCFA', bold: true },
          { type: 'text', text: ' (au lieu de ' },
          { type: 'text', text: '18.000 FCFA', strike: true },
          { type: 'text', text: ')' },
        ],
      },
    ]),
    expectWhatsApp:
      '🔥 *Sac en raphia tressé* — fait main à Douala.\n\n' +
      'Prix : *12.500 FCFA* (au lieu de ~18.000 FCFA~)',
    expectTelegramHtml:
      '🔥 <b>Sac en raphia tressé</b> — fait main à Douala.\n\n' +
      'Prix : <b>12.500 FCFA</b> (au lieu de <s>18.000 FCFA</s>)',
  },

  {
    name: 'feature list (bullets) + specs (numbered)',
    strictMarkers: true,
    doc: doc([
      { type: 'paragraph', text: [{ type: 'text', text: 'Caractéristiques', bold: true }] },
      {
        type: 'list',
        items: [
          [{ type: 'text', text: 'Cuir véritable, doublure coton' }],
          [
            { type: 'text', text: 'Garantie ' },
            { type: 'text', text: '2 ans', bold: true },
          ],
          [{ type: 'text', text: 'Livraison 48h à Douala et Yaoundé 🚚' }],
        ],
      },
      {
        type: 'list',
        ordered: true,
        items: [
          [{ type: 'text', text: 'Hauteur : 32 cm' }],
          [{ type: 'text', text: 'Largeur : 28 cm' }],
          [{ type: 'text', text: 'Poids : 640 g' }],
        ],
      },
    ]),
    expectWhatsApp:
      '*Caractéristiques*\n\n' +
      '• Cuir véritable, doublure coton\n• Garantie *2 ans*\n• Livraison 48h à Douala et Yaoundé 🚚\n\n' +
      '1. Hauteur : 32 cm\n2. Largeur : 28 cm\n3. Poids : 640 g',
  },

  {
    name: 'links — labelled and bare (the channel divergence)',
    strictMarkers: true,
    doc: doc([
      {
        type: 'paragraph',
        text: [
          { type: 'text', text: 'Voir le ' },
          { type: 'link', text: 'guide des tailles', href: 'https://wi-mall.com/guide?ref=a&size=eu' },
          { type: 'text', text: ' avant de commander.' },
        ],
      },
      {
        type: 'paragraph',
        text: [{ type: 'link', text: 'https://wi-mall.com/boutique', href: 'https://wi-mall.com/boutique' }],
      },
    ]),
    expectWhatsApp:
      'Voir le guide des tailles: https://wi-mall.com/guide?ref=a&size=eu avant de commander.\n\n' +
      'https://wi-mall.com/boutique',
    expectTelegramHtml:
      'Voir le <a href="https://wi-mall.com/guide?ref=a&amp;size=eu">guide des tailles</a> avant de commander.\n\n' +
      '<a href="https://wi-mall.com/boutique">https://wi-mall.com/boutique</a>',
  },

  {
    name: 'mixed nested formatting',
    strictMarkers: true,
    doc: doc([
      {
        type: 'paragraph',
        text: [
          { type: 'text', text: 'Édition limitée', bold: true, italic: true },
          { type: 'text', text: ' — ' },
          { type: 'text', text: 'stock épuisé', bold: true, strike: true },
          { type: 'text', text: ' réapprovisionné !' },
        ],
      },
    ]),
    expectWhatsApp: '*_Édition limitée_* — ~*stock épuisé*~ réapprovisionné !',
    expectTelegramHtml:
      '<b><i>Édition limitée</i></b> — <s><b>stock épuisé</b></s> réapprovisionné !',
  },

  {
    name: 'special characters that collide with WhatsApp markers',
    strictMarkers: false,
    doc: doc([
      {
        type: 'paragraph',
        text: [
          // Bold requested on text that already contains `*` — the marker must be
          // dropped rather than emitted into a broken pair.
          { type: 'text', text: 'Toile 5*7 cm', bold: true },
          { type: 'text', text: ' · réf. ' },
          { type: 'text', text: 'AB_12', italic: true },
        ],
      },
    ]),
    expectWhatsApp: 'Toile 5*7 cm · réf. AB_12',
    // Telegram has no in-band markers, so the same document keeps its formatting.
    expectTelegramHtml: '<b>Toile 5*7 cm</b> · réf. <i>AB_12</i>',
  },

  {
    name: 'HTML-hostile characters',
    strictMarkers: true,
    doc: doc([
      {
        type: 'paragraph',
        text: [
          { type: 'text', text: 'Tailles < 40 & > 44 disponibles' },
          { type: 'text', text: ' — voir "conditions"' },
        ],
      },
    ]),
    expectWhatsApp: 'Tailles < 40 & > 44 disponibles — voir "conditions"',
    expectTelegramHtml: 'Tailles &lt; 40 &amp; &gt; 44 disponibles — voir "conditions"',
  },

  {
    name: 'accented French + currency + multiple paragraphs',
    strictMarkers: true,
    doc: doc([
      {
        type: 'paragraph',
        text: [{ type: 'text', text: 'Fabriqué à Douala — prêt-à-porter, garanti 2 ans.' }],
      },
      {
        type: 'paragraph',
        text: [
          { type: 'text', text: 'Élégance intemporelle, façonnée à la main par des artisanes ' },
          { type: 'text', text: 'camerounaises', bold: true },
          { type: 'text', text: '. Chaque pièce est unique.' },
        ],
      },
      {
        type: 'paragraph',
        text: [
          { type: 'text', text: 'À partir de ' },
          { type: 'text', text: '€1,299.00', bold: true },
          { type: 'text', text: ' / 850.000 FCFA' },
        ],
      },
    ]),
  },

  {
    name: 'hard line breaks inside one paragraph',
    strictMarkers: true,
    doc: doc([
      {
        type: 'paragraph',
        text: [
          { type: 'text', text: 'Retrait en boutique :', bold: true },
          { type: 'text', text: '\nMarché Mokolo, allée 3\nDouala, Cameroun' },
        ],
      },
    ]),
    expectWhatsApp: '*Retrait en boutique :*\nMarché Mokolo, allée 3\nDouala, Cameroun',
  },

  {
    name: 'marks with edge whitespace (double-click selection)',
    strictMarkers: true,
    doc: doc([
      {
        type: 'paragraph',
        text: [
          { type: 'text', text: 'Promo' },
          // The trailing space is inside the bold span, as a double-click leaves it.
          { type: 'text', text: ' spéciale ', bold: true },
          { type: 'text', text: 'du weekend' },
        ],
      },
    ]),
    // The marker must hug the word, not the space, or WhatsApp renders it literally.
    expectWhatsApp: 'Promo *spéciale* du weekend',
  },

  {
    name: 'multi-codepoint emoji',
    strictMarkers: true,
    doc: doc([
      {
        type: 'paragraph',
        text: [
          { type: 'text', text: '👨‍👩‍👧‍👦 Pack famille 🇨🇲 ' },
          { type: 'text', text: 'meilleure vente', bold: true },
          { type: 'text', text: ' ⭐️⚡' },
        ],
      },
    ]),
    expectWhatsApp: '👨‍👩‍👧‍👦 Pack famille 🇨🇲 *meilleure vente* ⭐️⚡',
  },

  {
    name: 'long description (past the 4096 cap)',
    strictMarkers: true,
    doc: doc([
      {
        type: 'paragraph',
        text: [{ type: 'text', text: 'Collection complète', bold: true }],
      },
      {
        type: 'list',
        items: Array.from({ length: 60 }, (_, i) => [
          {
            type: 'text' as const,
            text:
              `Modèle ${i + 1} — tissu pagne authentique, coupe ajustée, disponible ` +
              'du 36 au 46, livraison sous 48 heures dans tout le Cameroun, retours ' +
              'acceptés sous 14 jours sans justification.',
          },
        ]),
      },
    ]),
  },

  {
    name: 'over-long list (lint threshold)',
    strictMarkers: true,
    doc: doc([
      {
        type: 'list',
        items: Array.from({ length: 18 }, (_, i) => [
          { type: 'text' as const, text: `Coloris ${i + 1}` },
        ]),
      },
    ]),
  },
];
