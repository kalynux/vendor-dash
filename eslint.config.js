import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // `android` alongside `dist`: every `cap sync` copies the built web bundle,
  // Capacitor's native-bridge.js and Gradle's intermediates in there. Without
  // this ignore the lint count moves on every sync, which destroys the only
  // thing that command is for (CAPACITOR-PLAN.md → P2.1).
  globalIgnores(['dist', 'android']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // ⚠ THE CODE ALREADY FOLLOWS THIS CONVENTION; THE CONFIG DID NOT KNOW IT.
      //   `createProduct = useCallback(async (_product) => {}, [])` and two
      //   siblings in src/store/index.tsx are deliberate no-ops — the product
      //   wizard saves through the service directly — and they already mark the
      //   unused parameters with a leading underscore, which is the usual way to
      //   say "required by the signature, intentionally unused". Without these
      //   patterns eslint reported three errors for code that was already
      //   expressing the right thing.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    // ⚠ GENERATED FILES, AND THE RULE CANNOT BE SATISFIED WITHOUT DIVERGING FROM
    //   UPSTREAM. src/components/ui/* is shadcn/ui output, added and updated by
    //   its CLI. Seven of those files export a variants object or a hook beside
    //   their component — badge, button, button-group, form, navigation-menu,
    //   sidebar, toggle — which is how shadcn ships them. Splitting each one would
    //   mean hand-editing generated code and losing the ability to regenerate it.
    //
    //   Affordable because the rule is DEV-ONLY: it protects Vite's Fast Refresh,
    //   so the cost of a violation is a full reload while developing. Nothing about
    //   the production bundle changes. Every rule that can affect shipped
    //   behaviour still applies to these files.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
