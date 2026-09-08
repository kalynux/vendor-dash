# Rich Product Descriptions (`descriptionRich`)

**Verified against source on 2026-09-08** — R7 re-checked the gate (`vendor-dash/src/lib/richtext/wire.ts:36` — `RICH_DESCRIPTION_WIRE_ENABLED = true`) and the "all four write schemas" claim, which holds exactly: `descriptionRichSchema` is used at `catalog/validators/product.validator.ts:54,90` and `simple-product.validator.ts:51,97`, from the one shared fragment at `rich-description.validator.ts:39`. No defects found.

**Verified against backend source on 2026-08-24** — `src/core/richtext/{types,schema,limits,doc}.ts`,
`src/modules/catalog/validators/rich-description.validator.ts`,
`src/modules/catalog/models/product.model.ts:242,408`.
**Partially re-verified against source on 2026-09-08** — the rollout status only:
`RICH_DESCRIPTION_WIRE_ENABLED` is now `true` (`vendor-dash/src/lib/richtext/wire.ts:36`), which
reverses this page's former call to action. The document model and validator claims still carry
their 2026-08-24 verification.

> ## ✅ CLOSED — the gate is on and nothing is outstanding
>
> `RICH_DESCRIPTION_WIRE_ENABLED` in [`src/lib/richtext/wire.ts`](../../src/lib/richtext/wire.ts)
> is **`true`** (verified 2026-09-08, line 36). Rich descriptions are being sent.
>
> ⚠ **This box read "ACTION: your gate is still off" until 2026-09-08, and it had been wrong for
> some time** — the flag was flipped after the 2026-08-24 audit and nobody came back to the page.
> A loud call-to-action for work already done is worse than no box at all: it invites a second
> developer to "fix" something that is not broken.
>
> For the record, the reason it was flipped: `descriptionRich` is a known key on **all four**
> product write schemas — including the two `.strict()` quick-add ones — through one shared
> fragment (`rich-description.validator.ts:39`), so the `.strict()` asymmetry the constant existed
> to guard against no longer exists.

The structured description a vendor writes in the dashboard's formatting editor, and the source of truth for how a product reads when it is shared into **WhatsApp** or **Telegram**.

> [!IMPORTANT]
> **`description` and `descriptionRich` are not alternatives — they always travel together.**
> `descriptionRich` is the structured document; `description` is its plain-text
> projection. `description` remains the field that the storefront renders, that
> the `product_storefront_text` index tokenises, and that the AI vectoriser
> embeds. A client that sends one without the other, or sends a `description`
> that is not the projection of its `descriptionRich`, is sending inconsistent
> data.

