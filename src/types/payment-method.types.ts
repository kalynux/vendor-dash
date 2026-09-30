// ─── Saved Payment Methods — types ───────────────────────────────────────────────
// Mirrors api-doc/vendor/payment-methods.md (reshaped 2026-09-30). This is the
// shared, role-agnostic API mounted at `/api/me/payment-methods`. Only mobile-money
// wallets can be saved, named by the network the user holds — never by a payment
// company. The full phone number is never returned.

/** A network a wallet can be saved under — the same values a charge sends. */
export type SavedWalletProvider = 'MTN' | 'ORANGE' | 'MOOV';

/**
 * What a saved method holds. `CARD` is a card saved before 2026-09-30 (list,
 * default and delete only); `null` is an older row whose network is unknown
 * (list and delete only). Neither is ever pre-selected for a payment.
 */
export type SavedMethodProvider = SavedWalletProvider | 'CARD' | null;

/** Drives which icon to render. `BANK_TRANSFER` occurs on older rows only. */
export type PaymentMethodKind = 'MOBILE_MONEY' | 'CARD' | 'BANK_TRANSFER';

/** The shape returned by every read/write endpoint. */
export interface SavedPaymentMethod {
  id: string;
  provider: SavedMethodProvider;
  kind: PaymentMethodKind;
  /** Text for lists and rows, e.g. `MTN Mobile Money · ••••4417`. */
  label: string;
  /** e.g. `+2376••••4417`. `null` for a card or an older row with no known number. */
  maskedPhone: string | null;
  /** Last 4 digits of the number (or of the card, on an older card row). */
  last4: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/** POST body. Strict: the server refuses any other key (400). */
export interface AddPaymentMethodPayload {
  provider: SavedWalletProvider;
  /** International format, e.g. `+237670124417`. */
  phoneNumber: string;
  /** 1–100 characters. Omit (never send blank) to let the server write one. */
  label?: string;
  isDefault?: boolean;
}

// ─── Response envelopes ─────────────────────────────────────────────────────────

export interface PaymentMethodsListResponse {
  success: boolean;
  data: SavedPaymentMethod[];
}

export interface PaymentMethodResponse {
  success: boolean;
  data: SavedPaymentMethod;
  message?: string;
}

export interface DefaultPaymentMethodResponse {
  success: boolean;
  data: SavedPaymentMethod | null;
}
