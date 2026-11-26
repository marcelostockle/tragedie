<script lang="ts">
  import type { Dimension, Facet, Track } from "@tragedie/schema/browser";
  import type { LoadedTag } from "./api";
  import { tagName, tagTitle } from "./tags";

  let {
    track,
    dimensions,
    tags,
    facets,
    onSave,
  }: {
    track: Track;
    dimensions: Dimension[];
    tags: LoadedTag[];
    facets: Facet[];
    onSave: (t: Track) => Promise<void>;
  } = $props();

  const splitArtists = (s: string) => s.split(";").map((a) => a.trim()).filter(Boolean);

  // Local draft, reset when the parent re-keys this component for another track.
  // svelte-ignore state_referenced_locally
  let draft = $state<Track>(structuredClone($state.snapshot(track)));
  // svelte-ignore state_referenced_locally
  let artists = $state(track.artists.join("; "));
  let tagQuery = $state("");
  let message = $state("");
  let saving = $state(false);

  const dirty = $derived(
    JSON.stringify({ ...draft, artists: splitArtists(artists) }) !== JSON.stringify(track),
  );

  const tagById = $derived(new Map(tags.map((t) => [t.file.id, t])));
  const chosenByFacet = $derived(
    facets
      .map((f) => ({
        facet: f,
        tags: draft.tags.map((id) => tagById.get(id)).filter((t): t is LoadedTag => !!t && t.file.facet === f.id),
      }))
      .filter((g) => g.tags.length),
  );
  const unknownTags = $derived(draft.tags.filter((id) => !tagById.has(id)));
  const tagMatches = $derived.by(() => {
    const q = tagQuery.trim().toLowerCase();
    if (!q) return [];
    return tags
      .filter((t) => !draft.tags.includes(t.file.id) && `${tagName(t)} ${t.file.id}`.toLowerCase().includes(q))
      .slice(0, 12);
  });
  const facetName = (id: string) => facets.find((f) => f.id === id)?.name.en ?? id;

  function addTag(id: string) {
    draft.tags = [...draft.tags, id];
    tagQuery = "";
  }
  const removeTag = (id: string) => (draft.tags = draft.tags.filter((x) => x !== id));

  function setRating(id: string, raw: string) {
    const next = { ...draft.ratings };
    if (raw === "") delete next[id];
    else next[id] = Number(raw);
    draft.ratings = next;
  }

  async function save() {
    saving = true;
    message = "";
    try {
      await onSave({ ...$state.snapshot(draft), artists: splitArtists(artists) });
      message = "Saved.";
    } catch (e) {
      message = (e as Error).message;
    } finally {
      saving = false;
    }
  }
</script>

<form onsubmit={(e) => { e.preventDefault(); save(); }}>
  <h2>{track.title}</h2>
  <p class="id">{track.id}{track.lastUpdated ? ` · updated ${track.lastUpdated}` : ""}</p>

  <label>Title <input bind:value={draft.title} required /></label>
  <label>Artists <small>(separate with ;)</small> <input bind:value={artists} /></label>
  <label>Album <input value={draft.album ?? ""} oninput={(e) => (draft.album = e.currentTarget.value || undefined)} /></label>
  <label>
    Link
    <span class="row">
      <input bind:value={draft.link} />
      <a href={draft.link} target="_blank" rel="noreferrer noopener">open</a>
    </span>
  </label>
  <label class="check"><input type="checkbox" bind:checked={draft.pinned} /> Pinned</label>

  <fieldset>
    <legend>Ratings (1–5, blank = unrated)</legend>
    {#each dimensions as d (d.id)}
      <label class="row">
        <span class="dim">{d.name.en}</span>
        <input
          type="number" min="1" max="5" step="1"
          value={draft.ratings[d.id] ?? ""}
          oninput={(e) => setRating(d.id, e.currentTarget.value)}
        />
      </label>
    {/each}
  </fieldset>

  <fieldset>
    <legend>Tags</legend>
    {#each chosenByFacet as g (g.facet.id)}
      <div class="chips">
        <span class="facet" title={g.facet.definition.en}>{g.facet.name.en}</span>
        {#each g.tags as t (t.file.id)}
          <button type="button" class="chip" title={tagTitle(t)} onclick={() => removeTag(t.file.id)}>{tagName(t)} ×</button>
        {/each}
      </div>
    {/each}
    {#each unknownTags as id (id)}
      <button type="button" class="chip bad" title="Unknown tag" onclick={() => removeTag(id)}>{id} ×</button>
    {/each}
    {#if draft.tags.length === 0}<span class="hint">No tags.</span>{/if}
    <input type="search" placeholder="Add a tag…" bind:value={tagQuery} />
    {#if tagMatches.length}
      <ul class="matches">
        {#each tagMatches as t (t.file.id)}
          <li><button type="button" title={tagTitle(t)} onclick={() => addTag(t.file.id)}>{tagName(t)} <small>{facetName(t.file.facet)}</small></button></li>
        {/each}
      </ul>
    {/if}
  </fieldset>

  <div class="row">
    <button type="submit" disabled={!dirty || saving}>{saving ? "Saving…" : "Save"}</button>
    {#if message}<span class="message">{message}</span>{/if}
  </div>
</form>

<style>
  form { display: grid; gap: 0.7rem; max-width: 40rem; }
  h2 { margin: 0; }
  .id { margin: 0; opacity: 0.6; font-size: 0.9em; }
  label { display: grid; gap: 0.2rem; }
  label.check, label.row { display: flex; align-items: center; gap: 0.5rem; }
  .row { display: flex; align-items: center; gap: 0.5rem; }
  .row input:not([type="number"]) { flex: 1; }
  .dim { width: 6rem; }
  input[type="number"] { width: 5rem; }
  fieldset { display: grid; gap: 0.4rem; }
  .hint { opacity: 0.6; margin: 0; }
  .message { white-space: pre-wrap; }
  .chips { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; }
  .facet { opacity: 0.6; font-size: 0.85em; min-width: 7rem; }
  .chip { border-radius: 1rem; padding: 0.1rem 0.6rem; cursor: pointer; }
  .chip.bad { color: crimson; }
  .matches { list-style: none; margin: 0; padding: 0; border: 1px solid color-mix(in srgb, currentColor 20%, transparent); }
  .matches button { all: unset; display: block; width: 100%; box-sizing: border-box; padding: 0.3rem 0.5rem; cursor: pointer; }
  .matches button:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
</style>
