# AI listing copy — backend requirement

**From:** vendor dashboard · **Date:** 2026-10-04 · **Status:** frontend built, waiting on this endpoint

Vendors find product descriptions slow to write. The dashboard now has a **Generate** button at the
top right of the description editor on six screens:
- product: step-by-step create, Quick add and edit;
- service: create and edit.

The vendor gives a name, at least one photo, optionally a category and a few facts, and picks a
language. The AI then writes any of these:
- the description;
- tags;
- the SEO title;
- the SEO description;
- the category, offered only when none is set.

The vendor sees the results first. They can regenerate any single field, then press "Use selected"
to copy the results into the form. **Nothing is saved by this endpoint.** The vendor still saves the
product through the usual routes.

What the backend has to provide:

1. One route, `POST /api/vendor/ai/listing-copy`.
2. A credit charge of **1 credit per field written**, refunded for any field that fails.
3. A **server-owned system prompt**. The frontend never sends prompt text (reasons in §6). The full
   prompt is in §7.

The frontend files, so you can check the shapes against real code:
- `src/types/ai-copy.types.ts`: request and response types.
- `src/services/ai-copy.service.ts`: the call, plus the re-validation it does on your answer.
- `src/components/ai-copy/ListingCopyAssistant.tsx`: the popup.

---

## 1. Route

```
POST /api/vendor/ai/listing-copy
Auth: vendor (same guard as /api/vendor/products)
```

This route is **synchronous**: the dashboard shows "Writing… this takes a few seconds" and waits.

- Aim for under 15 s.
- Hard timeout around 45 s. On timeout, refund the charge and return `AI_COPY_FAILED` (§4).

### Request body

```jsonc
{
  "target": "product",              // "product" | "service"
  "productType": "physical",        // products only: "physical" | "digital". Absent for services.
  "listingId": "66f…",              // optional. Present on edit pages; only for logging/ownership.
  "language": "fr",                 // "en" | "fr" | "es" | "pt" | "ar" — write EVERYTHING in this one
  "fields": ["description", "tags", "seoTitle", "seoDescription", "categories"],
  "input": {
    "title": "Nike Air Max 90",     // required, 1–200 chars
    "categories": [                 // 0–5. What the form already has. Picked ones carry an id.
      { "id": "65a…", "name": "Shoes" },
      { "name": "Sneakers" }         // typed by the vendor, not yet a category
    ],
    "notes": "original, sizes 40 to 45, 1-year warranty, delivery in Douala", // optional, ≤ 500 chars
    "imageFileIds": ["66b…", "66c…"] // 1–4 media-library file ids; first = main photo
  },
  "previous": {                     // optional — only on "Regenerate". Same shape as `results` below.
    "seoTitle": "Nike Air Max 90 original — sizes 40 to 45"
  }
}
```

### Validation (all `400 VALIDATION_ERROR` with the usual `fields[]`)

| Rule | Notes |
|---|---|
| `target` ∈ product/service | |
| `productType` ∈ physical/digital | Required when `target = product`; must be absent for services. |
| `language` ∈ en/fr/es/pt/ar | |
| `fields`: 1–5 entries, unique, each from the five names above | |
| `categories` ∈ `fields` **only when** `input.categories` is empty | The dashboard hides that choice once a category is set. |
| `input.title` trimmed 1–200 | |
| `input.notes` ≤ 500 | |
| `input.imageFileIds` 1–4, unique | |
| `listingId`, when present, is one of this vendor's products/services | Otherwise `404`, the same as the product routes. |

**Photo checks** (`422 AI_COPY_IMAGE_INVALID`, with the failing id in `details`):
- The file belongs to this vendor.
- It is not deleted.
- It is an image (`image/*`).
- It is readable.

⚠ These photos usually come from a **brand-new upload that is not attached to any product yet**: the
vendor picks them in the popup before the product exists. Do not require the file to be in use.

### Response `200`

