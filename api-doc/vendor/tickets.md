# Support tickets

**Verified against backend source on 2026-08-24.** Read out of `jovi-mall/src/modules/tickets/`,
not out of a document. The backend's own `api-doc/vendor/tickets.md` disagrees with source in
**twenty** places, several of them load-bearing — see [§ 11](#11--where-the-backends-own-doc-is-wrong).

**Base path:** `/api/vendor/tickets` · **Auth:** vendor session · **Routes: 14**

---

## 0 · The five things that will cost you a day

1. **Pagination is keyed `pagination`, not `meta`** — on all three list endpoints. And the *inner*
   key differs between them: the ticket list says **`totalPages`**, both `reference/*` say
   **`pages`**. [§ 1.1](#11-the-pagination-block)
2. **Two different serialisations.** Reads return `_id` **and** `id`; the five write routes return
   `id` and **no `_id`**. Key on **`id`** — it is present on both. [§ 9](#9--two-response-shapes)
3. **There are 39 ticket types, not 44**, and no free-text search on the list.
4. **There is no status state machine.** Every transition is legal except setting the status it
   already has. The flow diagram in the old docs is descriptive, not enforced. [§ 5](#5--status)
5. **Attachments are JSON + a file id**, not multipart. [§ 7](#7--attachments)

---

## 1 · `GET /api/vendor/tickets/`

Lists **every ticket the vendor follows** — not only ones they created. Being assigned a ticket, or
being added as a follower, puts it in this list.

### Query parameters

| Param | Type | Default | Notes |
|---|---|---|---|
| `type` | string | — | **not enum-validated** — a typo returns an empty page, not a 400 |
| `status` | enum | — | the 9 statuses in [§ 5](#5--status) |
| `priority` | enum | — | `low` · `normal` · `high` · `urgent` |
| `entityType` | enum | — | the 11 `EntityType` values, UPPERCASE |
| `entityId` | string | — | |
| `createdByUserId` | string | — | |
| `assignedToRole` | enum | — | `admin` · `vendor` · `customer` · `agency` · `agent` |
| `assignedToUserId` | string | — | |
| `page` | integer | `1` | ≥ 1 |
| `limit` | integer | `20` | 1–100 |
| `sortBy` | enum | `createdAt` | `createdAt` · `updatedAt` · `priority` · `status` |
| `sortOrder` | enum | `desc` | `asc` · `desc` |

🔴 **There is no `q` / `search` parameter.** The schema is non-strict, so sending one is *silently
stripped* — you get an unfiltered page and no error. If you need search on tickets, filter
client-side within a page or file a backend request. (The backend's own doc documents a `q`
parameter that does not exist.)

### 1.1 The pagination block

```jsonc
{
  "success": true,
  "data": [ /* … */ ],
  "pagination": { "total": 84, "page": 1, "limit": 20, "totalPages": 5 }
}
```

**`pagination`, not `meta`** — this is one of only three endpoints on the whole platform that does
this. And note `totalPages` here versus `pages` on the two `reference/*` endpoints
([§ 8](#8--reference-lookups)). Read defensively:

```ts
const p = res.pagination ?? res.meta;
const pageCount = p?.totalPages ?? p?.pages ?? 0;
```

### The ticket object

```jsonc
{
  "_id": "66b1…",            // present on READS only
  "id": "66b1…",             // present on reads AND writes — key on this
  "__v": 0,
  "subject": "Order 4821 never arrived",
  "description": "…",
  "type": "ORDER_ISSUE",
  "status": "waiting_on_admin",
  "priority": "high",
  "importance": "critical",           // immutable after creation
  "priority_locked": false,
  "entity_type": "ORDER",
  "entity_id": "66c2…",
  "tracking_number": "JVM-8841-CM",
  "created_by_role": "vendor",
  "created_by_user_id": "66a0…",
  "assigned_to_role": "admin",
  "assigned_to_user_id": null,
  "created_by":  { "user_id": "…", "role": "vendor", "name": "…", "avatar": FileDetail|null },
  "assigned_to": { "user_id": "…", "role": "admin",  "name": "…", "avatar": FileDetail|null },
  "assigned_admin": { "name": "…", "job_title": "…", "department": "…", "avatar_url": "…" },
  "entity": { "type": "ORDER", "id": "…", "label": "…", "reference": "…" },
  "updated_by": ["66a0…"],
  "terminalAt": null,
  "createdAt": "…", "updatedAt": "…", "deletedAt": null, "purgeAt": null
}
```

`followers` is **absent from the list** and present on create and detail.

> ⚠ **Do not render `admin_assignment`.** It is serialised on every ticket response and contains
> the administrator's internal `tier` and `id` — which the backend's own documentation states are
> "deliberately not disclosed to a ticket follower". Use **`assigned_admin`**, which is the
> deliberately-projected public snapshot (`name`, `job_title`, `department`, `avatar_url`).
> Reported to the backend team; treat `admin_assignment` as if it were not there.

---

## 2 · `POST /api/vendor/tickets/`

### Body

| Field | Type | Required | Constraint |
|---|---|---|---|
| `subject` | string | **yes** | 1–200 |
| `description` | string | **yes** | **1–700** ← note, not 10 000 |
| `type` | enum | **yes** | one of the 39 in [§ 10](#10--ticket-types) |
| `importance` | enum | **yes** | `low` · `medium` · `high` · `critical` — **immutable afterwards** |
| `entityType` | enum | **yes** | the 11 UPPERCASE values |
| `entityId` | string | conditional | required unless `entityType` is `OTHER`; omitted → defaults to the vendor's own id |
| `trackingNumber` | string | no | 1–120, trimmed |
| `attachments` | string[] | no | file ids, **max 5** |

🔴 **`description` is capped at 700 on create and 10 000 on update.** That asymmetry is real and in
source. A form with one character counter will let a vendor write a 2 000-character first message
and then reject it. Cap the create field at 700.

**`importance` cannot be changed after creation** — there is no route for it. `priority` is the
mutable one. Make the create form say so.

### Errors specific to create

| Status | Code | When |
|---|---|---|
| 400 / 404 | `TICKET_ENTITY_NOT_FOUND` | `entityId` is not a valid ObjectId, or the row does not exist |
| **400** | **`TICKET_REQUIRED_INFO_MISSING`** | the vendor's own support policy demands more. `details: { missing: string[] }` |
| 404 | `TICKET_ATTACHMENT_MISSING` | an `attachments[]` id does not exist |
| 403 | `TICKET_ACCESS_DENIED` | an attachment belongs to somebody else |
| 422 | `TICKET_ATTACHMENT_LIMIT_EXCEEDED` | more than 5 |

**`TICKET_REQUIRED_INFO_MISSING` is the one to build for.** The vendor's `support_policy` can
require a tracking number (on `ORDER` tickets) or at least one photo (on `ORDER` or `PRODUCT`).
`details.missing` names which. Render it inline against the relevant field rather than as a toast.

**Only `ORDER`, `BOOKING` and `PRODUCT` entity ids are checked for existence.** The other eight
types — including `SHIPMENT`, `USER`, `VENDOR`, `AGENT` — are accepted unvalidated. And **there is
no ownership check on any of them**: an id belonging to another vendor's order is accepted.

### Response `201`

`{ "success": true, "data": <ticket with followers[]> }` — **there is no `message` key.**
(The backend's doc shows one on seven different routes. None of them exists.)

---

## 3 · `GET /api/vendor/tickets/:id`

Follower-checked: `404 TICKET_NOT_FOUND` then `403 TICKET_ACCESS_DENIED`. Returns the ticket with
`followers: ActorSummary[]`.

---

## 4 · `PATCH /api/vendor/tickets/:id`

Body: `subject` (1–200) and/or `description` (**1–10 000**). At least one required, else `400`.

**Any follower may edit — not just the creator.** There is no closed-ticket guard here: a closed
ticket's subject and description are still editable.

Returns the raw document ([§ 9](#9--two-response-shapes)). No system note, no event.

---

## 5 · Status

### The enum — 9 values, lowercase

`open` · `in_progress` · `waiting_on_admin` · `waiting_on_vendor` · `waiting_on_customer` ·
`waiting_on_agency` · `waiting_on_agent` · `resolved` · `closed`

### 🔴 There is no state machine

`PATCH /api/vendor/tickets/:id/status` accepts **every** transition. The only rejection is setting
the status a ticket already holds (`400 TICKET_INVALID_STATUS_TRANSITION`, "Status is already set
to this value"). A vendor can drive `closed → open`, `resolved → in_progress`, anything.

Any flow diagram you have seen for this is **descriptive**. If your UI should constrain the
choices, that constraint lives in your UI — the backend will not enforce it.

Two real rules do apply:

- **`waiting_on_<role>`** (other than `waiting_on_admin`) requires a follower holding that role,
  else `400 TICKET_WAITING_TARGET_NOT_PARTICIPANT`. So "waiting on customer" is only selectable
  once the customer is actually on the ticket.
- Entering `resolved` or `closed` stamps `terminalAt`, which starts the attachment-cleanup grace
  clock. Moving back out clears it.

Guard: **follower**, not creator. `403 TICKET_ACCESS_DENIED`.

### What `closed` actually blocks

Three hard `409 TICKET_CLOSED` refusals — and all three key on **`closed` only, never `resolved`**:

| Action | Blocked when closed? |
|---|---|
| `POST /:ticketId/notes` | **yes** |
| `PATCH /:id/priority` | **yes** |
| `POST /:ticketId/attachments` | no — attachments still accepted |
| `PATCH /:id` (subject/description) | no |
| `PATCH /:id/status` | no — this is how you reopen |

**A `resolved` ticket accepts notes and priority changes.** Do not grey those out on `resolved`.

---

## 6 · `POST /:id/close`, `PATCH /:id/priority`, `PATCH /:id/assign`

### `POST /api/vendor/tickets/:id/close`

No body. **Creator-only** — a follower who did not create the ticket gets `403 TICKET_ACCESS_DENIED`.
Idempotent: closing an already-closed ticket succeeds. Writes a `"Ticket closed"` system note and
publishes **no** event.

**There is no `/reopen` on the vendor surface** (it exists but is admin-only and unmounted). To
reopen, use `PATCH /:id/status` with `open`.

### `PATCH /api/vendor/tickets/:id/priority`

Body: `{ "priority": "low" | "normal" | "high" | "urgent" }`.

| Status | Code | When |
|---|---|---|
| 409 | `TICKET_CLOSED` | closed (not `resolved`) |
| 403 | `TICKET_PRIORITY_LOCKED` | an admin has locked it — a vendor can never unlock |

A vendor **never** sets the lock; only an admin does. Setting the same priority twice is allowed.

### `PATCH /api/vendor/tickets/:id/assign`

Body: `{ "targetRole", "targetUserId?" }`.

- `targetRole: "admin"` with no `targetUserId` → assigns to the **admin pool**. This is the normal
  vendor action: "escalate to support".
- Any other role → `targetUserId` is **mandatory**, else `400 TICKET_ASSIGN_FAILED`.

Side effects: the target is silently added as a follower (subject to a lifetime cap of 5
non-admin followers → `422 TICKET_FOLLOWER_LIMIT_EXCEEDED`), and a **public** system note is
written naming the role and the raw user id.

> ⚠ This route has **no follower check and no ownership check**. That is a backend defect, not a
> capability to build on. Offer "escalate to support" (`targetRole: "admin"`, no id) and nothing
> else.

---

## 7 · Attachments

### 🔴 It is JSON with a file id — not multipart

```http
POST /api/vendor/tickets/:ticketId/attachments
Content-Type: application/json

{ "fileId": "66d1…", "visibility": "PUBLIC", "visibleToUserIds": ["66a0…"] }
```

Two steps: upload to `POST /api/files/upload` first ([uploads/README.md](../uploads/README.md)),
then attach the returned id here.

**`visibility` is UPPERCASE here — `PUBLIC` / `PRIVATE`.** Note visibility is **lowercase**
`public` / `private` ([§ 7.2](#72-notes)). The two validators genuinely disagree, both are
`z.enum`, and the wrong casing is a `400 VALIDATION_ERROR`. This is the most reliable way to waste
an afternoon on this page.

`visibleToUserIds` must be **non-empty if provided** (an empty array is a validation error), but —
unlike notes — its members are **not** required to be followers.

| Status | Code | When |
|---|---|---|
| 422 | `TICKET_ATTACHMENT_LIMIT_EXCEEDED` | 5 per ticket |
| 404 | `TICKET_ATTACHMENT_MISSING` | no such file |
| 403 | `TICKET_ACCESS_DENIED` | the file was uploaded by someone else |

You may attach a file you own, or a `system`-owned file. Nothing else.

### The attachment object

```jsonc
{
  "id": "66e1…",
  "fileName": "receipt.pdf",
  "fileSize": 184222,
  "mimeType": "application/pdf",
  "url": "https://api.example.com/api/files/documents/…",
  "uploadedBy": "66a0…",
  "uploadedByRole": "vendor",
  "uploadedByActor": { "user_id": "…", "role": "vendor", "name": "…", "avatar": FileDetail|null }
}
```

Three absences to design around:

- 🔴 **`createdAt` is not on the wire.** The backend reads a field name that does not exist on the
  model, so it serialises as `undefined` and JSON drops it. **Do not render an upload timestamp
  for attachments** — you do not have one. (The backend's doc shows one.)
- **`visibility` is never returned.** You cannot tell a `PRIVATE` row from a `PUBLIC` one after
  the fact, so you cannot render a privacy badge.
- **`access` is not returned** either — this object does **not** go through the standard
  `FileDetail` resolver. `url` is always a plain string. In practice a ticket attachment today is
  **public**: it lands in the general `documents/` or `images/` tree, which is not private. See
  [files/private-files.md](../files/private-files.md) for why that is worth knowing.

`GET /:ticketId/attachments` returns `{ success, data: [...] }` with **no pagination block at all**.

### 7.2 Notes

Notes **are** the conversation thread. There is no message model, no message route, no unread
count and no note pagination — `GET /:ticketId/notes` returns every visible note in chronological
order, system notes interleaved.

```http
POST /api/vendor/tickets/:ticketId/notes
{ "content": "…", "visibility": "public", "visibleToUserIds": [] }
```

| Field | Constraint |
|---|---|
| `content` | **1–300 characters** — much shorter than the ticket description |
| `visibility` | **lowercase** `public` \| `private`, default `public` |
| `visibleToUserIds` | default `[]`; every member **must already be a follower**, else `403` |

- **`public`** — every follower, the customer included. This is the customer-visible channel.
- **`private`** — the author, every admin follower, plus the named ids. The backend expands that
  list at write time; you cannot retract it later (notes are **append-only** — no edit, no delete).

A vendor may author both. Guards: `404` → `409 TICKET_CLOSED` → follower check → the
`visibleToUserIds` check.

**System notes** appear in the same feed with `is_system_note: true` and an author of
`{"user_id": "000000000000000000000000", "role": "admin", "name": "Admin", "avatar": null}`.
They are emitted on status change, assignment, priority change, close and follower changes.
Render them as timeline events, not as messages — and note they can contain a raw user id.

The note object has **no `updated_at`** (the model disables it) and, like the ticket reads, carries
both `_id` and `id`.

---

## 8 · Reference lookups

Two pickers for the create form. Both mounted above `/:id`, so `reference` is never read as an id.

| Route | Returns |
|---|---|
| `GET /api/vendor/tickets/reference/orders` | the vendor's orders, for `entityId` + `trackingNumber` |
| `GET /api/vendor/tickets/reference/products` | the vendor's products, for `entityId` |

Query: `page` (default 1), `limit` (default 20, **max 50**), `q`.

**These are parsed by hand, not by Zod.** Out-of-range values are **clamped, never rejected** —
`?limit=999` gives you 50 and `?page=abc` gives you page 1. There is no `400` path here, which
differs from the list route.

`q` on orders searches order number, customer name, and shipment tracking number. On products it
searches title, category and tags.

Both respond with `pagination: { total, page, limit, pages }` — **`pages`, not `totalPages`.**

```jsonc
// reference/orders
{ "id": "…", "orderNumber": "…", "orderType": "…", "fulfillmentStatus": "…", "createdAt": "…",
  "customerName": "…|null",
  "customerAvatar": FileDetail|null,
  "shipments": [ { "shipmentId","agencyId","agencyName","agentId","trackingNumber","status" } ] }

// reference/products
{ "id": "…", "title": "…", "slug": "…", "category": "…|null", "tags": [],
  "firstFileUrl": "https://…|null" }
```

⚠ **`firstFileUrl` is a bare URL string**, not a `FileDetail` — the one file field on this surface
that breaks the platform convention. It has no `access` and no null-safety for private trees.
`customerAvatar`, two fields away, *is* a proper `FileDetail`.

---

## 9 · Two response shapes

| Routes | `_id` | `id` | `__v` | Enriched (`created_by`, `entity`, `followers`…) |
|---|---|---|---|---|
| `GET /`, `POST /`, `GET /:id` | ✅ | ✅ | ✅ | ✅ |
| `PATCH /:id`, `/:id/status`, `/:id/assign`, `/:id/priority`, `POST /:id/close` | ❌ | ✅ | ❌ | ❌ |

**Key on `id`.** It is the only field present in both shapes.

And note the second row is *unenriched*: after a status change you get `assigned_to_user_id` but
not `assigned_to`, `entity_id` but not `entity`. **Do not merge a write response into your
list-item store** — re-fetch, or patch only the scalar fields you know changed.

---

## 10 · Ticket types

**39 values**, UPPERCASE_SNAKE. The `ticket_types.txt` file in this folder is current and lists
exactly these, in this order.

```
GENERAL_SUPPORT  ACCOUNT_ACCESS  ACCOUNT_VERIFICATION  PROFILE_UPDATE  SECURITY_ISSUE
ORDER_ISSUE  ORDER_CANCELLATION  ORDER_REFUND  ORDER_DISPUTE  ORDER_FULFILLMENT
PAYMENT_ISSUE  PAYMENT_FAILED  PAYMENT_CONFIRMATION  CHARGEBACK  INVOICE_REQUEST
PAYOUT_REQUEST  PAYOUT_DELAY  PAYOUT_DISPUTE  COMMISSION_QUESTION
BOOKING_ISSUE  BOOKING_CANCELLATION  BOOKING_RESCHEDULE  AVAILABILITY_PROBLEM
PRODUCT_ISSUE  INVENTORY_PROBLEM  PRICING_ISSUE  VARIANT_ISSUE
SHIPPING_ISSUE  DELIVERY_DELAY  DELIVERY_CONFIRMATION  ADDRESS_CHANGE
TECHNICAL_ISSUE  BUG_REPORT  INTEGRATION_ISSUE  API_ACCESS
POLICY_QUESTION  COMPLIANCE  LEGAL_REQUEST
OTHER
```

**`PAYOUT_REQUEST` is not a support category you should offer in the ticket form** — it is the type
the platform opens automatically when a vendor requests a withdrawal. See
[earnings.md](./earnings.md).

---

## 11 · Where the backend's own doc is wrong

Twenty confirmed contradictions, filed in `FRONTEND-SYNC/03-FINDINGS-REGISTER.md`. The ones that
would change what you build:

| The doc says | Source says |
|---|---|
| 44 ticket types | **39** |
| every write returns `message: "… successfully"` | **no `message` key on any of the seven** |
| responses carry `assigned_admin_id` | that field is **deleted**; it is `admin_assignment` now |
| `GET /` supports a `q` search parameter | **there is none** — it is silently stripped |
| the five write routes return `{_id, status, updatedAt}` | they return the **whole document**, with `id` and **no `_id`** |
| only the ticket **creator** may update | **any follower** may |
| only tickets **created by** the vendor are readable | **any ticket they follow** is |
| invalid status transitions are rejected | **every transition is legal** except same-status |
| there is an "Exclusive Admin Locking" mechanism | it was **deleted**; nothing implements it |
| attachment responses carry `createdAt` | the key is **not on the wire** |
| `POST /attachments` can return `404 TICKET_NOT_FOUND` | **unreachable** — there is no ticket lookup on that route |
| `FileDetail` is `{id,key,url,mimeType,size,originalName}` | **`access` is missing from the doc** |
| vendor name falls back to `business_name`, agency to `agency_name` | `Store.name` and `Magazin.name` respectively |
| entity types are `order, product, booking, account, other` | 11 **UPPERCASE** values, and `account` is not one |
| "no `tier`, no `id` — deliberately not disclosed" | **`admin_assignment` carries both.** A promise the source does not keep |

Two further items are backend defects rather than doc drift, and are filed as such: five routes on
this surface perform **no follower check** (`GET`/`POST /:ticketId/attachments`,
`GET /:ticketId/notes`, `PATCH /:id/priority`, `PATCH /:id/assign`), and the administrator `tier`
leak above. **Do not build features that depend on either behaviour** — both are expected to be
fixed.
