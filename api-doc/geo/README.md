# Geocoding

**Verified against backend source on 2026-08-24.**

**Base path:** `/api/geo` · **Auth:** any signed-in role · **Routes: 2**

Used by the address pickers on the vendor profile and the checkout drop-off.

---

## 1 · `GET /api/geo/search`

| Param | Type | Default |
|---|---|---|
| `q` | string 1–300 | **required** |
| `limit` | integer 1–20 | 5 |
| `country` | comma-separated codes | `cm` |
| `lang` | string ≤ 10 | — |

```jsonc
{ "success": true,
  "data": { "provider": "chain", "query": "akwa douala",
            "results": [ /* GeoCandidate[] */ ] } }
```

**An empty match is `200` with `results: []`**, not a 404.

## 2 · `GET /api/geo/reverse`

`lat` (−90…90) and `lng` (−180…180), both **required**.

```jsonc
{ "success": true, "data": { "provider": "chain", "result": GeoCandidate | null } }
```

**No match is `200` with `result: null`.**

---

## 3 · `GeoCandidate` — snake_case

```jsonc
{
  "formatted_address": "Akwa, Douala, Littoral, Cameroon",
  "coordinates": { "type": "Point", "coordinates": [9.7043, 4.0511] },
  "provider": "geoapify",
  "provider_place_id": "…|null",
  "components": {
    "street": null, "neighbourhood": "Akwa", "city": "Douala",
    "region": "Littoral", "country": "Cameroon",
    "country_code": "cm", "postal_code": null
  }
}
```

🔴 **`coordinates.coordinates` is `[longitude, latitude]`** — GeoJSON order, the reverse of what most
map libraries take. Getting this wrong puts Douala in the Gulf of Guinea.

**All seven `components` keys are always present and individually nullable.** Do not use `in` to
test for one.

### Saving one

When you submit an address, send the candidate **plus `raw_input`** (what the user typed).
`resolved_at` is stamped server-side. The stored object is the candidate plus those two fields.

🔴 **Echo `geo` back byte-identical on addresses the vendor did not edit.** The profile route
compares `provider`, `provider_place_id`, `formatted_address` and both coordinates to decide whether
an entry changed; a re-geocoded or reordered object counts as edited and must re-pass the country
check. See [vendor/profile.md § 2](../vendor/profile.md#2--patch-apivendorprofile).

---

## 4 · 🔴 Every failure except one says "Something went wrong"

`GEO_*` codes at 500 and above derive the `external_service` category, so **the message is replaced
and `details` dropped in every environment**. And no `GEO_*` code has a registry default, so the
literal fallback fires:

| Code | Status | Message you actually receive |
|---|---|---|
| `GEO_PROVIDER_UNAVAILABLE` | 503 | **"Something went wrong"** |
| `GEO_SEARCH_FAILED` | 502 | **"Something went wrong"** |
| `GEO_PROVIDER_NOT_CONFIGURED` | 500 | "Something went wrong" |
| `CONFIG_INVALID_GEO_PROVIDER` | 500 | "Something went wrong" |
| **`GEO_PROVIDER_RATE_LIMITED`** | **429** | **verbatim — the only readable geo failure** |

**Branch on `error.code` and write your own copy.** "We couldn't look that up — try again, or enter
the address manually" beats the generic string.

⚠ **Always offer a manual-entry fallback.** Geocoding depends on a third party, its failures are
opaque, and an address form that cannot be completed without it is a dead end.

⚠ `GEO_PROVIDER_RATE_LIMITED` only escapes when a single provider is configured — a provider chain
absorbs it by falling through.

---

## 5 · The provider chain

Configuration, not something you control. The intended production setting chains
**LocationIQ → Geoapify → Nominatim**, falling through on rate limiting, unavailability **and an
empty result** — so a chain rarely returns nothing when any provider could have answered.

⚠ **`data.provider` is the configured provider *type*, not the one that answered.** In production it
reads the literal `"chain"`. **Do not display it as "resolved by X"** — the per-candidate
`results[].provider` is the real one.

### Results are cached, including misses

Positive results cache for a day; **empty results cache for 10 minutes**. So a newly-mapped address
can take up to ten minutes to appear.

There is **no cache header, no `cached` flag and no bypass parameter**. If a vendor reports "my new
address isn't found", ten minutes is the answer.

---

## 6 · Practical notes

- **Debounce.** The default country filter is `cm` — widen it explicitly for vendors operating
  elsewhere.
- **`q` is capped at 300 characters**, well above any real address.
- There is no geo-specific rate limit — only the global and identity layers apply.
- Both routes are **GETs**, so they survive a `readonly` maintenance window but fail during `down`.

