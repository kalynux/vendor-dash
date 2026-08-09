# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary users are **vendors (sellers)** on the WiMall marketplace — a deliberately broad base. A single vendor account may combine informal/social-commerce selling (merchants graduating from WhatsApp/Instagram into a real storefront), established SMB retail (existing shops digitizing catalog, inventory, and delivery), and service/booking businesses (appointment-led, availability- and calendar-driven). Physical goods, digital products, and bookable services can all live on the same account.

Vendors use this dashboard to run the operational side of selling: listing and pricing, inventory, incoming orders and their delivery, bookings/appointments, customers, money (earnings, payouts, billing, credit), and support.

The broader platform is multi-role: an account holds one or more of `customer`, `vendor`, `agency`, `agent`, `admin`, each with its own dashboard. **This frontend is the vendor dashboard only**; the other roles have separate surfaces.

## Product Purpose

WiMall is a multi-vendor marketplace and commerce platform. The vendor dashboard is where a seller operates their storefront end to end: configure the store, build the catalog (simple products, advanced products with options/variants, digital/downloadable products, and services with availability and bookings), manage inventory, receive and fulfill orders through connected delivery agencies, handle customers, track earnings and request payouts, manage subscription/billing and credit, and stay in touch through notifications and support tickets. Success is a vendor running the entire selling operation — from listing to delivery to getting paid — without leaving the dashboard.

## Positioning

Two differentiators future work must protect (confirmed by the user):

1. **One dashboard, every product type.** Physical goods, variant/option products, digital downloads, and service/booking businesses are all first-class in the same vendor account and the same UI — not separate tools stitched together.
2. **An operating system for local commerce.** The full stack — store, catalog, logistics (agency-mediated delivery, cash-on-delivery cash chain, live GPS tracking), money, and support — is integrated for real regional markets rather than assembled from disconnected services.

Supporting capabilities that reinforce this position but were not named as the core edge: native agency delivery + COD + live tracking, and chat-native commerce via WhatsApp/Telegram ordering and notifications.

## Operating Context

- **Market:** Pan-African / multi-country by design — multiple currencies and languages. Default currency is XAF and the reference timezone is Africa/Douala (Central Africa), but the product is explicitly not single-market; future work must not hardcode one currency, locale, or language.
- **Roles and delivery model:** Vendors do not ship directly — they connect to **delivery agencies**, which dispatch **agents**. Shipment status transitions are agency-driven; **cash-on-delivery (COD)** runs a cash chain (collect → remit → confirm). **Live GPS tracking** is served by a separate `geo-tracker` service over WebSocket, authorized by the main API.
- **Product and booking work:** Catalog creation is wizard-driven (multi-step: mode/type → basics → media → variants/digital formats → review). Services carry availability rules, a booking calendar, rescheduling, and optional Google Calendar (OAuth) sync.
- **Money:** Subscription plans plus a credit wallet, Stripe card payments, per-plan storage usage limits, earnings and payout requests, and a transactions ledger.
- **Communications:** Push (Firebase Cloud Messaging), WhatsApp templates, and Telegram linking, with per-channel notification preferences.
- **Support:** In-dashboard ticketing tied to orders, products, and other entities.
- **Onboarding:** Guided multi-step vendor onboarding (basic setup → delivery linking → branding → policies) gated before dashboard access.

## Capabilities and Constraints

**Confirmed dashboard areas (from routes/pages):** Overview, Orders, Products (with simple-product create/edit, the product-upload wizard, and product edit), Services (with service upload/edit and bookings), Inventory, Customers, Analytics, Transactions, Tickets, Notifications, Delivery Agencies (agency connections), Media Gallery, Settings (profile, storefront, business address, payout, policies, preferences, security, notifications, billing), and Account.

**API contract (durable — any UI work must respect it):**

- Backend is Express + TypeScript + MongoDB (base path `…/api`); a separate `geo-tracker` service (Go + Redis + Postgres) streams live positions over WebSocket. The same JWT signs both services.
- Response envelope — success: `{ success: true, data, meta? }`; error: `{ success: false, requestId, error: { code, message, statusCode, details? } }`. **Branch on `error.code`, never on `error.message`.** Validation errors carry `details.fields[]` to map onto form fields.
- Auth is cookie-first, Bearer-fallback JWT; browser clients send `credentials: 'include'` and are silently refreshed. A JWT is scoped to one active role.
- Pagination uses `page` / `limit` / `sort` query params; list responses return `meta { total, page, limit, pages }`.
- Conventions: IDs are MongoDB ObjectIds (24-hex); timestamps are ISO-8601 UTC; money is a number in the account currency (default XAF), not minor units; most resources are soft-deleted (lists never return deleted records); optional string fields are clearable via `null`/`""`, while required and verified-identity fields are not.

**Constraints:** Multi-currency and multi-language behavior must not be broken by hardcoding. Delivery is always agency-mediated (there are no direct vendor shipping endpoints by design). This is the vendor surface only.

## Brand Commitments

- **Name:** **WiMall** is the product name — used verbatim in the vendor-facing UI, and lowercased as the internal identifier (package `wimall-vendor-dash`, API service `wimall`, domain `wimall.com`). Earlier scaffold and pre-launch names are legacy and must not reappear anywhere in the codebase.
- No other binding brand assets — logo, palette, typography, or voice — were established during init. *(Undecided — not yet captured.)*

## Evidence on Hand

- **Extensive, real API documentation** under `api-doc/` — per-feature contracts for the vendor role plus customer/agency/agent/admin, and cross-cutting auth, billing, geo, uploads, and tracking.
- **A substantial existing implementation** — roughly 90+ source files across pages, feature components, services, Zustand stores, TypeScript types, and a full shadcn/ui component library; responsive, with dedicated mobile navigation, drawers, and sheets.
- **No confirmed real marketing content, testimonials, customers, pricing figures, or benchmarks** were provided during init — future work must not fabricate these.

## Product Principles

1. **Operator-first, not marketing-first.** This is a tool vendors work inside; clarity, scanability, and task completion outrank expression. (Operate mode.)
2. **One account, many business shapes.** Never design as if a vendor sells only one product type — physical, digital, variant, and service/booking flows must coexist coherently.
3. **Logistics and money are part of the product.** Delivery (agency / COD / tracking) and money (earnings / billing / payouts) are core operational surfaces, not afterthought settings.
4. **Regionally real, not region-locked.** Respect the current Central-African default context (XAF, Douala, chat-native comms) while keeping currency, language, and locale swappable for a multi-country footprint.
5. **Contract-faithful.** Honor the API envelope, role scoping, error-code semantics, and the soft-delete / clearable-field rules so UI behavior matches backend truth.

## Accessibility & Inclusion

Durable inclusion requirements established at init: **multi-language support** and **locale/currency flexibility**, because the product is explicitly multi-country. Mobile-first resilience is implied by the market and the heavy mobile UI but was not formally set as a standard. *(The scaffold README's WCAG 2.1 AA claim is an unverified aspiration, not a confirmed current state.)*
