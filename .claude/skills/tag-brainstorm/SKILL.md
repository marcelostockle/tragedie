---
name: tag-brainstorm
description: Brainstorm and draft new tags for this music library's vocabulary with the owner: work out what a tag means, where it belongs, how it differs from existing tags, and write it as validated tag files (definition, relations, notes, examples). Use when the user wants to figure out, define, split, or add a tag or a facet's worth of tags.
---

# Tag brainstorming

You help the owner turn a fuzzy musical idea into a **well-defined tag**: a concept with a
written definition, relations to other tags, and examples. The owner decides what the
vocabulary is. Your job is to ask the sharp questions, catch collisions, and write clean
files once they have decided.

## First, load the live context (do not rely on memory)

The schema and vocabulary change. Read them fresh each time:

1. `packages/schema/src/tag.ts`, `ids.ts` and `locale.ts`: the tag shape, id rule, relation
   types, and which locales exist (source locale is required, others optional).
2. `npm run vocab` (or `npm run vocab -- --facet <id>`): facets and every existing tag with
   its definition, relations and usage. Check this for overlaps *before* proposing anything.
3. `manifest.md` §3 and §5 if you need the reasoning behind the model.

## What a good tag is

- **A concept, not a word.** The same word in two facets is two tags (`warm.timbre`,
  `warm.harmony`), each with its own definition, linked with the same `sameWord` value.
  Never merge homonyms to save a tag, and never reuse a tag across facets.
- **Exactly one facet.** Facets are aspects of a song being described. If a candidate fits
  two facets, it is probably two concepts, or a combination of existing tags (see genres).
- **Defined by what it is *and what it isn't*.** The definition is 1–2 sentences. The "isn't"
  half is what separates it from its neighbours.
- **Genres stay a small closed set.** Everything else should be expressed as a combination of
  rhythm, instrumentation, timbre, mood and so on. If the user proposes a narrow genre, ask
  whether it is really a combination, and say which tags would express it.
- **Examples are part of the definition**, but see "What you cannot know" below.

## How to work with the owner

1. **Restate the idea in one line** and ask what it is for: what listening difference should
   this tag capture? One focused question at a time, not a questionnaire.
2. **Check collisions** against `npm run vocab`: same name elsewhere (homonym, so a different
   concept, so a separate tag plus `sameWord`), near-synonym (merge or sharpen), or a broader or
   narrower neighbour (relation).
3. **Probe the boundary.** Offer 2–3 borderline cases and ask which side they fall on. That
   answer is usually the "what it isn't" half of the definition.
4. **Propose the facet and the relations**, naming the existing tags involved. Relation types
   are the ones in `tag.ts` (`contrasts`, `often-with`, `broader`, `narrower`,
   `not-to-be-confused-with`). Relations point at tags that already exist, so a tag you are
   proposing in the same batch needs to be written first, or add the edge on the second pass.
5. **Draft**, show it in the chat in the final file layout, and wait for approval. Revise
   until the owner is happy. Do not write files before approval.

If the owner is vague, offer a concrete first draft to react to rather than more questions.
If several tags come up, handle them one at a time and keep a short running list of the
others, so none are lost.

## What you cannot know

You cannot hear tracks. The track files contain only metadata and ratings, so **never claim a
track exemplifies a tag on your own**, and never infer from artist or title. Examples are the
owner's judgement. You may help *find* candidates by searching `content/tracks/*.json` by
title or artist when the owner names them, then ask them to confirm. Leave `examples` empty
rather than guess, and tell the owner it is still to do.

Do not use the old project's tags or its `track-tags.json` as input or inspiration. The
vocabulary is being rebuilt from scratch on purpose.

## Writing the files

Only after the owner approves. For a tag with id `<id>`, create:

- `content/tags/<id>/tag.json` with `id`, `facet`, optional `sameWord`, `examples`, `related`
  (shape per `tag.ts`; the directory name must equal the id)
- `content/tags/<id>/<locale>.md` for the source locale, and for other locales only if the
  owner wants a draft translation. Format:

  ```
  ---
  name: "Warm"
  definition: "One or two sentences: what it is, and what it is not."
  ---
  Optional longer notes in markdown.
  ```

  `name` and `definition` are single-line JSON strings (escape quotes as `\"`). Everything
  after the second `---` is the notes body.

**Ids:** follow the pattern of existing tags (the admin suggests `<slug-of-name>.<facet>`,
for example `warm.timbre`). The scheme is still preliminary, so if you are unsure, ask. An id
never changes after tracks reference it.

**Translations:** the source locale is required. If you draft another locale, say so, and keep
it a faithful rendering of the definition rather than an adaptation.

## Then verify

Run `npm run validate` and fix every reported issue. It checks the facet exists, a
source-locale definition is present, names do not clash within a facet, related tags and
example tracks exist, and the shape. Finish by reporting which tags you wrote, what is
still missing (examples, translations, relations to tags that do not exist yet), and any
open question you left for the owner.

## Boundaries

- Do not edit existing tags unless asked. Renaming, merging and deprecating are the owner's
  call, and an id change is not allowed once tracks use it.
- Do not edit tracks, facets, dimensions or the schema. If a facet seems wrong or missing,
  say so and let the owner decide.
- Do not commit or push unless asked.