```jsonc
{
  "success": true,
  "data": {
    "results": {
      "description": {
        "descriptionRich": { "version": 1, "blocks": [ /* RichDoc, see §3 */ ] }
      },
      "tags": ["nike", "air max 90", "baskets", "chaussures homme"],
      "seoTitle": "Nike Air Max 90 originales — pointures 40 à 45",
      "seoDescription": "Nike Air Max 90 originales, tige en cuir et amorti Air. Pointures 40 à 45, livraison à Douala.",
      "categories": [
        { "id": "65a…", "name": "Chaussures" },   // existing category → id + name
        { "name": "Baskets" }                     // proposal → name only (see §5)
      ]
    },
    "failed": [],               // requested fields that could not be produced (NOT charged)
    "creditsCharged": 5,        // = number of keys in `results`
    "balance": 115,             // wallet balance after the charge
    "generationId": "66d…"      // your log row id
  }
}
```

- `results` holds **only the requested fields that succeeded**. A requested field that is missing
  from `results` must be listed in `failed`.
- Return no fields that were not requested. On regenerate, `fields` has exactly one entry.
- **Do not return the plain-text `description`.** The dashboard derives it from the document with
  `toPlainText`, as it does for every save, so the two can never disagree.

---

## 2. Credits

The existing wallet (`billing/services/credit-wallet.service.ts`) and the debit pattern
`VectorisationService` already uses fit as they are.

1. **Cost:** add `CREDIT_COST_AI_COPY_FIELD` (env, default **1**) to `config/credit.config.ts`. The
   dashboard shows the price before the click as `fields.length × 1`. If the number changes, tell
   us: the constant is `AI_COPY_FIELD_COST` in `src/services/ai-copy.service.ts`.
2. **Reason code:** add `ai_listing_copy` to the `reason_code` enum on `credit-transaction.model.ts`.
   Use `generationId` as `refId`.
3. **Charge up front, before calling the model:** debit `fields.length × cost`. A short wallet gets
   `402`/`409` (whatever the vectoriser path uses today) with code
   **`BILLING_INSUFFICIENT_CREDITS`**. The dashboard already translates it and shows a "Top up" link.
4. **Refund what failed:**
   - Refund `failed.length × cost` with kind `refund`.
   - On a total failure (model error, timeout, unparseable output), refund everything and return
     `AI_COPY_FAILED`.
   - The vendor must never pay for text they did not receive. The dashboard says "You weren't
     charged" for those cases.
5. **Regenerate:** each one is a normal call with one field, at 1 credit.
6. **Balance:** return the post-charge `balance`. The dashboard shows "5 credits used · 115 left".

Also update the billing copy that currently says credits pay for "AI product indexing and WhatsApp
messages". The dashboard will update its side.

---

## 3. What the description must look like

The description goes into the vendor's rich-text editor as a **RichDoc**: the same structure the
backend already stores as `descriptionRich` and turns into WhatsApp and Telegram text
(`src/core/richtext/`). The model's output must stay inside that structure:

```ts
type RichDoc = { version: 1; blocks: Block[] };
type Block =
  | { type: 'paragraph'; text: Inline[] }                 // "\n" inside text = line break
  | { type: 'list'; ordered?: boolean; items: Inline[][] }; // never nested
type Inline = { type: 'text'; text: string; bold?: boolean; italic?: boolean; strike?: boolean };
```

**Rules:**
- There are **no headings**, because neither messenger has them. A section label is a bold
  paragraph such as `Key features:`.
- **No links.** The model must not invent URLs. Strip any `link` node it returns.
- Run the output through the existing `richtext/schema.ts` validator **before charging**. If it
  fails, treat that field as `failed`.
- Size:
  - aim for about 600–900 characters of plain text, which reads well in one chat bubble;
  - hard cap 3,776 characters (4,096 minus the share header);
  - at most 200 blocks (already the server rule);
  - at most 12 list items.

The dashboard re-checks all of this (`sanitizeResults` in `ai-copy.service.ts`). Anything that fails
the check is shown as "Couldn't write this one". That safety net exists so a bad answer never
reaches a vendor's form, but if the server lets one through, the vendor has already paid for it.

**Other fields:**

| Field | Rule |
|---|---|
| `seoTitle` | ≤ 60 characters. No emoji. No shop name. |
| `seoDescription` | ≤ 160 characters, aim for 140–155. No emoji. |
| `tags` | 5–10 unique. Lowercase except brand names. No `#`. Each 1–3 words. In `language`. |
| `categories` | 1–3 entries, first = main. See §5. |