> [!NOTE]
> **Implementation status: shipped, both sides.** The field is accepted on all four product
> write endpoints — including the two `.strict()` quick-add ones — persisted,
> and returned on every vendor-facing product read. The frontend gate
> (`RICH_DESCRIPTION_WIRE_ENABLED`) **is `true`**. See
> [Rollout](#rollout).

## Table of contents

- [The document model](#the-document-model)
- [Endpoints](#endpoints)
- [Field reference](#field-reference)
- [Channel formatting](#channel-formatting)
- [Rollout](#rollout)
- [Possible error codes](#possible-error-codes)

---

## The document model

An array of typed blocks with flat inline spans. Deliberately not HTML and not markdown — see [`docs_requirement.md` §2](../../docs_requirement.md#2-the-data-model) for the reasoning. The vocabulary is the intersection of what WhatsApp and Telegram both render: **bold, italic, strikethrough, links, bullet lists, numbered lists, paragraphs**. Nothing else.

```ts
type InlineNode =
  | { type: 'text'; text: string; bold?: boolean; italic?: boolean; strike?: boolean }
  | { type: 'link'; text: string; href: string; bold?: boolean; italic?: boolean; strike?: boolean };

type Block =
  | { type: 'paragraph'; text: InlineNode[] }
  | { type: 'list'; ordered?: boolean; items: InlineNode[][] };

type RichDoc = { version: 1; blocks: Block[] };
```

### The vocabulary is exactly two block types and two inline types

Confirmed in `src/core/richtext/types.ts`. **There is no third of either**, and no heading,
image, quote, table, colour or font-size node — the union in `schema.ts` is a
`discriminatedUnion` over precisely these:

| | Types |
|---|---|
| **Block** | `paragraph` · `list` |
| **Inline** | `text` · `link` |
| **Marks** (booleans on either inline type) | `bold` · `italic` · `strike` |

Marks are **flat, not nested** — one span carries `bold: true, italic: true` rather than
sitting inside two wrappers. Formatters emit a flat marker pair per span anyway, so a tree
would be flattened again immediately. The nesting order when they *are* rendered is
`strike` → `bold` → `italic`, outermost first (`INLINE_MARKS`).

| Rule | Why |
|---|---|
| `version` must be `1` | A reader that does not recognise it falls back to `description` rather than rendering blocks it cannot interpret |
| A hard line break is `\n` inside a text span, not a new block | In chat a two-line address is one thought; splitting it inserts a blank line through the middle |
| Lists never nest | Neither platform has list markup — both render a literal `• ` / `1. ` prefix |
| `link.text` is stored apart from `href` | Telegram keeps the label, WhatsApp can only show a bare URL. The channels disagree, so the label stays data |
| `href` must be `https:`, `http:`, `mailto:` or `tel:` | Enforced at parse time, never at render time |
| **A relative `href` is REJECTED** | `new URL(href)` with no base throws, and `isAllowedHref` returns `false` (`schema.ts:30-37`). A description is read inside WhatsApp, where there is no origin to resolve against. `/products/x` is a `400`, not a link |
| At most **200** blocks | `MAX_RICH_DOC_BLOCKS` (`types.ts`). Over that is a `400 VALIDATION_ERROR` |

> **Two length budgets you should enforce in the editor, because the server does not.**
> `CHAT_LIMITS.MAX` is **4096** characters — WhatsApp's `text.body` and Telegram's
> `sendMessage.text` both cap there — and `CHAT_LIMITS.CAPTION` is **1024**, the ceiling
> below which a description can also ride along as an image caption, which is how most
> product shares actually go out. Neither is a validation rule on the write path: a longer
> document saves fine and is trimmed **at share time**, by trimming the *document* rather
> than cutting the rendered string (a severed `*` is a broken send, not a shorter one).
> Show the vendor a counter against 1024.

### Example

```json
{
  "version": 1,
  "blocks": [
    {
      "type": "paragraph",
      "text": [
        { "type": "text", "text": "🔥 " },
        { "type": "text", "text": "Sac en raphia tressé", "bold": true },
        { "type": "text", "text": " — fait main à Douala." }
      ]
    },
    {
      "type": "list",
      "items": [
        [{ "type": "text", "text": "Cuir véritable" }],
        [
          { "type": "text", "text": "Garantie " },
          { "type": "text", "text": "2 ans", "bold": true }
        ]
      ]
    }
  ]
}
```

The matching `description` sent in the same request:

```
🔥 Sac en raphia tressé — fait main à Douala.

• Cuir véritable
• Garantie 2 ans
```

---

## Endpoints

`descriptionRich` is accepted alongside `description` on every product write.

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/vendor/products` | Layered create |
| `PATCH` | `/api/vendor/products/:id` | Layered update |
| `POST` | `/api/vendor/products/simple` | Quick-add create — schema is `.strict()` |
| `PATCH` | `/api/vendor/products/:id/simple` | Quick-add update — schema is `.strict()` |

It is returned by `GET /api/vendor/products/:id` and by the write responses. It is **not** included in the trimmed `GET /api/vendor/products` list response.

> [!NOTE]
> The two `/simple` schemas are `.strict()`, so an unknown key there returns
> `400 VALIDATION_ERROR` and rejects the **whole** request rather than stripping
> the field. `descriptionRich` is now a known key on all four, so it is safe to
> send everywhere. Any *other* unknown key on the two `/simple` routes still
> behaves this way.

### Example request — `PATCH /api/vendor/products/:id`

```json
{
  "description": "🔥 Sac en raphia tressé — fait main à Douala.\n\n• Cuir véritable",
  "descriptionRich": {
    "version": 1,
    "blocks": [
      {
        "type": "paragraph",
        "text": [
          { "type": "text", "text": "🔥 " },
          { "type": "text", "text": "Sac en raphia tressé", "bold": true },
          { "type": "text", "text": " — fait main à Douala." }
        ]
      },
      { "type": "list", "items": [[{ "type": "text", "text": "Cuir véritable" }]] }
    ]
  }
}
```

### Example success `200`

```json
{
  "success": true,
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "title": "Sac en raphia tressé",
    "description": "🔥 Sac en raphia tressé — fait main à Douala.\n\n• Cuir véritable",
    "descriptionRich": { "version": 1, "blocks": [] },
    "…": "…"
  },
  "message": "Product updated"
}
```

---

## Field reference

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `description` | string | ✅ on create | Non-empty. The plain-text projection of `descriptionRich` |
| `descriptionRich` | object \| null | No | Must satisfy the model above; `version` must be `1`; ≤ 200 blocks; every `href` in the scheme allowlist |

**Semantics of `descriptionRich` on update:**

| Sent | Effect |
|---|---|
| absent | Stored value left alone |
| an object | Replaces the stored document |
| `null` | Clears it — the vendor removed their formatting |

`null` clears rather than being ignored: omitting it on an emptied description would leave the old document in place while `description` was replaced, and the next read would resurrect formatting the vendor deleted.

**Activation** is unchanged and still gated on `description` — an empty document yields an empty projection, so `CATALOG_PRODUCT_NO_DESCRIPTION` still fires correctly.

**Vectorisation and search** are unchanged and still read `description` only. `descriptionRich` is not indexed and is not sent to the vectoriser.

---

## Channel formatting

The same document produces genuinely different output per channel. This is the reason the field exists.

| | WhatsApp | Telegram (`parse_mode: 'HTML'`) |
|---|---|---|
| bold | `*text*` | `<b>text</b>` |
| italic | `_text_` | `<i>text</i>` |
| strikethrough | `~text~` | `<s>text</s>` |
| link | bare URL — `Label: https://…` | `<a href="https://…">Label</a>` — **label survives** |
| lists | literal `• ` / `1. ` | literal `• ` / `1. ` |
| escaping | **none available** | `&`, `<`, `>` only |

Three consequences worth knowing before writing a sender:

1. **WhatsApp markers must hug non-whitespace.** `* bold *` renders as literal asterisks; `*bold*` renders bold.
2. **WhatsApp has no escape character.** A span whose text already contains its own marker cannot be emphasised — the marker is dropped rather than emitted into broken output.
3. **Telegram must use HTML, not MarkdownV2.** MarkdownV2 requires escaping eighteen characters that product prose is full of (`.`, `-`, `!`, `(`, `)`), and one miss drops the entire message with `400 can't parse entities`.

There are also **two Telegram transports with different capabilities**: a Bot API `sendMessage` with `parse_mode: 'HTML'` keeps every mark, while a `t.me/share/url?...&text=` deep link renders its text verbatim and keeps none. Do not send HTML down the deep link.

Full algorithms, including truncation rules and test vectors, are in
[`docs_requirement.md` §7–§9](../../docs_requirement.md#7-sending-a-description-to-whatsapp).

---

## Rollout

**Both halves are live.** The frontend gate `RICH_DESCRIPTION_WIRE_ENABLED`
(`src/lib/richtext/wire.ts:36`) is **`true`** — verified 2026-09-08 — so the field is being
sent. Nothing here is outstanding.

The constant is kept as a kill switch rather than deleted. If it is ever set back to `false`:

- The editor stays fully functional and `description` persists as always.
- Paragraphs, lists, line breaks, emoji and URLs survive a reload — the frontend
  reconstructs the document by parsing `description`.
- Inline marks (bold / italic / strikethrough) and link labels do not survive,
  because by design they leave no trace in the projection.

The rollout is order-independent: the backend accepts the field from clients that
send it and stores `null` for clients that do not, so the two sides can deploy in
either order and no product is left in a broken state by the gap.

### Server-side formatting

The document model, its validator and both channel formatters live in
`src/core/richtext/` — a deliberate mirror of the dashboard's
`src/lib/richtext/`, file for file, since there is no shared package between the
two repositories. `npm run test:rich-description` (149 assertions, no DB) asserts
the backend's WhatsApp and Telegram output against the dashboard's own fixtures
byte-for-byte, so a change on either side surfaces as a diff rather than as a
badly-rendered customer message.

Exported from `core/richtext`: `toPlainText`, `toWhatsApp`, `toTelegramHtml`,
`toTelegramPlain`, `escapeTelegramHtml`, `truncateDoc`, `richDocSchema`,
`parseRichDoc`.

---

## ⚠ You send the pair — the server derives neither half

**The server never derives `description` from `descriptionRich`** (`doc.ts:138`), and must not
start. Your client sends both. If you send a `description` that is not the plain-text projection
of your `descriptionRich`, the platform stores the inconsistency and the storefront shows your
version while WhatsApp shows the other.

This is not doc drift and it is not resolved by anything — it is a standing property of the
contract, kept here when this page's drift section was closed on 2026-09-07.

---

## Possible error codes

| `error.code` | Status | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Malformed document, unknown `version`, disallowed `href` scheme, or more than 200 blocks |
| `REQUEST_BODY_TOO_LARGE` | 413 | The whole request exceeded the body-size ceiling. The 200-block cap bounds the document's shape; this bounds its bytes |
| `CATALOG_PRODUCT_NO_DESCRIPTION` | 422 | `description` is empty at activation — unchanged by this field |

Field-level errors for description *content* are reported against
`error.details.fields[].path === 'description'`, never `descriptionRich`, so the
dashboard's existing error projection onto the editor keeps working.

## Related

- [products.md](./products.md) — product create/update contracts
- [simple-products.md](./simple-products.md) — the quick-add endpoints
- [product-update.md](./product-update.md) — incremental update flow
- [../telegram/README.md](../telegram/README.md) · [../whatsapp/README.md](../whatsapp/README.md)
- [`docs_requirement.md`](../../docs_requirement.md) — the backend implementation brief
