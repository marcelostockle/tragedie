# Project manifest: personal music library, static site + local admin

> Handoff document for a fresh repo. Written 2026-11-24 from the `res-mantra`
> repo (`mantra-cn`), specifically its `◎ Tracks & Tags` view
> (`src/components/embed/TrackTagsTab.vue`). Treat the old repo as a **read-only
> reference**. Nothing from it is copied wholesale except the three things
> listed under "Carried over".
>
> Items marked **[DECIDE]** are open. Everything else is settled.

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
   both. Consider also stripping `list`, `index`, `t`, `feature`, `utm_*` **[DECIDE: only
   if that doesn't lose intended timestamps]**. Do it once, at import/edit time, in a shared
   function. Never at render time.

   **Decided:** keep only `v`; strip every other param. No exceptions in the cleaner. (A
   very niche case, unofficial single-track albums with no alternative link, may need a
   per-track override later. Don't design for it now.)

Also worth keeping from the old UX: the `pinned` flag on tracks, `lastUpdated`
timestamps, and the filter-by-tag and sort-by-dimension ideas.

## 5. Content model (proposal, validate in phase 0)

Source of truth is **plain files in git**, validated by one shared schema package.

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
  "tags": ["<tag-id>", "..."], "ratings": {"cadence": 7, "...": 3},
  "pinned": false, "lastUpdated": "ISO-8601" }
```
Track metadata (title, artist) is **not translated**. It's data, not copy.

**Tag** (a *concept*)
- `id`: stable slug that is unique across the whole vocabulary, and includes the facet when
  the word is ambiguous (`warm.timbre`, `warm.harmony`, `warm.vocal`). The id never changes
  once tracks reference it. **Preliminary:** the exact scheme, and how it maps to URL
  slugs (§7 uses `warm-timbre`), is still to be worked out.
- `facet`: exactly one. Facets are *aspects of a song being described* (candidates: genre,
  rhythm, timbre, instrumentation, vocals, harmony, mood/feel, production). **[DECIDE the
  final facet list. This is the highest-leverage design decision, so do it by hand with
  the old 165 tags on the table.]**
- `sameWord`: optional group key linking homonyms, so the site can say "Warm also
  means…" and link across facets.
- Per locale: `name`, short `definition` (1–2 sentences, what it is *and what it isn't*),
  optional longer notes (markdown body).
- `examples`: list of `{trackId, note?, start?, end?}`. A good example is part of the definition.
- `related`: typed edges (`contrasts`, `often-with`, `broader`, `narrower`, `not-to-be-confused-with`).
  Keep it a simple list per tag. **No conceptual-map visualization.** It was judged too much.
- `status`: `draft | defined | deprecated`. **Tentative, not confirmed as needed.** If kept,
  the site only shows `defined` and admin shows a "needs a definition" queue. Drop it if it
  doesn't earn its place.

**Validation (build-time, fail the build)**: every referenced tag id exists; every tag has
a definition in the source locale; no two active tags share facet + name; every example
track exists; ratings are 1–5 integers on known dimensions; links are in cleaned form.

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
  tag pages (`/en/tags/warm-timbre`).
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
- **Admin: Vite + Vue 3** (already known from the old project), with a small local Node server
  (Hono or plain Vite middleware) that writes files in `content/`. **Don't copy the old
  pattern of whole-array PUT onto one big JSON file.** Write per-entity files and validate with
  the shared schema on every write.
- **Deploy is `git push`.** There's no CI test of "does admin work". CI only runs
  schema validation + site build.
- Admin UI library: PrimeVue worked in the old app. **[DECIDE]** whether to keep it.
- Assets: tag/track content needs no media hosting if rhythm examples are pattern data.
  If real audio clips are ever wanted, use R2 and mind copyright **[DECIDE later]**.
- **[DECIDE]** on the public site, embed YouTube players or link out only? This affects
  page weight and privacy.

## 9. Admin app: what it must do (phase 1)

1. Import tracks/playlists (§4.1), with a review report of skipped and empty-artist rows.
2. Track list: search, sort by dimension, filter tagged / untagged / pinned / by tag.
3. Track detail: edit metadata, tags (grouped by facet, each with a hover definition),
   and ratings.
4. **Tag registry editor**: create/edit concepts, write definitions per locale, attach
   examples, set related tags, flag homonym groups, and view "which tracks use this tag".
5. **Vocabulary maintenance**: rename, merge and deprecate tags, with track reassignment
   (the vocabulary will evolve, so ids must stay stable and changes must be safe). This is
   for the *new* vocabulary only. There is no old-tag migration (see §10).
6. Rhythm pattern editor with preview playback.
7. Queues: tags lacking a definition, missing translations, tracks lacking tags/ratings.
8. "Validate" and "Build preview" buttons that call the same checks CI will run.

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
- Write the migration as a one-off TypeScript script. Make it idempotent, and validate its
  output with the shared schema.
- Back up the old files before reading them from scripts. They're the only copy of the
  owner's hand-entered data.
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

0. **Bootstrap**: repo, TypeScript workspace, `packages/schema`, empty `content/`, CI validation. Settle the §5 [DECIDE]s
   (facets, locales, id scheme) before writing admin code.
1. **Admin + pipeline**: §9, plus the track migration script (§10). Done when the old tracks (untagged)
   live in `content/` and pass validation.
2. **Walking skeleton site**: a deliberately ugly Astro site that lists tracks and tag pages and
   deploys to Cloudflare. It exists only to prove edit → validate → build → deploy → visible online.
3. **Vocabulary pass**: build the tag vocabulary and re-tag tracks from zero; write definitions, examples and rhythm patterns (this is the real work and
   can overlap with phase 1 once the editor exists).
4. **Public app**: the exploratory UI. Design it fresh, after phases 1–3 show what the content looks like.

## 13. Open decisions, in one place

Settled since the first draft: locales (`en` source, `es`), URL param stripping (keep only
`v`), npm workspaces, genres as plain tags.

Future note: a Claude skill for brainstorming content-complete tags (definition,
relations, enriched content) will likely be built and run by separate agents. The tag
schema is the contract those agents write against, so keep it strict with clear errors.

- Facet list and tag id scheme (§5). **Do this first.**
- Tag id scheme and its mapping to URL slugs (§5, §7).
- Whether tag `status` is needed at all (§5).
- The genre tag set (§3.3). The owner's call; genres are plain tags in a `genre` facet.
- Rhythm pattern format (§6).
- Embed vs link-out for YouTube on the public site (§8).
- Keep PrimeVue in admin (§8).