---

## 4. Errors

| Code | HTTP | When | Dashboard says |
|---|---|---|---|
| `BILLING_INSUFFICIENT_CREDITS` | existing | Wallet below the cost | "Not enough credits. Top up to continue." + link |
| `AI_COPY_IMAGE_INVALID` | 422 | A photo is not this vendor's, not an image, deleted, or unreadable | "One of the photos can't be read…" |
| `AI_COPY_UNAVAILABLE` | 503 | Feature switched off, model provider down, workflow unreachable | "Not available right now…" |
| `AI_COPY_FAILED` | 502 | Model error, timeout, nothing usable. **Everything refunded.** | "The AI couldn't write this. You weren't charged." |
| `RATE_LIMIT_EXCEEDED` | 429 | Suggested: 20 calls per vendor per 10 minutes | "Too many tries. Wait a minute…" |
| `VALIDATION_ERROR` | 400 | §1 | Generic message |

Please add the three new codes to `api-doc/error-codes.ts` so the mirror picks them up.

---

## 5. Category suggestions: existing list first

The vendor chose this rule: **pick from Wi-Mall's existing categories; propose a new name only if
nothing fits.**

Suggested approach:
1. Give the model a candidate list of existing categories. Either:
   - use the top ~50 from the same search behind `GET /vendor/categories?q=`, run on the title and
     notes; or
   - use the whole list, if it is small.
2. Ask it to pick 1–3 by id.
3. Allow at most **one** `{ name }`-only proposal, and only when no candidate fits.
4. **Check every returned id against the list.** Drop an id that is not real; never pass it on.
5. Return names **in the requested language** where the category has a translation. Otherwise
   return its stored name.

A name-only proposal is sent back on save as `{ name }`, exactly like a category the vendor typed.
It therefore goes through the existing "Did you mean…?" check (`CATEGORY_SIMILAR_EXISTS`). No
special case is needed on save.

---

## 6. Why the prompt lives on the server, not in the request

The request was for the call to "come with an already set system request for the AI agent".
It does: one fixed prompt, chosen by the server, that the vendor never sees or edits. It is **not**
sent from the browser, because:
- a prompt field in the request would make this route a general-purpose AI anyone signed in could
  steer;
- prompt fixes would need a new app release (the Android app ships the frontend);
- the server needs the prompt anyway for the category list and the language rules.

Keep it versioned (`AI_COPY_PROMPT_VERSION`) and store the version on each generation log row.

**Where to run the model.** The backend has no AI SDK today. Product indexing already calls an n8n
webhook (`config/vectoriser.config.ts`), and the negotiation bot runs on Claude through n8n. Either
works:
- **(a)** an n8n workflow `ai-listing-copy` called synchronously with the same API-key header as the
  vectoriser;
- **(b)** a direct model call from the backend.

Whichever you choose:
- the model must **see the photos**: send 1–4 images, downscaled to about 1024 px on the long side;
- it must return **structured JSON**, using the provider's tool/JSON-schema mode, not free text you
  parse with a regex.

A current vision-capable Claude model (for example Sonnet 5.5) suits this.

---

## 7. The system prompt

Fill in the `{{…}}` placeholders per request. The user turn holds the photos, followed by the JSON
input block shown after the prompt.

