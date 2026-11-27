# Project manifest: personal music library, static site + local admin

> Handoff document for a fresh repo. Written 2026-11-24 from the `res-mantra`
> repo (`mantra-cn`), specifically its `◎ Tracks & Tags` view
> (`src/components/embed/TrackTagsTab.vue`). Treat the old repo as a **read-only
> reference**. Nothing from it is copied wholesale except the three things
> listed under "Carried over".
>
> Items marked **[DECIDE]** are open. Everything else is settled.

> **Status, 2026-11-27.** Phase 0 is done, phase 1 is partly done, and phase 2 (the public site's
> core) is built but not yet deployed. Exists: the schema package, the track migration (1,267
> tracks in `content/`), the admin's track and tag editors, the `tag-brainstorm` skill, and
> `apps/site` (i18n routes, tag pages, a library view with a hover/lock panel). The vocabulary
> pass (phase 3) is well under way: 14 facets and 240 tags, all defined in `en` and `es`, none
> yet applied to tracks. Still to build: import, vocabulary maintenance, queues, the rhythm
> pattern editor, and the deploy. See §12 for detail and §13 for what is still open. For how to
> run things, see `README.md`.

## 1. What this is

A personal, single-owner music library. Tracks come from YouTube/YouTube Music.
Each track gets multi-axis ratings and a set of tags. Tags are **concepts with
definitions**, not just labels. The public site is exploratory: browse by tag,
read what a tag means, hear examples, and find tracks that share qualities.

Not a product. There are no users, no accounts, no comments and no wide appeal.
Optimize for the owner's long-term maintainability and for the tag vocabulary
being *right*.

## 2. Scope changes vs. the old project

| Old | New |
|---|---|
| Local-only Vite dev server with write middleware on real data files | **Deployed online (Cloudflare)** as a static site |
| One app does editing + viewing | **Two apps**: a hidden local admin, and a public read-only site |
| Content = flat files edited live | Content = files in git, edited by admin, deployed by push |
| English only | **i18n from day one** |
| Tags = name + category | Tags = concept with definition, examples, relations |
| UI built around editing | Admin ≈ the old UI's spirit. Public app is a fresh, exploratory design |

**Order of work: admin and content pipeline first.** Don't build the public app
until the pipeline (import → edit → validate → build → deploy) runs end to end.

Content is 100% static. There is no runtime backend, database or auth on the
public side.

## 3. Lessons from the failed attempt (the actual reason for the rewrite)

Observed in the old data (`track-tags.json`: 165 tags across 8 categories;
`tracks.json`: 1,267 tracks, ~1,200 tagged, ~910 rated):

1. **Tags were fuzzy and defined only in the owner's head.** No definitions
   existed anywhere. Fix: every tag has a written definition and examples, and
   gets its own detail page.
2. **Homonyms collapsed into one tag.** The same word was reused for different
   things:
   - `Ethnic` exists in Instruments, Vocals *and* Percussion.
   - `Dist` exists in Bass *and* Guitar.
   - `Sample` (Percussion) vs `Samples` (Vocals), `Synth` (Bass) vs `Synth (light/heavy)` (Sound).
   - Mood words like `Warm`, `Playful` and `Soft` mean different things depending on
     whether you describe timbre, harmony, vocal delivery or feel.
   Fix: a tag is identified by **concept, not word**. The same word in two facets is two
   tags, each with its own definition. See §5.
3. **Genre tags sprawled.** The Style category has ~40 entries: Rock, Jazz, Bossa,
   Future bossa, Vaporwave, Dembow and so on. Many are really combinations of rhythm,
   instrumentation and mood. Fix: a **small closed set of generic genres**. Everything
   else is expressed as a combination of other tags.
4. **Rhythm was under-described.** Percussion has 12 tags, Style mixes rhythm feels
   (Swing, Clave, Polyrhythm, Waltz) with genres. Fix: a proper **Rhythm** facet, with
   **playable examples** (§6).

## 4. Carried over, unchanged in intent

