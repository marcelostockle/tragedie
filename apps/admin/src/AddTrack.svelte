<script lang="ts">
  import type { Track } from "@tragedie/schema/browser";
  import { createTrack, lookupLink, type Lookup } from "./api";

  let { onCreated }: { onCreated: (t: Track) => void } = $props();

  let source = $state("");
  let link = $state("");
  let title = $state("");
  let artists = $state("");
  let album = $state("");

  let found = $state<Lookup | null>(null);
  let busy = $state(false);
  let error = $state("");

  const splitArtists = (s: string) => s.split(";").map((a) => a.trim()).filter(Boolean);
  const canCreate = $derived(!busy && link.trim() !== "" && title.trim() !== "");

  /** Fill empty fields only, so a second lookup never overwrites what was typed. */
  async function look() {
    if (!source.trim()) return;
    busy = true;
    error = "";
    try {
      const r = await lookupLink(source.trim());
      found = r;
      if (r.videoId && !link.trim()) link = source.trim();
      if (r.title && !title.trim()) title = r.title;
      if (r.artists.length && !artists.trim()) artists = r.artists.join("; ");
      if (r.album && !album.trim()) album = r.album;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }

  async function create() {
    busy = true;
    error = "";
    try {
      const t = await createTrack({
        link: link.trim(),
        title: title.trim(),
        artists: splitArtists(artists),
        ...(album.trim() ? { album: album.trim() } : {}),
      });
      onCreated(t);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<form onsubmit={(e) => { e.preventDefault(); void create(); }}>
  <h2>Add track</h2>

  <label>
    Look up from a link <small>(YouTube, YouTube Music or Spotify)</small>
    <span class="row">
      <input type="url" bind:value={source} placeholder="https://…" />
      <button type="button" onclick={look} disabled={busy || !source.trim()}>Look up</button>
    </span>
  </label>
  {#if found}
    <p class="hint">
      From {found.source === "youtube" ? "YouTube" : "Spotify"}:
      {[found.title, found.artists.join("; "), found.album, found.year].filter(Boolean).join(" · ")}
      {#if found.source === "spotify"}<br />Spotify has no video id: paste the YouTube link below.{/if}
    </p>
  {/if}

  <label>YouTube link <small>(sets the track's id)</small> <input type="url" bind:value={link} required /></label>
  <label>Title <input bind:value={title} required /></label>
  <label>Artists <small>(separate with ;)</small> <input bind:value={artists} /></label>
  <label>Album <input bind:value={album} /></label>

  {#if error}<p class="error">{error}</p>{/if}
  <div><button type="submit" disabled={!canCreate}>Create track</button></div>
</form>

<style>
  form { display: grid; gap: 0.8rem; max-width: 40rem; }
  label { display: grid; gap: 0.2rem; }
  .row { display: flex; gap: 0.4rem; }
  .row input { flex: 1; }
  .hint { margin: 0; opacity: 0.75; font-size: 0.9em; }
  .error { color: crimson; white-space: pre-wrap; margin: 0; }
</style>
