# Options and option values

**Verified against source on 2026-09-08** — the absence of the options cap and of any
server-side variant generation, against
`jovi-mall/src/modules/catalog/controllers/vendor-option.controller.ts:38-57`,
`routes/vendor-products.routes.ts:380-407`, `domain/services/variants/OptionService.ts:41-70` and
`domain/services/variants/constants.ts:9-12`, plus a repository-wide reachability grep. Both
claims held — the cap exists in code and no live route reaches it.

**Base path:** `/api/vendor/products/:productId/options` · **Routes: 10**

| Method | Path |
|---|---|
| `GET` · `POST` | `/:productId/options` |
| `PATCH` · `DELETE` | `/:productId/options/:optionId` |
| `PUT` | `/:productId/options/reorder` |
| `GET` · `POST` | `/:productId/options/:optionId/values` |
| `POST` | `/:productId/options/:optionId/values/bulk` |
| `PATCH` · `DELETE` | `/:productId/options/:optionId/values/:valueId` |

Variants: [variants.md](./variants.md).

---

## 0 · 🔴 The client composes variants — the server never generates them

There is **no cartesian-product generation**. Creating "Colour: Red, Blue" and "Size: S, M" produces
**four option-value rows and zero variants**. Your editor must create each variant explicitly and
pass the `optionValueIds` it represents.

A variant-generation engine exists in the codebase but **nothing reaches it over HTTP** — it is dead
code, along with the error codes it raises. Re-verified 2026-09-08: a repository-wide grep for
`OptionService` and `VariantGeneratorService` outside `catalog/domain/services/variants/` returns
nothing, and `VendorOptionController.createOption` writes through `optionRepository.create`
directly (`vendor-option.controller.ts:38-57`).

**The full flow:**

```
POST /:productId/options                    { name: "Colour" }        → optionId
POST /:productId/options/:optionId/values   { value: "Red" }          → valueId
POST /:id/variants  { sku, price, optionValueIds: ["<valueId>", …] }  ← YOU build these
```

---

## 1 · 🔴 Deleting an option or a value silently orphans variants

Neither delete touches variants. **No cascade, no refusal, no archive.**

Both are soft deletes, so afterwards:

- the option/value rows are filtered out of every read
- every variant keeps its now-dangling `optionValueIds`
- every variant keeps an `optionSignature` encoding ids that resolve to nothing

The vendor sees variants with blank or nonsensical labels and no explanation.

**Your editor owns the ordering.** Before deleting an option or value:

1. Find every variant referencing it.
2. Archive or delete those variants first.
3. Then delete the value/option.

And warn the vendor. There is no server-side safety net here at all.

---

## 2 · Options

### `GET /:productId/options`

```jsonc
{ "success": true,
  "data": [ { "id": "…", "productId": "…", "name": "Colour", "position": 1,
              "createdAt": "…", "updatedAt": "…", "deletedAt": null, "purgeAt": null,
              "values": [ { "id": "…", "optionId": "…", "value": "Red" } ] } ],
  "meta": { "total": 2 } }
```

⚠ **`meta.total` is the option count, not pagination.** This endpoint is not paginated.

⚠ **Three different shapes for "an option value" on this surface:**

| Endpoint | Value shape |
|---|---|
| `GET /options` — nested | `{ id, optionId, value }` only |
| `GET /options/:optionId/values` | the **full** object, with timestamps |
| `POST`/`PATCH` on an option | **no `values` key at all** |

Do not share one type across the three.

Options are sorted by `position`. **The nested values are unsorted** — sort client-side if order
matters.

### `POST /:productId/options`

Body: `{ "name": string, "position"?: integer }`.

`name` is 1–50 characters and restricted to **letters, digits, spaces and hyphens**. `position`
defaults to the next free slot.

| Status | Code |
|---|---|
| 404 | `CATALOG_PRODUCT_NOT_FOUND` |
| **400** | `CATALOG_PRODUCT_INVALID_TYPE` — **only physical products can have options** |
| **409** | `CATALOG_PRODUCT_SIMPLE_MODE_LOCKED` — `details.convertEndpoint` |
| 409 | `DATABASE_UNIQUE_CONSTRAINT_VIOLATION` — duplicate name |

