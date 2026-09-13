import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  // ⚠ TWO DEPLOYMENT SHAPES NEED TWO DIFFERENT VALUES, AND MODE CANNOT TELL
  //   THEM APART.
  //
  //   Capacitor serves this bundle off the device filesystem, where there is no
  //   origin and only a RELATIVE base resolves. So './' is correct for every
  //   native build and must stay the default.
  //
  //   On the web it is wrong, and wrong in a way that appears only on a hard
  //   refresh of a deep link. index.html would reference ./assets/index-abc.js,
  //   which a browser sitting at C:/Program Files/Git/orders/ID resolves against the current
  //   directory instead of the root. nginx's SPA fallback answers that missing
  //   path with index.html, the browser refuses to execute HTML as a module, and
  //   the page renders blank with a completely clean server log.
  //
  //   The mode flag is NOT the seam here: build:mobile already runs Vite in
  //   production mode, so the web release and the store release share it. An
  //   explicit variable is, and only the web container sets it (deploy/Dockerfile
  //   exports WEB_DEPLOY=1). Nothing else in this repository sets it, so every
  //   existing script keeps exactly the relative base it had before.
  base: process.env.WEB_DEPLOY === '1' ? '/' : './',
  // Load env files (.env, .env.development, .env.mobile, *.local, …) from the
  // ./env folder instead of the project root, so the four profiles sit together
  // and the mobile one is discoverable. See env/README.md (P2.8).
  envDir: path.resolve(__dirname, "env"),
  plugins: [inspectAttr(), react()],
  // Only ever scan the real app entry for dependency pre-bundling. Vite's
  // default is every *.html under the root, which sweeps in the Capacitor
  // sync output (android/app/src/main/assets/public/index.html and the Gradle
  // merged-assets copy) and tries to resolve imports out of an already-built
  // production bundle — e.g. framer-motion's optional @emotion/is-prop-valid.
  optimizeDeps: {
    entries: ["index.html"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Deliberately minimal — only libraries that are already needed on the
        // first frame. The routes are split in `src/routes/lazy.ts`; this just
        // decides where the always-eager libraries underneath them land.
        //
        // ── Why the heavy leaves are NOT pinned here ──────────────────────────
        //
        // The obvious move is to pin recharts, react-day-picker, framer-motion
        // and the Radix set to named chunks. Measured, that makes the app
        // *worse*, and the reason is worth writing down because it is not
        // obvious and it will look like an oversight otherwise.
        //
        // Rollup does not treat a manual chunk as a closed set. Modules this
        // function returns `undefined` for are grouped by which entry points
        // reach them, and a group whose signature matches a manual chunk is
        // merged into it. `clsx` — 362 bytes, imported by `cn`, therefore on
        // the first frame — landed inside a pinned `vendor-charts`, and because
        // a chunk is as eager as its most eager module, that dragged all 392 kB
        // of recharts into the initial load. Pulling `clsx` and `zod` out into
        // their own chunk did not fix it; something else merged in instead.
        //
        // Left alone, Rollup groups strictly by reachability, so a module only
        // a lazy route can reach can never land in an eager chunk. Measured
        // over the whole bundle: pinned groups gave a 1,339 kB eager closure,
        // this config gives 742 kB. Rollup's own grouping is more precise than
        // any hand-written map here, so the rule is to pin only what is eager
        // anyway — where the placement is already decided and the only thing
        // being bought is cache stability.
        //
        // To re-check this after a dependency change, walk `chunk.imports` from
        // the entry in a `generateBundle` hook: that transitive closure is what
        // a signed-out vendor downloads.
        manualChunks(id) {
          const file = id.split("\\").join("/");
          const parts = file.split("/node_modules/");

          if (parts.length < 2) {
            // The English catalog is ~300 kB of source and is needed on the
            // first frame — it is the fallback every other locale resolves
            // against, so it cannot be lazy. Its own chunk instead: it changes
            // on a copy edit, which should not invalidate the app code, and the
            // app code changes constantly, which should not re-download 300 kB
            // of strings. The other four locales are already dynamic imports
            // (see src/i18n/catalogs.ts) and need nothing here.
            if (file.includes("/src/i18n/locales/en/")) return "i18n-en";
            return undefined;
          }

          // Last segment wins for nested dependencies, so a copy of `lodash`
          // hoisted under `recharts/node_modules/` is grouped as `lodash`.
          const rest = parts[parts.length - 1];
          const segments = rest.split("/");
          const pkg = segments[0].startsWith("@")
            ? `${segments[0]}/${segments[1]}`
            : segments[0];

          // Always in the entry — every screen needs them, so this buys cache
          // stability rather than a smaller first load.
          if (["react", "react-dom", "scheduler", "react-router", "react-router-dom", "@remix-run/router"].includes(pkg)) {
            return "vendor-react";
          }

          // The always-eager utility leaves: `cn` is called on nearly every
          // component, and the stores validate with `zod` before a route is
          // even chosen. Splitting them out of the entry does not shrink the
          // first load — they are needed either way — but it keeps ~260 kB of
          // stable dependency out of a file that changes on every app deploy.
          if (["clsx", "tailwind-merge", "class-variance-authority", "tslib", "zod"].includes(pkg)) {
            return "vendor-util";
          }

          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true, // Exit if port 5173 is already in use
  },
});
