# i18n coverage audit — 2026-08-04

Full sweep of `src/` for user-visible text that never reached the translation
catalogs, plus the two "hard rules" the layer exists to enforce (never render a
backend `error.message`; never call `Intl` without an explicit locale).

**Result: 0 untranslated user-facing strings remain.** `en` and `fr` are at full
parity (3583 keys). `npm run i18n:check`, `npx tsc -b` and `npm run build` all pass.

---

## Why the previous audit read as clean when it wasn't

`tools/i18n/audit.mjs` matches JSX text nodes and a whitelist of single-line
attributes. That misses whole categories, and every category it misses was
populated:

| Blind spot | Real strings found |
| --- | --- |
| Object-literal values (`label:`, `title:`, `message:`) | 91 |
| Zod schema messages | 49 |
| Prose interleaved with interpolation (`Page {n} of {m}`) | 18 |
| Ternaries between two literals | 14 |
| Template literals containing prose | 21 |
| Non-whitelisted JSX props (`triggerLabel`, `applyLabel`, `allLabel`) | 13 |
| `new Error()` / thrown-then-rendered | 4 |

`tools/i18n/audit-deep.mjs` (`npm run i18n:audit:deep`) now covers all of these.
It is a heuristic and still reports ~69 findings, all reviewed and confirmed
non-issues — see [Known false positives](#known-false-positives).

---

## 1. Validation messages that rendered raw English (49)

Zod schemas are built at module load, before a locale exists, so their messages
must be **keys** resolved at the render site through `useMessage()`. Two schema
files still held prose, and their render sites printed it verbatim.

| File | Count | New namespace |
| --- | --- | --- |
| `src/onboarding/schemas/onboarding.schemas.ts` | 35 | `onboarding.validation.*` |
| `src/components/tickets/schemas/ticket.schemas.ts` | 14 | `tickets.validation.*` |

These schemas also back **Account → Payout / Branding / Policies**, so the bug
surfaced in settings as well as in onboarding. Render sites converted:

- `forms/PoliciesFields.tsx` — `FieldError` now resolves through `useMessage()`
  (fixes all 23 call sites at once)
- `forms/BasicSetupFields.tsx` — `FieldRow` + the `payout_details` array error
- `forms/BrandingFields.tsx` — four inline `{errors.….message}` renders

Two messages interpolated a constant (`Tracking number must be ${MAX}…`). The
limit is now spelled out in the catalog, matching the existing
`products.validation.*` convention — a key cannot carry params through
`useMessage()`.

## 2. Backend error text rendered to users — hard rule 1 (13 sites)

Every one of these printed the API's developer-facing English instead of
resolving `err.code` through the translated catalog:

`store/index.tsx` (×5) · `MediaPicker.tsx` · `ConnectionsList.tsx` ·
`AgencyConnectionBrowser.tsx` · `Tickets.tsx` · `TicketDetailSheet.tsx` ·
`ReassignAgencyPopover.tsx` · `EntityPicker.tsx` · `hooks/use-infinite-list.ts`

All now use `apiError.resolve(...)` / `apiErrorMessage(...)` with a `fallbackKey`.

Two more of the same class:

- **`pages/Agency.tsx`** surfaced the backend's `message` field directly in a
  success toast (`message ?? "Default agency updated — N order item(s)…"`). Now
  built from `agency.toast.defaultSet` + the existing `itemsReassigned` plural.
- **`pages/Inventory.tsx`** printed `e.message` per failed CSV row. `ApiRowError`
  carries a machine `error` code, so it now resolves through `errors.codes.*`
  with an `inventory.bulk.rowUnknownError` fallback.

Deliberately left as-is (documented in place): `AddPaymentMethodDialog` and
`PaymentDialog` pass through plain `Error` messages that originate from our own
catalog or from Stripe — which is now locale-bound, see §3.

## 3. Locale-blind formatting — hard rule 2

**Three parallel `formatFileSize` implementations existed.** Only
`src/i18n/format.ts` is locale-aware; the copies in `lib/utils.ts` and
`tickets/ticket.constants.ts`, plus local `formatBytes`/`formatSize` in
`Inventory`, `DigitalAssetUpload`, `ProductMediaUpload` and `VariantImageStack`,
formatted numbers with the browser's locale. All call sites moved to
`fmt.fileSize`; the duplicate implementations are deleted.

**Raw `toLocaleDateString`** in `MediaPicker`, `MediaGallery` (×2),
`DateRangePicker` (hardcoded `'en-US'`) and `OrderDateRangeFilter` (hardcoded
`'en-US'`) → `fmt.date(...)`.

**Stripe Elements got no `locale`.** `stripe.elements()` in `StripeCardField` and
`StripePaymentElement` defaults to the *browser* language, so a French vendor on
an English machine saw an English card form and English decline messages. Both
now pass the dashboard locale. This is also what makes the "Stripe's own decline
text is already localized" comment in `PaymentDialog` true.

## 4. Enum tables that doubled as display copy

These held English that was both an identifier and the rendered label, so
translating them required separating the two:

| Table | Fix |
| --- | --- |
| `analytics.service.DATE_RANGE_PRESETS` | ids kept; new `DATE_RANGE_PRESET_KEYS` map for display. `Overview.tsx` was interpolating the raw id into a sentence. |
| `orders.service.adaptTimelineEvent` | 7 hardcoded event labels + a "Fulfillment status changed from X to Y" template → `orders.timeline.*`. `OrderTimelineEvent` now carries `messageKey`/`messageParams`, so the timeline follows a language switch without refetching. |
| `MediaPicker` `KIND_LABELS` / `SORT_OPTIONS` | → `media.filters.kind.*` / `media.filters.sort.*` |
| `ConnectionsList` `CHIPS` / `STATUS_LABEL` | → `agency.status.*` (+3 new statuses) |
| `NotificationSettings` channel labels | → `notifications.settings.channels.*` |
| `MediaGallery` list rows | rendered the raw `kindFromMime()` enum |

## 5. Country and timezone lists

Previously left in English on the grounds that they "need a CLDR-backed list".
The browser ships one: `Intl.DisplayNames`.

- `COUNTRIES` → `COUNTRY_CODES` (codes only) + a new `fmt.country(code)`
  formatter. Correct in every locale, nothing to hand-maintain.
- `TIMEZONES` → `{ value, cityKey, offset }`. Only the city is translated
  (`Cairo` → `Le Caire`, `London` → `Londres`); the `WAT, UTC+1` suffix is
  technical and stays.
- Mobile-money providers (MTN, Orange, Wave, Moov, Airtel) stay as brand names.

## 6. Component strings

~150 strings across 30 files: `MediaPicker` (20), `ConnectionsList` (15),
`AgencyConnectionBrowser` (13), `EntityPicker` (12), `MediaGallery` (9),
`files.service` upload validation (5), `DateRangePicker` (4),
`notifications.utils` relative time (4), `Tickets` (4), `AgencyCard` (3),
`OrderDateRangeFilter` (3), `Notifications` tabs (3), `Analytics` chart legend
(2), plus single strings in `App`, `Overview`, `Inventory`, `SimpleProductEdit`,
`FlagBadge`, `AddressSearch`, `NotificationsBootstrap`, `StepVariants`,
`FollowerSelect`, `BrandingImageUpload` and `ReassignAgencyPopover`.

`EntityPicker` interpolated an English noun into five sentences
(`Select ${noun}…`). That cannot carry French article/gender agreement, so the
copy is now keyed per entity type (`selectOrder` / `selectProduct`).

`notificationTimeAgo` and `describeAccepted` now take the translator as a
parameter, matching the existing convention for context-free modules.

---

## Duplicate and unused keys

**Duplicates: not removed, and shouldn't be.** 60+ English values repeat across
namespaces, but that is the catalog's stated design — the same English word
often needs different translations per context. "Pending" alone has **seven**
distinct French renderings (`En attente`, `En cours d'examen`, `Non payée`,
`Marquer en attente`, `Indexation…`, `Paiement en attente`). Collapsing them
would regress French.

One genuine duplicate was found and deleted: `UPLOAD_VIOLATION_MESSAGES` in
`lib/uploadErrors.ts`, an unreferenced English copy of `errors.upload.violations`.

**Unused: 389 keys have no literal reference** (`npm run i18n:unused`). Removed
the 19 that are provably dead surfaces (`media.storage.*`, five stale
`media.picker.*`, nine stale `agency.connections.*`). The rest are left in place:
most are the `common.*` shared vocabulary, which exists to be reachable, and
deleting keys a `TranslationKey`-typed prop might reach at runtime trades a real
regression risk for no user-visible gain. The report is committed as tooling so
the list stays visible.

---

## Known false positives

`npm run i18n:audit:deep` reports 69 findings that are **not** bugs. Do not chase
them:

- Tailwind class template literals (`OrderDetails`, `MobileOrderDetailSheet`,
  `Products`, the `desktopWidth` helpers in three `*.constants` files)
- Code fragments the JSX regex over-matches (`setValue(...)`, `patchSet(...)`,
  `updateVariant(...)`)
- Developer-only `throw new Error()` — the store/onboarding context guards, and
  `lib/stripe.ts`, whose rejections are swallowed and replaced with catalog text
- Enum/preset **identifiers**, not copy: `'Last 7 days'`, `'Custom'`,
  `sortField:asc`, and keys built dynamically (`products.status.${…}`)
- Brand names (MTN/Orange/Wave/Moov/Airtel, Telegram, WhatsApp) and language
  endonyms (`English`, `Français`, `العربية` in the language picker — correct
  convention)
- Strings already composed from `t()` / `fmt.*` (`Agency.tsx` toast,
  `EarningsSummaryCard`, `BookingDetailSheet`, the timezone labels, file sizes)
- Data concatenation and machine formats: card masks, `MM/YY`, the `mm:ss`
  reschedule timer, media queries, URLs, ISO date keys
- `ApiError.message` fallbacks inside `api.ts` / `files.service.ts` — never
  rendered; resolution happens by `code` downstream
- `name: 'Booking'` in `services.service.ts` — an API payload value, not UI

---

## Verification

```
npm run i18n:check        # parity 3583/3583, all 469 error codes mapped, smoke green
npm run i18n:audit:deep   # 69 findings, all reviewed above
npm run i18n:unused       # 389 unreferenced keys, retained by design
npx tsc -b                # clean
npm run build             # clean
```

Everything here is build-verified only — **a pass against a live backend is still
outstanding**, as is the Arabic RTL utility sweep and the es/pt/ar content.
