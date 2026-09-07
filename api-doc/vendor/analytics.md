# Analytics

**Verified against backend source on 2026-08-24.**

**Base path:** `/api/vendor/analytics` · **Routes: 4, all `GET`**

---

## 0 · 🔴 These four responses have no `success` key

Every other endpoint on the platform returns `{ success: true, data, … }`. **These four return
`{ data, meta }` only.**

```jsonc
{ "data": { /* … */ }, "meta": { /* … */ } }
```

If your client unwraps by checking for `success`, analytics will fall through to your "unenveloped
payload" branch. `unwrapEnvelope` in this repository already tolerates that — it requires **both**
`success` and `data` before unwrapping, so an analytics response is returned as-is. **That is the
wrong shape** — you get `{data, meta}` instead of the inner payload. Handle these four explicitly.

---

## 1 · Data is precomputed nightly, not live

All four read a pre-aggregated table. **Nothing is computed at request time.**

- Aggregated by a **daily job, by default at 02:00**, for the **previous day**.
- **Today's data does not exist**, and yesterday's may not until the job has run.
- Skipped entirely during a maintenance window.

**Never present analytics as real-time**, and expect the most recent day to be missing.

`meta.lastCalculatedAt` is the newest aggregation timestamp in your range — **show it**.

⚠ It is **absent on `/analytics/products`** and present on the other three.

---

## 2 · The shared query

| Param | Required | Notes |
|---|---|---|
| `from` | ✅ | parsed with `new Date()` |
| `to` | ✅ | |
| `timezone` | | 🔴 **has no effect — see below** |
| `fiscalCalendar` | | `gregorian` only |

| Status | Code |
|---|---|
| 400 | `ANALYTICS_INVALID_DATE_RANGE` — unparseable, or `from > to` |
| 400 | `ANALYTICS_DATE_RANGE_EXCEEDED` — **span over 365 days** |
| 400 | `ANALYTICS_UNSUPPORTED_TIMEZONE` — `details: { timezone }` |
| **503** | `ANALYTICS_AGGREGATION_NOT_READY` |

### 🔴 `timezone` is validated, echoed, and ignored

It is checked, copied into `meta.timezone`, and **never used in the query**. The buckets were already
computed in the **vendor's own timezone** at aggregation time.

So `?timezone=UTC` changes one string in `meta` and nothing else. **Do not offer a timezone
selector** — it will visibly do nothing.

### 🔴 The 503 tells you nothing

When no data exists for the range:

```jsonc
{ "success": false, "requestId": "…",
  "error": { "code": "ANALYTICS_AGGREGATION_NOT_READY", "statusCode": 503,
             "message": "Analytics data not yet available for requested period",
             "category": "external_service" } }
```

Its category is `external_service`, so **the message is replaced and `details` is dropped in every
environment**. The `vendorId`/`from`/`to` the backend attaches never arrive.

**Treat it as an empty state, not an error.** "No data for this period yet" with a hint that
analytics are compiled overnight.

### 🔴 Send `to` with a time component

`from=2026-08-01&to=2026-08-20` parses `to` as **UTC midnight**, and the stored rows carry a real
timestamp — so **the last day is silently dropped**.

```
?from=2026-08-01T00:00:00Z&to=2026-08-20T23:59:59Z
```

This follows from a known inconsistency in how the aggregation stamps its day key. Always send an
end-of-day `to`.

---

## 3 · Money and currency

**Whole currency units, not minor units.** No division by 100.

🔴 **No `currency` field is returned anywhere on this surface**, and the aggregation does not group
by currency. **A vendor trading in two currencies gets a meaningless sum.** Format with the vendor's
profile currency and, if multi-currency is possible for your users, say so.

---

## 4 · The four endpoints

### `GET /analytics/dashboard`

```jsonc
{ "data": { "sales":    { "gmv", "refunds", "netRevenue", "orderCount", "aov" },
            "bookings": { "count", "revenue" } },
  "meta": { "from", "to", "lastCalculatedAt", "fiscalCalendar", "timezone" } }
```

`aov` is recomputed across the whole range as `netRevenue / orderCount` — **not** an average of daily
averages. It is `0` when there are no orders.

`bookings.revenue` is already **net of booking refunds**.

⚠ Booking refunds, conversion rate and cancellation rate are stored but **exposed nowhere**.

### `GET /analytics/sales`

Extra param: `breakdown` — `daily` or `none` (**default `none`**).

```jsonc
// breakdown=none
{ "data": { "gmv", "refunds", "netRevenue", "orderCount", "aov" }, "meta": { … } }

// breakdown=daily
{ "data": { "daily": [ { "date": "2026-08-01", "gmv", "refunds",
                         "netRevenue", "orderCount", "aov" } ] },
  "meta": { …, "breakdown": "daily" } }
```

Two things about the daily branch:

- 🔴 **Days with no activity are absent — there is no zero-filling.** A chart bound directly to this
  array will compress the x-axis and misrepresent gaps. **Fill the range yourself.**
- Here `aov` is the **stored per-day value**, unlike the aggregate branch which recomputes. The two
  will not tie out; that is expected.

`date` is `YYYY-MM-DD` in **UTC**.

### `GET /analytics/products`

Extra param: `limit` — 🔴 **default 5, and silently coerced.** Out-of-range or non-numeric values
become **5** rather than erroring. Valid range is 1–50.

```jsonc
{ "data": { "topByRevenue": [ { "variantId", "sku", "productTitle",
                                "variantTitle", "revenue", "quantity" } ],
            "topByQuantity": [ /* same shape */ ] },
  "meta": { "from", "to", "limit", "fiscalCalendar", "timezone" } }
```

- **Ranked by variant, not by product.** Two variants of one product occupy two rows. Label the axis
  accordingly, or group client-side.
- `variantTitle` is `null` when the variant has none.
- **`orderCount` is not on the wire** here even though it is computed.
- ⚠ **`meta.lastCalculatedAt` is absent on this route only.**
- The 503 fires only when **both** lists are empty.

### `GET /analytics/customers`

```jsonc
{ "data": { "total": 340, "repeat": 88, "repeatRate": 25.88 }, "meta": { … } }
```

🔴 **`total` and `repeat` are summed across days, so a customer active on five days counts five
times.** These are **customer-days, not distinct customers.** Labelling this "Total customers" is
wrong and will not match the customer list.

Label it "customer activity" or similar, or present only `repeatRate`.

`repeatRate` is a **percentage 0–100**, not a fraction, recomputed over the summed totals.

---

## 5 · Rate-limit note

Every analytics request passes the auth stack **twice**, so it consumes **two tokens** from the
900/min vendor bucket — an effective ~450/min on this surface. A dashboard that refreshes four
analytics panels on a timer spends eight. See [rate-limits.md](../rate-limits.md).

---
