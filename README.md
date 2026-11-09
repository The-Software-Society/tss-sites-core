# TSS Sites Core

A block-based website builder, static site export and SEO toolkit you can run on your own machine with no accounts.

You describe a site as JSON: a website record (colors, fonts, spacing, navigation), a media library and pages made of
blocks such as Hero, Two Column, Grid, Steps, FAQs and Table of Contents. Sites Core renders them as fast, server-rendered
pages with correct metadata, canonical URLs, Open Graph and JSON-LD, generates `sitemap.xml`, `robots.txt` and
`llms.txt`, exports each site as static files, and audits any page (yours or any public URL) with a scored SEO report that
says what it measured, what it wanted and what to change.

It is the open-source core of the website builder and SEO engine in [The Software Society](https://thesoftwaresociety.io)
platform, where it runs client sites in production. This repository is an extraction: the renderer, blocks and SEO code
are ported from the platform with storage swapped for local files.

**Who it's for:** developers and small agencies who build sites for small businesses and want the SEO basics done
correctly by default, plus a way to measure pages against the same rules.

**Status:** early. The renderer and SEO toolkit are production code; the editor is a deliberately small JSON editor for
now. See [ROADMAP.md](ROADMAP.md).

## What it does

- **Block renderer.** Eight blocks ported from the platform (Hero with optional WebGL backgrounds, Single Column, Two
  Column, Grid, Large Media, Steps, FAQs, Table of Contents), plus the site header, mobile menu and footer. Themes come
  from the website record as CSS variables: colors, fonts, type scale, spacing and radii. Block settings and content use
  the same shapes as the platform, described in `app/user-website/edit-blocks/blockRegistry.ts`.
- **Per-page SEO metadata.** Title, description, keywords, robots, canonical (self-referencing by default), Open Graph,
  Twitter cards and custom meta tags, cascading page, then site, then domain defaults.
- **JSON-LD.** WebSite and BreadcrumbList on every page, FAQPage derived from FAQ blocks, plus any schema.org entries the
  page declares. A schema generator for articles, local businesses, products, how-tos and more is included as a library.
- **sitemap.xml, robots.txt, llms.txt** per site, leaving out drafts and `noindex` pages.
- **Static export.** Every published page plus its assets, ready for any static host.
- **SEO audit.** For one page or a whole site from its sitemap: six weighted pillars (answer, authority, readability,
  structure, conversion, technical) with every deduction explained, nearly 300 measured datapoints, technical head checks,
  an internal link graph with orphan detection, and optional outbound link checking. Works on local pages and public
  URLs, from the dashboard or the command line.
- **Minimal editor.** Edit page settings, SEO fields and block JSON with a live preview, saved to the site's files.

## Built with

Next.js 14 (App Router), React 18, TypeScript, Sass, cheerio and html-to-react. Tests run on Vitest. Storage is plain
JSON files.

## Requirements

- Node.js 20 or newer (`.nvmrc` pins 22) and pnpm

## Run it

```sh
pnpm install
pnpm dev              # http://localhost:3000
```

The dashboard at `http://localhost:3000` lists the sample sites. Each site is served at its own local host, so
root-relative links work as they will in production:

- http://juniper-bakery.localhost:3000 — a made-up neighborhood bakery, with a long-form guide page
- http://brightline-gutters.localhost:3000 — a made-up local service business, with a service-in-a-city page

(Browsers resolve any `*.localhost` name to your machine. Every page is also reachable at `/sites/<site>/<slug>`.)

Other commands:

```sh
pnpm test             # unit tests (no network)
pnpm typecheck
pnpm build && pnpm start          # production server
pnpm export                       # with the server running: writes export/<site>/
pnpm audit https://example.com/some-page --keyword="target phrase"
pnpm audit --site=http://localhost:3000/sites/juniper-bakery --mirror
```

`.env.example` lists the optional settings. None are needed for the defaults.

## Your own site

Copy `data/sites/juniper-bakery` to `data/sites/<your-site>`, edit `site.json` (set `domain` to the public domain), put
images in `public/media/<your-site>/` and list them in `media.json` with their real pixel dimensions, then edit pages in
the dashboard editor or as files. A page is published when its `status` is `published`.

## How it works

```
data/sites/<site>/        site.json · media.json · pages/*.json
        │
middleware.ts             <site>.localhost/<path>  →  /sites/<site>/<path>
        │
app/(site)/sites/[site]/  layout (theme CSS variables, fonts, <html lang>)
        │                 [[...slug]] page: metadata + JSON-LD + RenderBlocks
        │                 sitemap.xml · robots.txt · llms.txt
app/user-website/         blocks, header/footer, render settings, contrast helpers
app/lib/seo/              measure/ (HTML → document → datapoints), pageScore, readability,
                          keyword variants, local-page rules, audit, site files
app/(dashboard)/          sites list, SEO audit, editor
scripts/                  export.ts, audit.ts
```

## Contributing

Issues and pull requests are welcome. Run `pnpm typecheck` and `pnpm test` before opening a PR. [CLAUDE.md](CLAUDE.md)
covers the conventions and doubles as the guide for AI agents working on this repo.

## License

[MIT](LICENSE) © 2026 The Software Society
