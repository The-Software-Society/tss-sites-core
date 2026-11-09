# TSS Sites Core — agent guide

Next.js app that renders block-based sites from JSON, exports them as static files and audits pages for SEO. Read
`README.md` first.

## Layout
- `data/sites/<site>/` — `site.json` (website record), `media.json`, `pages/*.json` (one per page; `/` in a slug is `__`).
- `app/lib/sites/` — site types and the file store. Field names follow the platform's database rows on purpose.
- `app/(site)/sites/[site]/` — the rendered site: layout (theme CSS variables, fonts), `[[...slug]]` page (metadata,
  JSON-LD, blocks), `sitemap.xml`, `robots.txt`, `llms.txt`. `middleware.ts` maps `<site>.localhost` onto it.
- `app/user-website/` — blocks, header, mobile menu, footer, render settings (`hooks/useRenderSettings.tsx`), theme and
  contrast helpers, metadata helpers, JSON-LD. `edit-blocks/blockRegistry.ts` is the source of truth for block shapes.
- `app/lib/seo/` — `measure/` (HTML to a normalized document to datapoints), `pageScore.ts` (pillars and explained
  deductions), `readability.ts`, `keywordVariants.ts`, `local/` (local service page rules), `audit.ts` (page and site
  audits), `siteFiles.ts` (sitemap, robots, llms.txt).
- `app/(dashboard)/` — sites list, audit UI, editor. `app/api/` — audit and page save endpoints.
- `scripts/` — `export.ts` (static export from a running server), `audit.ts` (CLI).

## Rules
- Match the existing style of the file you are in. Ported files keep the platform's style (semicolons in renderer
  files, none in `lib/seo`); new code is terse TS, single quotes, no semicolons.
- Comments explain why, with the measurement or failure that motivated a rule. Keep them when you change code.
- Before changing a shared block or render rule, find out why it is that way. Prefer fixing the data over the rule.
  Media uses `object-fit: cover` even in contain mode on purpose; stored media dimensions are load-bearing.
- US English everywhere: copy, UI strings, sample content.
- No emojis in UI. Colors come from CSS variables (site) or the tokens in `dashboard.css` (dashboard).
- Use made-up sample data only: `.example` domains, 555-01xx phone numbers. Never commit real names, emails or secrets.
- Nothing outbound happens automatically. Network calls are limited to what the user asks for (auditing a URL, link
  checks, the export reading its own server).
- `pnpm typecheck` and `pnpm test` must pass; run `pnpm build` before claiming a renderer change works.

## Checking your work
- `pnpm dev`, then open `http://<site>.localhost:3000/` for each sample site and `http://localhost:3000/audit`.
- After changing the renderer, compare a page before and after, and run `pnpm audit --site=http://localhost:3000/sites/<site> --mirror`.
- Stop only the servers you started.
