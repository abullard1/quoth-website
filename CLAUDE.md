# Quoth website

Marketing site for Quoth (voice dictation app). No framework chosen yet.

## Design system: SBB Lyne

We build on the SBB Design System (https://digital.sbb.ch) via its Lyne
web components. Docs: https://lyne-elements.app.sbb.ch, repo
https://github.com/sbb-design-systems/lyne-components (MIT).

Packages (versions checked 2026-09-02):

- `@sbb-esta/lyne-elements` 5.7.0: Lit web components, `<sbb-button>` etc.
- `@sbb-esta/lyne-react` 5.7.0: React wrappers, `import { SbbButton } from '@sbb-esta/lyne-react/button'`
- `@sbb-esta/lyne-design-tokens` 2.1.0: tokens as CSS vars / JS
- `@sbb-esta/lyne-elements-experimental`: only if a component is missing from stable

Setup:

- Import `@sbb-esta/lyne-elements/standard-theme.css` globally (add
  `font-characters-extension.css` for full glyph set).
- Next.js: add lyne + lit packages to `transpilePackages`; optional SSR via `@lit-labs/nextjs` `withLitSSR()`.
- Use `--sbb-*` design tokens instead of hardcoded values. Theme variants: standard, lean, off-brand.

Licensing caveat (unresolved): Lyne code is MIT, but `standard-theme.css`
loads the proprietary SBB font from `cdn.app.sbb.ch`, and SBB's rights-of-use
page restricts icons/logo/brand elements to SBB projects and forbids
commercial reuse. Before shipping, either confirm rights or override
`--sbb-typo-font-family` with a licensed font and avoid SBB icons/pictograms.

## Tooling

- MCP (project `.mcp.json`): `vercel` (OAuth via `/mcp`), `context7` (docs lookup).
- Impeccable design skill installed project-locally in `.claude/skills/impeccable`
  with Edit/Write + Stop hooks in `.claude/settings.json`. Run `/impeccable init`
  once the framework is scaffolded.
- `VERCEL_TOKEN` lives in `.claude/settings.local.json` (gitignored).
