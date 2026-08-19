/**
 * One-shot vendoring of the two Google Fonts families into the repo (P2.7).
 *
 * Keeps only the latin / latin-ext subsets — the app's five locales are
 * en/fr/es/pt (latin) and ar, which neither family covers anyway and which
 * already falls back to a system face today.
 *
 * Lives under tools/ rather than the plan's scripts/ for a plain reason:
 * `/scripts` is in this repo's .gitignore, so a vendoring script placed there
 * could never be committed — and a generated fonts.css whose generator is not in
 * the tree is unmaintainable. tools/ is where i18n, richtext and mobileauth
 * already keep theirs.
 *
 * Usage:  node tools/fonts/vendor-fonts.mjs .
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.argv[2] ?? '.';
const FONT_DIR = path.join(ROOT, 'src/assets/fonts');
const CSS_OUT = path.join(ROOT, 'src/styles/fonts.css');

// Google serves woff2 variable fonts only to UAs it believes support them; a
// Node default UA gets ttf fallbacks instead.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Full axis ranges on purpose: the variable file is the same either way, and a
// narrower declared range makes the browser synthesise weights it already has.
const FAMILIES = [
  { name: 'Inter', slug: 'inter', query: 'Inter:wght@100..900' },
  { name: 'Space Grotesk', slug: 'space-grotesk', query: 'Space+Grotesk:wght@300..700' },
];

const KEEP = new Set(['latin', 'latin-ext']);

const blocks = [];

for (const family of FAMILIES) {
  const url = `https://fonts.googleapis.com/css2?family=${family.query}&display=swap`;
  const css = await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => {
    if (!r.ok) throw new Error(`${url} → ${r.status}`);
    return r.text();
  });

  // Each @font-face is preceded by a /* subset */ comment.
  const re = /\/\*\s*([a-z-]+)\s*\*\/\s*@font-face\s*\{([^}]+)\}/g;
  let m;
  let found = 0;
  while ((m = re.exec(css)) !== null) {
    const [, subset, body] = m;
    if (!KEEP.has(subset)) continue;
    found++;

    const src = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/.exec(body);
    const weight = /font-weight:\s*([^;]+);/.exec(body);
    const range = /unicode-range:\s*([^;]+);/.exec(body);
    if (!src || !weight || !range) throw new Error(`${family.name}/${subset}: unexpected block`);

    const file = `${family.slug}-${subset}.woff2`;
    const bytes = Buffer.from(
      await fetch(src[1], { headers: { 'User-Agent': UA } }).then((r) => {
        if (!r.ok) throw new Error(`${src[1]} → ${r.status}`);
        return r.arrayBuffer();
      }),
    );
    await mkdir(FONT_DIR, { recursive: true });
    await writeFile(path.join(FONT_DIR, file), bytes);
    console.log(`  ${file}  ${(bytes.length / 1024).toFixed(1)} KB`);

    blocks.push(
      [
        `/* ${family.name} — ${subset} */`,
        `@font-face {`,
        `  font-family: '${family.name}';`,
        `  font-style: normal;`,
        `  font-weight: ${weight[1].trim()};`,
        `  font-display: swap;`,
        `  src: url('../assets/fonts/${file}') format('woff2-variations');`,
        `  unicode-range: ${range[1].trim()};`,
        `}`,
      ].join('\n'),
    );
  }
  console.log(`${family.name}: ${found} subset(s)`);
}

const header = `/*
 * Self-hosted typefaces (CAPACITOR-PLAN.md → P2.7).
 *
 * These two families used to load from fonts.googleapis.com at boot. In a
 * browser that is a brief FOUT; in a packaged app it is a first launch rendering
 * fallback type — or, offline, rendering fallback type forever — which reads as
 * broken in a way a website does not. The files are vendored under
 * src/assets/fonts/ and Vite fingerprints them into the bundle.
 *
 * Variable fonts, one file per family per subset: four files rather than the
 * fourteen a static-weight vendoring would need, and no synthesised weights.
 *
 * Subsets are latin + latin-ext only. That covers en/fr/es/pt completely; ar
 * falls back to a system face, exactly as it did when these came from Google —
 * neither family ships Arabic glyphs, so nothing regresses.
 *
 * GENERATED — do not hand-edit. Regenerate with
 * \`node tools/fonts/vendor-fonts.mjs .\`, and change the families named here only
 * alongside the --font-sans / --font-display tokens in src/index.css.
 */
`;

await mkdir(path.dirname(CSS_OUT), { recursive: true });
await writeFile(CSS_OUT, header + '\n' + blocks.join('\n\n') + '\n');
console.log(`\nwrote ${CSS_OUT} (${blocks.length} faces)`);
