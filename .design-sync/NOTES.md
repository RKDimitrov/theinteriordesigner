# design-sync notes

## Scope
- Syncs only the shadcn/Base UI primitives in `src/components/ui/` (user choice on first sync). App-level components (profile, wizard, plan-editor, design, …) are intentionally excluded because they depend on server actions, Supabase and next-intl.
- All 50 exports ship, compound sub-parts included (`CardHeader`, `SelectItem`, …), so the design agent gets a `.d.ts` contract for each one. The 16 roots plus `RadioGroupItem` have authored previews; the other 33 sub-parts show the floor card on purpose.

## Build pipeline (the repo is a Next.js app, not a library)
- There is no `dist/`. `node .design-sync/build-ds.mjs` (= `cfg.buildCmd`) builds a mini package at `.ds-sync/pkg/`:
  - an esbuild ESM barrel over `src/components/ui/*.tsx`, with deps external;
  - `tsc` declarations. The generated tsconfig pins `typeRoots` and a `react` path to the **repo's** `@types/react`; otherwise tsc sees the second copy in `.ds-sync/node_modules` and fails with "two different types with this name exist";
  - compiled Tailwind v4 CSS from `.design-sync/ds.css` (imports `src/app/globals.css`, `@source`s `src/components` and `.design-sync/previews`, and safelists layout/token utilities via `@source inline(...)`).
- It needs the staged deps: `cd .ds-sync && npm i esbuild ts-morph @types/react playwright@1.63 @tailwindcss/cli@4 geist`.
- **Re-run `build-ds.mjs` after editing any preview.** The CSS only contains classes Tailwind has seen, so a new `w-96` in a preview is missing until the CSS is recompiled.
- Tailwind `@source inline` brace expansion did not expand a variant group like `{sm,md,lg}:…`. Write one line per variant (`md:{…}`).
- Fonts: the app loads Geist through `next/font/google`, which exists only at Next runtime. `.design-sync/fonts.css` ships Geist and Geist Mono variable woff2 files from the `geist` npm package, and `ds.css` defines `--font-geist-sans` / `--font-geist-mono`.
- `toast` is exposed through `cfg.extraEntries` (`.design-sync/toast-entry.ts`) so previews and designs share the bundled sonner instance. A `toast` imported directly from `sonner` in a preview would be a separate instance, and no toasts would appear.

## Design tokens
- Claude Design builds its token panel (`_ds_manifest.json` → `tokens`) from the CSS it is given. With no `tokens/` file, it scraped `_ds_bundle.css` and listed about 60 Tailwind `--tw-*` utility internals (e.g. `--tw-shadow` scoped to `.shadow-md`), while missing the whole `:root` theme (`--background`, `--primary`, `--radius`, the Geist font vars). Geist then showed as "unreferenced".
- `build-ds.mjs` step 5 now writes `.ds-sync/pkg/tokens/raumplan.css` from the compiled `:root` / `:root, :host` / `.dark` blocks. **User rule:** skip every `--tw-*` variable, and append `/* @kind other */` to any token the name/value heuristics can't classify as color/font/radius/shadow/spacing (currently `--animate-spin`, `--aspect-video`, `--default-transition-duration`, `--default-transition-timing-function`, `--shimmer-angle`).
- It's wired with `tokensPkg: "../.ds-sync/pkg"` (joined onto `--node-modules`, so it resolves to the mini package) and `tokensGlob: "tokens/*.css"`; `styles.css` imports it first.
- The design-system check also scans `_ds_bundle.css`. It flagged the Tailwind `@layer theme` copies of those tokens and the `--tw-*` declarations under utility selectors (`--tw-translate-x/y`, `--tw-border-style`, `--tw-outline-style`, `--tw-backdrop-blur`, `--tw-duration`) as unlabelled. So `build-ds.mjs` step 6 rewrites `dist/styles.css` (which ships as `_ds_bundle.css`): unclassified tokens in `:root` / `:root, :host` / `.dark` blocks and **every** `--tw-*` declaration get `/* @kind other */` (186 tags as of this writing). The theme block is tagged, not removed, so the bundle CSS stays self-sufficient.

## Render check on this machine (Windows)
- The Playwright cache has `chromium-1234`, but playwright@1.63 pins 1243. Point validate/capture at the cached build instead of downloading: `DS_CHROMIUM_PATH=$(cygpath -w ~/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe)`.
- Avoid `python` in Git Bash here: it resolves to the Windows Store stub and hangs.

## Known render warns
- `[TOKENS_MISSING] --available-height, --anchor-width, --transform-origin, --tw`: Base UI sets these at runtime on popups, and `--tw` is a Tailwind internal. Expected.
- `[RENDER_THIN] Dialog`: the dialog content is portaled/fixed, so the card root measures 0px. The captured sheet shows the dialog correctly.

## Preview notes
- `Select` Open story uses `alignItemWithTrigger={false}`. The default aligns the popup over the trigger, which hides the trigger and clips the first group.
- Card modes: Alert/Card/Tabs use `column` (wide stories); Select/Toaster/Tooltip use `single` (portaled overlays escape grid cells); Dialog uses `single` with a 720x420 viewport.

## Re-sync risks
- `build-ds.mjs` depends on the repo's `tsconfig.json` (the `@/*` path) and Tailwind v4 in the repo's `node_modules`. A Tailwind major bump or a tsconfig restructure can break it.
- The safelist in `ds.css` is hand-maintained. Classes named in `conventions.md` must stay compiled, so re-verify them after changing either file.
- New files in `src/components/ui/` are picked up automatically as components, but they get floor cards until someone writes a preview for them.
- Toaster text renders in sonner's own font stack, not Geist, the same as in the app.
- The Geist fonts come from the `geist` npm package at whatever version is installed into `.ds-sync/`. The app gets Geist from Google Fonts, so glyph versions may differ slightly.
