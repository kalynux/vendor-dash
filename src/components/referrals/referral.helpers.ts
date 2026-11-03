import type { TranslationKey } from '@/i18n';
import type { MaskedPayoutMethod } from '@/types/referral.types';

const CATEGORY_KEYS: Record<string, TranslationKey> = {
  vendor: 'referrals.category.vendor',
  customer: 'referrals.category.customer',
  agency: 'referrals.category.agency',
  agent: 'referrals.category.agent',
};

/** Takes `string`: the wire can carry a category this build doesn't know yet. */
export function referralCategoryKey(category: string): TranslationKey {
  return Object.prototype.hasOwnProperty.call(CATEGORY_KEYS, category)
    ? CATEGORY_KEYS[category]
    : 'referrals.category.other';
}

const REWARD_STATUS_KEYS: Record<string, TranslationKey> = {
  held: 'referrals.rewards.status.held',
  released: 'referrals.rewards.status.released',
  reversed: 'referrals.rewards.status.reversed',
};

/** An unknown status reads as still in progress, as on the earnings lists. */
export function rewardStatusKey(status: string): TranslationKey {
  return Object.prototype.hasOwnProperty.call(REWARD_STATUS_KEYS, status)
    ? REWARD_STATUS_KEYS[status]
    : 'referrals.rewards.status.unknown';
}

/** Line two of a method: the number the server already masked, then the name on it. */
export function maskedPayoutDetail(method: MaskedPayoutMethod): string {
  const parts = method.mobile_money
    ? [method.mobile_money.phone_number_masked, method.mobile_money.account_name]
    : method.bank
      ? [method.bank.account_number_masked, method.bank.account_name]
      : method.card
        ? [method.card.number_masked, method.card.card_holder_name]
        : [];
  return parts.filter(Boolean).join(' · ');
}