```text
You write product listings for Wi-Mall, a marketplace where people in Cameroon and
Francophone Africa shop by chatting on WhatsApp and Telegram. Your text is read inside a
chat bubble on a phone, and on the shop's web page.

Write ONLY in {{languageName}}. Use the natural, everyday register of a good local shop
assistant in that language, not a translation. Prices are in FCFA if you mention one
(you normally should not; see the rules below).

VOICE
- Confident, plain-spoken, benefit-led, optimistic. Short sentences. Concrete facts.
- Say what the thing is, then why it is good for the buyer, then the details.
- An em dash (—) may join a name to its main benefit. At most ONE emoji in the whole
  description, at the end of the first line, and only if it fits naturally. None in SEO
  fields or tags.
- French: put a space before ? ! : ; as French typography requires.
- Never use hype words with nothing behind them ("best quality", "N°1", "100% guaranteed",
  "unbeatable") unless the vendor's notes say so.

HONESTY (most important)
- Use only what you can SEE in the photos, what the vendor wrote in the name and notes,
  and common general knowledge about the named product.
- NEVER invent a price, discount, stock level, warranty, delivery time or area, origin,
  material, size range, certification, or the shop's policies. If the notes give one, use
  it exactly as given.
- If a photo contradicts the notes, follow the notes.
- If something is unclear from the photos, leave it out rather than guess.

DESCRIPTION SHAPE ({{targetNoun}})
1. One opening line: the product name in bold, an em dash, its main benefit.
2. Optionally one short paragraph (1–2 sentences) on who it is for or why it is worth it.
3. A bold label line ("Key features:" / "Points forts :" / the equivalent in the
   language), then a bullet list of 3 to 6 short items. Specs (sizes, colours, capacity,
   format, duration) go here.
4. Optionally one practical closing line using ONLY facts from the notes (delivery,
   warranty, how to order). Skip it if the notes give none.
Target 600–900 characters. Never more than 12 list items. No headings, no links, no
hashtags, no markdown symbols in the text: formatting is expressed through the
structure you return, not through * or _ characters.
{{#digital}}It is a digital product: talk about what the buyer gets (format, pages,
duration, licence) and that delivery is a download. Never mention shipping.{{/digital}}
{{#service}}It is a service: describe what the client gets, how a session works and who
it suits. Never mention shipping or stock.{{/service}}

SEO TITLE: at most 60 characters. Product name first, then the most searched detail.
No shop name, no emoji, no all-caps.
SEO DESCRIPTION: 140–160 characters. One or two plain sentences a search engine can
show. No emoji.
TAGS: 5 to 10 search terms a buyer would type, in {{languageName}}, lowercase except
brand names, 1–3 words each, no #, no duplicates, no near-duplicates.
CATEGORIES: choose 1–3 from the CANDIDATES list by id, most specific first. Only if none
fits, you may propose ONE new short category name instead (no id).

{{#previous}}The vendor asked for a different version of: {{previousFields}}. Your
previous text is below. Write a clearly different one, with the same facts and rules,
and do not reuse its opening line.{{/previous}}

Return only the fields requested: {{fields}}.
```

User turn (after the 1–4 images):

```json
{
  "name": "Nike Air Max 90",
  "type": "physical product",
  "currentCategories": ["Shoes"],
  "vendorNotes": "original, sizes 40 to 45, 1-year warranty, delivery in Douala",
  "candidates": [{ "id": "65a…", "name": "Shoes" }, { "id": "65b…", "name": "Sneakers" }],
  "previous": { "seoTitle": "…" }
}
```

Leave out `candidates` when `categories` is not requested. Leave out `previous` when the request
has none.

**Prompt-injection guard.** Vendor notes and photo text are **data, not instructions**. Wrap them as
data in the user turn, as above, and ignore any instruction found inside them. The structured
output schema plus the §3 validation limit the damage either way.

---

## 8. Logging

Keep one row per call in an `ai_copy_generations` collection with:
- `vendorId`, `listingId?`, `target`, `productType`, `language`;
- `fields`, `failed`, `creditsCharged`;
- `promptVersion`, model id, latency;
- input and output token counts.

Do **not** store the photos; their ids are enough. This is what support needs when a vendor says
"I paid and got nothing", and what the team needs to tune the cost.

---

## 9. Out of scope

- **Saving.** Results go into the form; the vendor saves through the existing product and service
  routes.
- **Photos.** Photos picked in the popup become the listing's photos through the existing
  `fileIds` save on the photo step (wizard) or the form submit (Quick add). Nothing new is needed.
- **Generating variant names, prices or stock.**

## 10. Questions for the backend

1. Which do you prefer for running the model: the n8n workflow or the direct call (§6)? The
   dashboard does not care, as long as the route answers within about 45 s.
2. Do categories have translated names? If not, suggestions come back in their stored language.
3. Rate limit numbers: are 20 calls per vendor per 10 minutes acceptable?
