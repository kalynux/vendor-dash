# Internationalization

The dashboard renders in the language a vendor picks under **Account → Profile → Localization**.
That field is `preferred_language` on the vendor profile — the same value the backend uses to
choose a notification language — so the dashboard and the emails/WhatsApp messages a vendor
receives always agree.

Switching is instant: the locale lives in React context, so every consumer re-renders. No reload.

## Using it

```tsx
import { useTranslation, useFormatters, useApiError } from '@/i18n';

function ProductRow({ product }) {
  const { t } = useTranslation();
  const fmt = useFormatters();
  const apiError = useApiError();

  return (
    <>
      <span>{t('products.columns.price')}</span>
      <span>{fmt.currency(product.price, product.currency)}</span>
      <span>{t('products.variants.count', { count: product.variantCount })}</span>
    </>
  );
}
```

`t` keys are **compile-checked**: a typo, or a key that points at a namespace rather than a
leaf, is a build error.

### Counts

Never branch on `count === 1` at the call site — French treats 0 as singular, Arabic has six
categories. Declare the forms and let `Intl.PluralRules` choose:

```ts
// catalog
orders: plural({ one: '{{count}} order', other: '{{count}} orders' }),
```

```tsx
t('common.units.orders', { count: 0 })  // en → "0 orders",  fr → "0 commande"
```

### Sentences containing elements

Splitting a sentence around a `<strong>` hardcodes English word order. Keep it whole:

```tsx
// catalog: "Deleting {{name}} also removes <0>every variant</0>."
<Trans i18nKey="products.deleteWarning" params={{ name }} components={[<strong />]} />
```

### Outside React

Stores and services can't call hooks. `I18nProvider` publishes the live translator to a
module-level snapshot for them:

```ts
import { tStatic, apiErrorMessage } from '@/i18n';
```

Prefer the hooks inside components — a snapshot can't trigger a re-render.

## Backend errors

**Never show `error.message`.** It is English, written for developers, and sometimes names
internals. Resolve the code instead:

```ts
try { await save(); }
catch (err) { apiError.toast(err, { fallbackKey: 'products.errors.saveFailed' }); }
```

Resolution order:

1. `errors.contexts.<context>.<CODE>` — screen-specific wording, when a `context` is passed
2. `errors.codes.<CODE>` — the shared message
3. `errors.status.<httpStatus>` — for a code this build has never seen
4. `errors.unknown`

Every code in `api-doc/error-codes.ts` has an entry (469 of them). An unmapped code degrades
to the status message and logs a dev-only warning naming the code to add.

Upload failures are special-cased: `UPLOAD_POLICY_VIOLATION` carries one violation per file,
so the resolver names each file and why it was rejected.

## Layout

```
config.ts        which languages exist; direction, Intl tag, completeness
catalogs.ts      the registry — English static, everything else a lazy chunk
translator.ts    lookup, interpolation, pluralization, English fallback
I18nContext.ts   the context object + useI18n
context.tsx      the provider
format.ts        locale-aware number / money / date / relative-time
api-errors.ts    backend codes → user-safe messages
runtime.ts       the same translator for code that can't use hooks
keys.ts          TranslationKey, derived from the English catalog
locales/<code>/  one module per feature namespace
```

English is the schema. Other locales are checked against `DeepPartial<Messages>`, so a
mistyped key fails the build while a merely *missing* key falls back to English — which is
what lets a locale ship one namespace at a time.

## Adding a string

1. Put it in the right feature namespace under `locales/en/`. Keep it in `common` only if two
   unrelated features need it verbatim — the same English word often needs different
   translations in different places.
2. Add the French. `npm run i18n:audit` fails on a gap.
3. Use `t('namespace.path')` at the call site.

## Adding a language

1. Add it to `LOCALES` in `config.ts` with `complete: false`.
2. Add a loader line in `catalogs.ts`.
3. Copy the module layout from `locales/fr/` and translate.
4. Flip `complete: true` — it now appears in the Profile picker.

No component changes at any step. For a right-to-left language, `dir` is already applied to
`<html>` and `useI18n().isRTL` is available, but the app's Tailwind utilities are still
physical (`ml-`, `pl-`, `right-`); convert them to logical equivalents (`ms-`, `ps-`, `end-`)
before enabling it.

## Checks

```
npm run i18n:audit   # locale parity, error-code coverage, hardcoded-string sweep
npm run i18n:smoke   # runtime: plurals, interpolation, fallback, error resolution
npm run i18n:check   # both
```