🔴 **There is no maximum-options cap over HTTP.** `MAX_OPTIONS_PER_PRODUCT = 3` and its
`422 CATALOG_OPTION_LIMIT_EXCEEDED` live in `OptionService`
(`domain/services/variants/OptionService.ts:52-53`), which **nothing imports** — the live
controller never consults it. If your UI wants a limit, that limit is yours. *(The backend's doc
claimed the cap was enforced until 2026-09-06; it now marks both it and
`CATALOG_VARIANT_LIMIT_EXCEEDED` unreachable.)*

### `PATCH` and `DELETE /:productId/options/:optionId`

`PATCH` takes `name?` and `position?`. An empty `{}` is accepted and writes nothing.

⚠ **Neither checks the product type or simple mode** — only `POST` does. So options can be edited on
a product that could never have been given options in the first place.

`DELETE` removes the option **and all its values** (both soft), and returns
`{ success, message }` with **no `data`**. **Not transactional** — a partial failure can leave values
deleted and the option alive.

### `PUT /:productId/options/reorder`

Body: `{ "optionIds": ["…", "…"] }` — 1–10 entries, each a valid id **belonging to this product**.
A stranger's id gives `400 CATALOG_INVALID_OPTION_ID` with `details.optionId`.

🔴 **It does not require a complete permutation and does not reject duplicates.** Positions are
assigned by array index, so a partial list leaves unnamed options at their old positions —
**which can collide**. And it is not transactional, so a partial reorder can persist.

**Always send the complete, deduplicated list in the order you want.**

---

## 3 · Option values

### `POST /:optionId/values` and `…/values/bulk`

Single: `{ "value": string }` — 1–100 characters, **no trimming and no character restriction**
(unlike option names).

Bulk: `{ "values": ["S", "M", "L"] }` — **1–50 entries**.

🔴 **Bulk is partial-success on failure, and there is no compensating delete.** It is a plain
multi-insert with no transaction: if the 30th value collides with an existing one, you get
`409 DATABASE_UNIQUE_CONSTRAINT_VIOLATION` **and the first 29 stay written**.

**Do not retry a failed bulk call blindly** — re-read the values first, or you will duplicate the
ones that landed.

The schema does not reject duplicates within your own array either: `["S", "S"]` passes validation
and then collides at the database.

`201` for both, with `meta: { created: N }` on bulk.

### Duplicate handling — and a casing asymmetry

Duplicates surface as an uncaught `409 DATABASE_UNIQUE_CONSTRAINT_VIOLATION` with `details.keyValue`
— **not** a catalog-specific code. There is no pre-check; it is the global handler converting
Mongo's 11000. `details` survives on the wire, because the exposure rule strips it only for
`internal` and `external_service`. *(The backend's doc did not name this code until 2026-09-06; it
now does.)*

🔴 **Option names are case-SENSITIVE; option values are case-INSENSITIVE.**

| | Duplicate rule |
|---|---|
| Option name | `"Colour"` and `"colour"` are **different** — both allowed |
| Option value | `"Red"` and `"red"` **collide** |

### ⚠ These uniqueness rules may not hold in production

Both constraints are declared on the schemas and **no migration builds the indexes**. Index
auto-creation is off in production. So the duplicate rules above hold in development and **silently
do not hold in production** — where duplicates simply succeed.

**Do not rely on the 409 as your only duplicate guard.** Check client-side against the list you
already have.

### ⚠ Soft-deleted names still block reuse

Neither index excludes deleted rows. Where the indexes *do* exist, deleting an option called
"Colour" and recreating it 409s, as does deleting the value "Black" and re-adding it. **There is no
restore route.** Consider renaming rather than deleting.

### `PATCH` and `DELETE /:optionId/values/:valueId`

`PATCH` takes `{ "value"?: string }`; an empty `{}` writes nothing.

**`PATCH` is safe** — the row id does not change, so no variant's `optionValueIds` or
`optionSignature` moves. **Prefer renaming a value over delete-and-recreate.**

`DELETE` is a soft delete and returns no `data`. See [§ 1](#1---deleting-an-option-or-a-value-silently-orphans-variants).

⚠ A missing value returns **`404 CATALOG_OPTION_NOT_FOUND`** — the *option* code — with the message
"Option value not found". You cannot branch on the code to tell which was missing.

---

## 4 · Simple mode

Only `POST /:productId/options` is blocked on a simple-mode product
(`409 CATALOG_PRODUCT_SIMPLE_MODE_LOCKED`). The other nine are ungated — though on a simple product
there is nothing for them to act on.

[simple-products.md](./simple-products.md).

