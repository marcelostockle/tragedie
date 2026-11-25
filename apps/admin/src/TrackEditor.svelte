<script lang="ts">
  import type { Dimension, Track } from "@tragedie/schema";

  let {
    track,
    dimensions,
    onSave,
  }: { track: Track; dimensions: Dimension[]; onSave: (t: Track) => Promise<void> } = $props();

  const splitArtists = (s: string) => s.split(";").map((a) => a.trim()).filter(Boolean);

  // Local draft, reset when the parent re-keys this component for another track.
  // svelte-ignore state_referenced_locally
  let draft = $state<Track>(structuredClone($state.snapshot(track)));
  // svelte-ignore state_referenced_locally
  let artists = $state(track.artists.join("; "));
  let message = $state("");
  let saving = $state(false);

  const dirty = $derived(
    JSON.stringify({ ...draft, artists: splitArtists(artists) }) !== JSON.stringify(track),
  );

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
    <legend>Ratings (1–10, blank = unrated)</legend>
    {#each dimensions as d (d.id)}
      <label class="row">
        <span class="dim">{d.name.en}</span>
        <input
          type="number" min="1" max="10" step="1"
          value={draft.ratings[d.id] ?? ""}
          oninput={(e) => setRating(d.id, e.currentTarget.value)}
        />
      </label>
    {/each}
  </fieldset>

  <p class="hint">Tags: {draft.tags.length ? draft.tags.join(", ") : "none"} (tag editing comes with the tag registry)</p>

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
</style>
