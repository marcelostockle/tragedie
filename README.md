# tragedie

A personal music library: tracks from YouTube, rated on five dimensions and described by a
vocabulary of **tags that are concepts with definitions**. This repo holds the content, a
local admin for editing it, and the schema that keeps both honest. A public static site
will come later.

`manifest.md` is the design document: why things are the way they are, what is decided, what
is open, and what is built. Read it before changing the content model.

## Setup

Needs Node 24 and npm (workspaces). No other tools.

```sh
npm install
npm run admin      # then open http://127.0.0.1:5173
```

## Scripts

Run these from the repo root.

| Command | What it does |
|---|---|
| `npm run admin` | Starts the local admin: a Hono API on `127.0.0.1:5174` and the Svelte UI on `127.0.0.1:5173` (the UI proxies `/api`). Never deployed. |
| `npm run site` | Starts the public site in dev mode (Astro) on `127.0.0.1:4321`. Content is read when the server starts, so restart it after editing content. |
| `npm run build` | Builds the public site to `apps/site/dist`. Validates the content first, so invalid content fails the build. |
| `npm run validate` | Loads everything in `content/` and checks the shape and every cross-reference. Exits non-zero on any issue. |
| `npm run vocab` | Prints the facets and every tag with its definition, relations and usage. Add `-- --facet <id>` for one facet, or `-- --json`. |
| `npm run typecheck` | Type-checks the schema package and the admin (server and Svelte). |
| `npm test` | Unit tests for the schema package and the admin API. |
| `npm run ci` | Typecheck, tests, validate, then the site build. This is what GitHub Actions runs on every push. |

Package-level scripts, run with `npm run <name> -w <workspace>`:

| Workspace | Script | What it does |
|---|---|---|
| `@tragedie/schema` | `migrate-tracks` | One-off import of the old project's `tracks.json` into `content/tracks/`. Takes the file path after `--`. It regenerates the track files from the source, so it overwrites edits made in the admin. Don't re-run it. |
| `@tragedie/admin` | `dev:api`, `dev:ui` | The two halves of `npm run admin`, separately. |

Environment variables for the admin API: `CONTENT_DIR` (default `content/`) and `PORT`
(default `5174`). Point `CONTENT_DIR` at a copy to experiment without touching the real data.

## Layout

```
packages/schema   zod schemas, locale config, YouTube URL cleaning, content loader, validator, CLIs
apps/admin        local-only admin: Hono API (server/) and Svelte 5 UI (src/)
apps/site         public static site: Astro, with Svelte islands for interactive parts
content/          the data, plain files in git
  tracks/<videoId>.json        one file per track
  tags/<tag-id>/tag.json       facet, relations, examples
  tags/<tag-id>/<locale>.md    name, definition and notes per locale
  facets.json                  facet registry
  dimensions.json              rating dimensions
.claude/skills/   Claude Code skills for this project
```

Tag ids are `<slug>.<facet>`, for example `warm.timbre`. Locales are `en` (source, required)
and `es`; they are defined in `packages/schema/src/locale.ts`.

## Working on content

- **Edit in the admin.** Every save is validated against the schema, cross-references
  included, and written to that entity's own file. Rejected saves leave files untouched.
- **The server keeps the content in memory.** Reloading the page re-reads from disk, so after
  changing files by hand or pulling from git, reload the page.
- **Git is the safety net.** Content is committed like code. `npm run validate` is the check
  to run before pushing.

## Public site

`apps/site` is fully static: `/en/…` and `/es/…` routes (the root forwards to `/en/`), a page per
tag and locale, and a library view that reads `/data/tracks.json` and `/data/<locale>.json` in
the browser. There are no per-track pages. The tag id is the URL slug, for example
`/en/tags/warm.mood/`.

Interface text lives in `apps/site/src/i18n/strings.ts`. `en` is the source and the other locales
are typed against it, so a missing translation fails the type check. Tag, facet and dimension
text comes from `content/`, falling back to the source locale field by field.

The library's tag filter and hover panel are only interesting once tracks carry tags, so tag a few
in the admin before judging them.

**Deploying to Cloudflare** (Pages, connected to this repo). These settings follow from how the
project is built, but the deploy has not been tried yet:

| Setting | Value |
|---|---|
| Build command | `npm ci && npm run build` |
| Build output directory | `apps/site/dist` |
| Environment variable | `NODE_VERSION=24` |

Deploying is then a `git push`. If the build fails with content errors, run `npm run validate`
locally to see them.

## Skills

Project skills live in `.claude/skills/` and are picked up automatically by Claude Code
when it runs in this repo.

### `tag-brainstorm`

Helps work out a new tag with you: what the concept is, which facet it belongs to, how it
differs from existing tags (including same-word tags in other facets), and how it relates
to them. It then writes the tag files and runs `npm run validate`.

Start it by asking in a Claude Code session, for example *"brainstorm a tag for ..."*, or by
typing `/tag-brainstorm`. It reads the live schema and `npm run vocab` each time, so it
follows changes to either. It asks before writing, and it won't pick example tracks on its
own since it can't hear them.
