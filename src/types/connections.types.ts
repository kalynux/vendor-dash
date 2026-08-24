// Messaging connections — mirrors `/api/me/connections`.
// See api-doc/connections/README.md.
//
// This surface replaced seven endpoints the dashboard used to call, all of which
// 404 now. The handshake also inverted: the platform used to mint a token the
// vendor carried TO the bot; the bot now mints a 6-character code the vendor
// carries BACK here.
//
// 🔴 There is nothing to poll. The platform is entirely passive while the vendor
// is talking to the bot — build an input box, never a spinner.
//
// The connection binds to the User, not to a role, so linking Telegram once
// serves every role that person holds. There is no `requireRole` on these routes.

/** The two linkable messaging channels. Email is not one of these. */
export type MessagingChannel = 'whatsapp' | 'telegram';

/**
 * How to reach the bot for a channel that is not yet linked.
 *
 * Present ONLY when `connected` is `false` — use its presence, not a separate
 * flag, to decide which card to render.
 */
export interface ConnectionInstructions {
  /** The command to send the bot, e.g. `"/connect"`. */
  command: string;
  /**
   * The bot's handle or number. `null` when the deployment has not configured
   * one — the flow still works, the vendor just has to find the bot themselves,
   * so never gate the instructions on this being set.
   */
  botHandle: string | null;
  /** Deep link that opens the bot with the command pre-filled. Nullable, as above. */
  deepLink: string | null;
}

/** One channel's state. `GET` always returns one entry per channel, linked or not. */
export interface MessagingConnection {
  channel: MessagingChannel;
  connected: boolean;
  displayName: string | null;
  /**
   * WhatsApp: the last 4 digits, masked (`"••••1234"`). Telegram: the `@handle`.
   *
   * 🔴 `null` is a normal state for a CONNECTED channel — a Telegram user with no
   * handle has none, and the numeric chat id is never used as a fallback. The raw
   * external identity is never on the wire. Render "Connected" without a
   * subtitle rather than treating this as missing data.
   */
  identityHint: string | null;
  connectedAt: string | null;
  howToConnect?: ConnectionInstructions;
}

/** `GET /api/me/connections` */
export interface ConnectionsListResponse {
  success: boolean;
  data: { connections: MessagingConnection[] };
  message?: string;
}

/**
 * `POST /api/me/connections` — redeems a code.
 *
 * 🔴 The client never says which channel; the code carries it. Do not send one.
 * Success is 200 (not 201) and `data` is a single entry with `connected: true`.
 */
export interface ConnectionRedeemResponse {
  success: boolean;
  data: MessagingConnection;
  message?: string;
}
