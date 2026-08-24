import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
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
  server: {
    port: 5173,
    strictPort: true, // Exit if port 5173 is already in use
  },
});
