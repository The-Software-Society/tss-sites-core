# Roadmap

Sites Core renders sites, exports them and audits them today. The next stretch makes it a real builder: a visual editor,
more blocks, deeper SEO audits and one-command publishing, then multiple sites and people, then ties into project
management. Rough sizes are in hours of focused work.

## 1. Editor (now)

- [ ] Registry-driven form editor: generate each block's content and style controls from `BLOCK_REGISTRY` (`content`,
      `style`, `advanced` declarations) instead of raw JSON (8h)
- [ ] Rich text editing for `richText` fields with a sanitizer that keeps the allowed heading and inline tags (4h)
- [ ] Drag-to-reorder blocks and pages; duplicate a block; undo/redo of unsaved edits (4h)
- [ ] Media library screen: upload into `public/media/<site>`, read real pixel dimensions from the file, edit alt text
      and captions, and warn on missing alt text (5h)
- [ ] Site settings screen: colors with live contrast checks (port `ContrastEvaluatorV2` and the scenario table), fonts,
      spacing, header and navigation (6h)
- [ ] Create, rename and delete pages and sites from the dashboard, with slug validation and redirects for renamed slugs (3h)
- [ ] Inline editing in the preview frame (click text in the page to edit it) (8h)

## 2. Blocks

- [ ] Port the remaining presentational blocks: Slider, Tab Slider, Gallery, Photo Gallery, Data Table, Links, Map
      (keyless embed), Compare (10h)
- [ ] Port the structured footer (row/cell layout with logo, links, contact, socials, text, copyright and map cells) and
      its editor (5h)
- [ ] Custom Code block with the platform's sandboxed runtime and the no-React static render path for pages made only of
      custom code (6h)
- [ ] Contact form block with a pluggable submission adapter (email via SMTP, webhook, or a file inbox); off by default so
      nothing collects visitor data unless the site owner turns it on (5h)
- [ ] Popups and announcement bars (3h)
- [ ] Original social icon set for header and footer (2h)

## 3. SEO

- [ ] Audit history: store each run per page and chart the score and pillars over time (5h)
- [ ] Audit the whole site from the dashboard with a summary table, orphan pages and broken links (4h)
- [ ] Inline fixes: link each failing audit line to the block and field to change in the editor (5h)
- [ ] Core Web Vitals: optional PageSpeed Insights adapter (bring your own key) and a local Lighthouse run for LCP, CLS
      and INP (5h)
- [ ] SERP comparison adapter: measure the pages ranking for a keyword with the same extractor (provider-agnostic, bring
      your own key), and show where the page falls short of the field (8h)
- [ ] Schema editor per page using the schema generator, with validation against required properties per type (5h)
- [ ] Internal link suggestions from the link graph and keyword variants (port the platform's internal link engine) (6h)
- [ ] hreflang and multilingual sites (`settings.language` per site today) (4h)
- [ ] Redirects file per site and 301 handling in the dev server and export (3h)

## 4. Publishing and hosting

- [ ] True static export with no server: render pages directly to HTML and drop the RSC prefetch requests, so the
      export needs no running Next server (6h)
- [ ] Publishing adapters: Netlify, Vercel, Cloudflare Pages, GitHub Pages and S3, each an explicit user action (8h)
- [ ] Custom domain routing in the dev server and a production build that serves many sites by Host header (4h)
- [ ] Image pipeline: responsive sizes and WebP/AVIF at export time (4h)
- [ ] Release history: keep each published version and roll back (5h)

## 5. Multiple sites and teams (later)

- [ ] A storage interface with the file store as one adapter and SQLite as a second, for sites with hundreds of pages (6h)
- [ ] Site templates: start a new site from a sample site or a saved theme (3h)
- [ ] Shared sections reused across pages and sites (5h)
- [ ] Accounts and roles (owner, editor, reviewer) for a hosted multi-site deployment (10h)
- [ ] Review mode: comments pinned to blocks on a preview, resolved by the editor (6h)

## 6. Project management ties (later)

- [ ] Page tasks: each failing audit line can become a task with an owner and due date (4h)
- [ ] Export tasks and audit results to issue trackers (GitHub Issues first) through an explicit sync (6h)
- [ ] A client-facing report page per site: audit trend, published pages, open tasks (5h)

## Quality

- [ ] Component tests for every block (render with sample content and snapshot the markup) (5h)
- [ ] End-to-end smoke test: start the server, render every sample page, export, audit the export (3h)
- [ ] Accessibility pass on the dashboard and blocks (focus states, landmarks, contrast) (4h)
- [ ] CI on GitHub Actions: typecheck, test, build (1h)

Have an idea or need? Open an issue.
