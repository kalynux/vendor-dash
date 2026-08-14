import type { TranslationKey } from '@/i18n';

/**
 * A curated emoji set, not a complete one.
 *
 * A full picker means shipping a several-hundred-kilobyte dataset plus a search
 * index, for a field where vendors reach for the same three dozen symbols:
 * a fire for a promotion, a truck for delivery, a check for what is included.
 * Every emoji here earns its place by being one a product description actually
 * uses, and the whole table costs about two kilobytes.
 *
 * Anything not listed is still typeable — the surface accepts the OS emoji
 * keyboard like any other text input, which is how most mobile vendors will
 * enter them anyway.
 */

export type EmojiCategory = {
  key: string;
  label: TranslationKey;
  emojis: string[];
};

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    key: 'commerce',
    label: 'products.editor.emoji.commerce',
    emojis: [
      '🔥', '✨', '⭐', '💯', '✅', '❌', '⚡', '🎁', '🏷️', '💰',
      '💸', '🛒', '🛍️', '📦', '🚚', '✈️', '🏬', '🔖', '💳', '🤝',
      '📢', '🎉', '🥇', '🆕', '🆓', '⏰', '📉', '📈', '🔒', '♻️',
    ],
  },
  {
    key: 'objects',
    label: 'products.editor.emoji.objects',
    emojis: [
      '👕', '👗', '👠', '👜', '👟', '🧥', '🧢', '💍', '⌚', '👓',
      '💄', '🧴', '🪑', '🛏️', '🍽️', '📱', '💻', '🎧', '📷', '🔌',
      '🔋', '🧵', '🧶', '🪡', '🧺', '🪞', '🕯️', '🧸', '⚽', '🎨',
    ],
  },
  {
    key: 'quality',
    label: 'products.editor.emoji.quality',
    emojis: [
      '💎', '🏆', '🥈', '🥉', '👑', '🌿', '🌱', '☀️', '💧', '🌍',
      '🇨🇲', '🌈', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🩷',
    ],
  },
  {
    key: 'people',
    label: 'products.editor.emoji.people',
    emojis: [
      '😊', '😍', '🤩', '😎', '🥰', '😉', '🙌', '👏', '👍', '👌',
      '🙏', '💪', '👇', '👉', '👈', '☝️', '✍️', '👨‍👩‍👧‍👦', '👩', '👨',
      '🧑', '👶', '💃', '🕺', '🤵', '👰', '🧑‍🍳', '🧑‍🔧', '🧑‍🎨', '🧑‍💻',
    ],
  },
  {
    key: 'food',
    label: 'products.editor.emoji.food',
    emojis: [
      '🍰', '🍫', '🍪', '🍯', '☕', '🍵', '🥤', '🍹', '🍷', '🥂',
      '🍔', '🍕', '🍟', '🍗', '🐟', '🍚', '🍞', '🥐', '🧀', '🥑',
      '🍌', '🍍', '🥭', '🍉', '🍇', '🍓', '🥜', '🌶️', '🧂', '🫙',
    ],
  },
  {
    key: 'info',
    label: 'products.editor.emoji.info',
    emojis: [
      '📌', '📍', '📝', '📋', '📄', '📅', '🕐', '📞', '📧', '💬',
      '❓', '❗', '⚠️', 'ℹ️', '🔍', '➡️', '⬅️', '⬆️', '⬇️', '🔁',
      '➕', '➖', '✔️', '✖️', '🔢', '🔤', '🅰️', '🆗', '🔝', '🔗',
    ],
  },
];