1. **Import playlists and tracks.**
   - Old: `scripts/import_tracks.py` auto-detects 3 formats and merges by id
     (`ytmusic` export, Google Takeout CSV, and a 3rd-party scraper JSON). The
     scraper format recovers artist and album by parsing YouTube's auto-generated
     credit block in `Description` (`Title · Artist · Artist`, album line,
     `℗ year label`).
   - **The Takeout path was never tested against a real file.** Expect to fix its
     header aliases.
   - Single-track add: oEmbed lookup (`youtube.com/oembed`). "- Topic" channels become the
     artist. Result is `{id: "yt:<videoId>", title, artists, album, link}`.
   - Track identity = `yt:<videoId>`. Keep it. Merge by id, never duplicate.
   - **Base requirement: everything is TypeScript.** Port the importer; no Python in the new repo.
2. **Multi-pronged rating.** Five dimensions, each an integer 1–5 (migrated from the old 1–10 scale, see §10), stored as
   `ratings: {cadence, richness, bass, mix, feeling}`. Dimension keys are stable ids, and
   renaming a key orphans stored ratings. In the new project dimensions are data
   (id + localized name + localized definition), because the ambiguity lesson applies to
   them too. Old source: `src/lib/dimensions.js`.
3. **URL cleaning.** Old `stripSiParam` removes the `si` tracking param. The server side
   also canonicalizes any YouTube URL to `https://www.youtube.com/watch?v=<id>`. Keep
   both. Do it once, at import/edit time, in a shared function (`cleanYoutubeUrl` in
   `packages/schema`). Never at render time.

   **Decided:** keep only `v`; strip every other param. No exceptions in the cleaner. (A
   very niche case, unofficial single-track albums with no alternative link, may need a
   per-track override later. Don't design for it now.)

   **Link and id are independent.** The id is the stable identity from the original import.
   Uploads get taken down and re-uploaded, so a track's link may point at a different video
   than its id (26 migrated tracks do). The link only has to be in cleaned form.

Also worth keeping from the old UX: the `pinned` flag on tracks, `lastUpdated`
timestamps, and the filter-by-tag and sort-by-dimension ideas.

## 5. Content model (implemented in `packages/schema`)

Source of truth is **plain files in git**, validated by one shared schema package. The
zod schemas and `npm run validate` are the authority. This section describes intent.

```
content/
  tracks/<videoId>.json          # one file per track (clean diffs, no 640 KB blob)
  tags/<tag-id>/tag.json         # structure: facet, relations, examples
  tags/<tag-id>/<locale>.md      # prose: name + definition per locale
  facets.json                    # facet registry (+ localized names/definitions)
  dimensions.json                # rating dimensions (+ localized names/definitions)
```

Genres are ordinary tags in a `genre` facet. There is no separate genre file.

**Track**
```jsonc
{ "id": "yt:0-jvmh_lMXI", "title": "...", "artists": ["..."], "album": "...",
  "link": "https://www.youtube.com/watch?v=...",   // cleaned (§4.3)
  "tags": ["<tag-id>", "..."], "ratings": {"cadence": 4, "...": 2},
  "pinned": false, "lastUpdated": "ISO-8601" }
```
Track metadata (title, artist) is **not translated**. It's data, not copy.

Ratings may be partial (a missing dimension means unrated). `album` and `lastUpdated` are
optional: a few migrated tracks never had a `lastUpdated`. The admin server stamps it on save.

**Tag** (a *concept*)
- `id`: stable slug that is unique across the whole vocabulary. In practice every tag uses
  `<slug>.<facet>` (`warm.timbre`, `acid-bass.bass`), so a homonym in another facet gets a
  different id for free. The id never changes once tracks reference it. The slug rule lives
  in one place (`ids.ts`). **Decided:** the id is the URL slug (`/en/tags/warm.timbre/`), so
  there is nothing to map or keep in sync.
- `facet`: exactly one. Facets are *aspects of a song being described*. **Decided, 14
  facets:** genre, rhythm, percussion, harmony, instrumentation, strings, bass, winds, keys,
  synth, vocals, mood, production, form. The instrument families (strings, bass, winds,
  keys, synth, percussion) each own the sound and technique of their instruments, and the
  bass facet is defined by role, so a bass line belongs there whatever plays it. A `timbre`
  facet was tried and dropped. Each facet's definition says what it covers and what it
  doesn't; those definitions, in `content/facets.json`, are the authority.
- `sameWord`: optional group key linking homonyms, so the site can say "Warm also
  means…" and link across facets.
- Per locale: `name`, short `definition` (1–2 sentences, what it is *and what it isn't*),
  optional longer notes (markdown body).
- `examples`: list of `{trackId, note?, start?, end?}`. A good example is part of the definition.
- `related`: typed edges (`contrasts`, `often-with`, `broader`, `narrower`, `not-to-be-confused-with`).
  Keep it a simple list per tag. **No conceptual-map visualization.** It was judged too much.
- `status` (`draft | defined | deprecated`): **not in the schema.** Every tag is required
  to have a definition, so nothing is ever a draft. Revisit if deprecation is needed, as
  part of vocabulary maintenance (§9.5).

**Validation (build-time, fails the build; `npm run validate`)**: every referenced tag id
exists; every tag has a definition in the source locale; no two tags share facet + name;
every example track and related tag exists; a tag does not relate to itself; the facet
exists; ratings are 1–5 integers on known dimensions; links are in cleaned form; file and
directory names match ids.

## 6. Rhythm facet and playable examples

- Expand rhythm well past the old `Swing, Clave, Waltz, Polyrhythm, Linear pattern, Ostinato,
  Bossa, Afrobeat, Dembow, Polka…` set, and split *feel* from *genre*.
- **Playable example = pattern data, rendered in the browser** (a step/grid pattern + tempo
  played with WebAudio) rather than audio files. Reasons: no copyright problem from hosting
  clips of other people's recordings, tiny payload, trivially static, and the notation
  doubles as documentation.
- Optionally pair each pattern with a real track example (YouTube timestamp range) for the
  "here it is in the wild" half.
- **[DECIDE]** pattern format: custom JSON grid vs MIDI-like events. Start with the
  simplest thing that can express clave, swing subdivision and polyrhythm.

## 7. i18n

- Applies to **all public copy**: tag/facet/dimension names and definitions, UI strings,
  site chrome. It does not apply to track/artist metadata.
- The admin UI itself can stay single-language. It's private.
- One **source locale** is authoritative. Other locales may lag. The site falls back to the
  source locale per field, and the admin shows a "missing translation" queue per locale.
- Locale-prefixed routes (`/en/…`, `/es/…`), with locale-independent stable ids in URLs for
  tag pages (`/en/tags/warm.timbre/`).
- **Decided:** locales are `en` (source) and `es`. They are encoded in the schema as a
  `LOCALES` const, with `Locale` derived from it and a `SOURCE_LOCALE` beside it. Adding a
  locale is a one-line change and the compiler flags everything that needs updating.

## 8. Proposed stack (recommendation, not gospel)

Monorepo, TypeScript throughout, using **npm workspaces** (this machine runs npm; pnpm is
not required):

```
packages/schema   zod schemas + shared helpers (URL cleaning, id rules, validation)
apps/admin        LOCAL ONLY. Never deployed. Reads/writes content/ on disk.
apps/site         Public static site → Cloudflare
content/          the data (§5)
```

- **Site: Astro**, static output. It has content collections (typed, schema-validated
  files), first-class i18n routing, and zero JS by default with islands for the interactive bits
  (filters, rhythm player). Deploy to **Cloudflare** (Pages or Workers static assets) from
  git push. Search and filter: prebuilt JSON index or Pagefind, all client-side.
- **Admin: Svelte 5 + Vite** (a light SPA, no component library, plain CSS), with a small local
  **Hono** server that reads and writes `content/`. **Decided and built.** It writes
  per-entity files, never a whole-array PUT onto one big file, and validates each write with
  the shared schema, cross-references included. The server binds to loopback only and caches
  the loaded content in memory (a full load takes about a second here); a page load re-reads
  from disk. Vue and PrimeVue were considered and dropped.
- **Deploy is `git push`.** There's no CI test of "does admin work" in a browser. CI runs
  typecheck, the unit tests (schema and the admin API) and content validation. The site build
  joins it when the site exists.
- Assets: tag/track content needs no media hosting if rhythm examples are pattern data.
  If real audio clips are ever wanted, use R2 and mind copyright **[DECIDE later]**.
- **[DECIDE]** on the public site, embed YouTube players or link out only? This affects
  page weight and privacy.

## 9. Admin app: what it must do (phase 1)

Status in brackets.

1. Import tracks/playlists (§4.1), with a review report of skipped and empty-artist rows.
   **[not built]**
2. Track list: search, sort by dimension, filter tagged / untagged / pinned / by tag.
   **[built, except filtering by a specific tag.]** "Unrated" means any dimension is missing.
3. Track detail: edit metadata, tags (grouped by facet, each with a hover definition),
   and ratings. **[built]**
4. **Tag registry editor**: create/edit concepts, write definitions per locale, attach
   examples, set related tags, flag homonym groups, and view "which tracks use this tag".
   **[built]** Tags can be created in the editor by hand; the `tag-brainstorm` skill is for
   working out new ones with the owner.
5. **Vocabulary maintenance**: rename, merge and deprecate tags, with track reassignment
   (the vocabulary will evolve, so ids must stay stable and changes must be safe). This is
   for the *new* vocabulary only. There is no old-tag migration (see §10). **[not built]**
   Until it exists the editor refuses id changes, and there is no delete.
6. Rhythm pattern editor with preview playback. **[not built]**
7. Queues: tags lacking a definition, missing translations, tracks lacking tags/ratings.
   **[partly built]** The Tags view filters "missing a translation" and "not used by any
   track"; the track list filters untagged and unrated. A "needs a definition" queue is moot
   because validation requires one.
8. "Validate" and "Build preview" buttons that call the same checks CI will run.
   **[not built]** `npm run validate` does the validation from the command line.

## 10. Migrating the old data

**Tracks migrate. Tags and taggings do not.** The vocabulary and every track-to-tag
assignment are reworked from scratch under the new model. No old tag key, tag name or
tagging is imported, mapped or used as a hint. Don't build a mapping table or a review
queue for old tags.

From `res-mantra/tracks.json`, carry over only:
`id`, `title`, `artists`, `album`, `link` (re-run through URL cleaning), `pinned`,
`ratings`, `lastUpdated`. **Drop the `tags` field.**

- Ratings stay valid because the five dimension keys are unchanged (§4.2). Keep them
  unless the dimensions are redefined, in which case decide per dimension.
- **Rating scale 1–10 → 1–5, decided and applied:** `max(1, floor(v / 2))`, so 1→1, 2–3→1,
  4–5→2, 6–7→3, 8–9→4, 10→5. A `0` in the old data meant "unset" and is dropped.
- Write the migration as a one-off TypeScript script. Make it idempotent, and validate its
  output with the shared schema. **Done:** `packages/schema/src/cli/migrate-tracks.ts`, run
  as `npm run migrate-tracks -w @tragedie/schema -- <path to tracks.json>`. It never writes
  to the source and regenerates `content/tracks/`, so **don't run it again** over tracks you
  have edited in the admin: it would overwrite those edits.
- Back up the old files before reading them from scripts. They're the only copy of the
  owner's hand-entered data. (A copy was taken into the git-ignored `.backup/`.)
- Optional: keep the old `track-tags.json` in an archive folder as a personal reference
  while writing the new vocabulary. It is not an input to any tool.

## 11. Explicitly not carried over

- The whole Mandarin lookup app and progress tracker.
- **Artist Hubs** (`artists.json`): out of scope, decided. It's easy to layer on top of the
  track data later, so don't design for it now.
- **Old tags and taggings** (§10).
- The dormant embedding/metric-learning subproject (`judgments.jsonl`, `embeddings/`,
  `scripts/train_embedding.py`, `pca.js`, Label/Explore/Methodology tabs). Discontinued.
- Vite write-middleware on real data files, and the "no live testing on real data" rule
  built around it. In the new repo the data is in git, so the safety net is `git`.
- The old UI (PrimeVue DataTable + detail panel layout). Reuse its *capabilities*, not its layout.

## 12. Phases

0. **Bootstrap** *(done)*: repo, TypeScript workspace, `packages/schema`, `content/`, CI validation.
   Locales, the URL rule and the facet list are settled (§5, §7).
1. **Admin + pipeline** *(partly done)*: §9, plus the track migration script (§10). The migration is
   done: the old tracks (untagged) live in `content/` and pass validation. Left: import, vocabulary
   maintenance, the rhythm pattern editor, the validate and build buttons.
2. **Public site core** *(built, not deployed)*: the parts any public design needs, in a rough
   look. There are **no per-track pages**: tracks are data that a browsing widget reads, and
   only tags get static pages. Built in `apps/site`:
   - **i18n and layout:** `/en/…` and `/es/…` routes (`/` forwards to the source locale), a
     header with navigation and a language switch, and typed UI strings where a missing
     translation is a compile error.
   - **Data:** `buildPublicData` (in `packages/schema`) turns content into one shared
     `data/tracks.json` (about 300 KB, 69 KB gzipped) and a `data/<locale>.json` dictionary per
     locale. Names and definitions fall back to the source locale field by field. Content is
     validated when the site builds, so invalid content fails the build.
   - **Tag pages:** an index by facet and one static page per tag and locale, with the
     definition, notes (markdown), typed related tags, same-word siblings, examples, and the
     tracks that carry it.
   - **Library view:** search, filter by tag, sort by dimension, and a side panel that previews
     on hover and locks on click, showing the track's tags and a rating polygon (one axis per
     dimension, unrated dimensions left as gaps, never plotted as 0). On narrow screens the panel
     is a bottom sheet that opens on lock, because touch has no hover.
   - **Left to do:** the Cloudflare deploy (see `README.md`), then check it online.
   The map idea below is deliberately not part of this.
3. **Vocabulary pass** *(in progress)*: build the tag vocabulary and re-tag tracks from zero; write
   definitions, examples and rhythm patterns (this is the real work and can overlap with phase 1).
   Done so far: 14 facets and 240 tags with `en` and `es` definitions and relations. Not done:
   tagging tracks, examples (none yet), rhythm patterns. The `tag-brainstorm` skill supports this.
4. **Public app** *(not started)*: the exploratory UI. Design it fresh, after phases 1–3 show what
   the content looks like. It builds on phase 2's pages and data. One option under
   consideration, **not decided**: a tag relationship map. Tags sit grouped by facet; selecting
   one filters the map and draws rays to tags that co-occur with it, and any multi-selection
   becomes a track search. Notes if it is built: a pre-baked pairwise matrix is not enough,
   because multi-select needs conditional counts, so ship an inverted index (tag → track ids)
   and compute live (1,267 tracks is tiny). Use a normalised measure (Jaccard or lift, with a
   minimum count) for the rays, since raw counts make popular tags look bonded to everything.
   Draw rays only from selected tags to keep it from becoming a hairball, and keep a list
   fallback for small screens. It only becomes useful once tracks are tagged. This reverses
   the earlier "no conceptual-map visualization" call (§5), which was about the curated
   `related` edges, so confirm before building.

## 13. Open decisions, in one place

Settled since the first draft: locales (`en` source, `es`), URL param stripping (keep only
`v`), link independent of id, npm workspaces, genres as plain tags (no genre file), the 14
facets, ids as `<slug>.<facet>`, the 1–5 rating scale, Svelte 5 + Hono for the admin (no
PrimeVue), no tag `status` for now, the tag id as the URL slug, and no per-track pages
(tracks are data for a widget; only tags get static pages).

The `tag-brainstorm` skill (`.claude/skills/tag-brainstorm/`) is built, for drafting tags with
the owner or in separate agent sessions. The tag schema is the contract it writes against,
so keep that strict and its errors clear.

Still open:

- Whether to build the tag relationship map (§12.4).
- Whether tags ever need deprecating, and so whether `status` or a separate mechanism is
  needed. Decide with vocabulary maintenance (§9.5).
- The final genre tag set (§3.3). The owner's call, and the vocabulary pass is where it settles.
- Rhythm pattern format (§6).
- Embed vs link-out for YouTube on the public site (§8). For now the site links out.
