<script lang="ts">
  import type { Track } from "@tragedie/schema";
  import { loadAll, saveTrack, type Loaded } from "./api";
  import TrackEditor from "./TrackEditor.svelte";

  let data = $state<Loaded | null>(null);
  let error = $state("");
  let selectedId = $state<string | null>(null);

  let query = $state("");
  let show = $state<"all" | "untagged" | "unrated" | "pinned">("all");
  let sortBy = $state<string>("title");

  loadAll().then((d) => (data = d), (e) => (error = String(e)));

  const dims = $derived(data?.dimensions ?? []);

  const rows = $derived.by(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    let list = data.tracks.filter((t) => {
      if (q && !`${t.title} ${t.artists.join(" ")} ${t.album ?? ""}`.toLowerCase().includes(q)) return false;
      if (show === "untagged") return t.tags.length === 0;
      if (show === "unrated") return Object.keys(t.ratings).length === 0;
      if (show === "pinned") return t.pinned;
      return true;
    });
    const dim = sortBy;
    list = [...list].sort((a, b) =>
      dim === "title"
        ? a.title.localeCompare(b.title)
        : (b.ratings[dim] ?? -1) - (a.ratings[dim] ?? -1),
    );
    return list;
  });

  const selected = $derived(data?.tracks.find((t) => t.id === selectedId) ?? null);

  async function onSave(t: Track) {
    const saved = await saveTrack(t);
    data!.tracks = data!.tracks.map((x) => (x.id === saved.id ? saved : x));
  }
</script>

{#if error}
  <p class="error">{error}</p>
{:else if !data}
  <p>Loading…</p>
{:else}
  <div class="layout">
    <aside>
      <div class="controls">
        <input type="search" placeholder="Search title, artist, album" bind:value={query} />
        <select bind:value={show}>
          <option value="all">All</option>
          <option value="untagged">Untagged</option>
          <option value="unrated">Unrated</option>
          <option value="pinned">Pinned</option>
        </select>
        <select bind:value={sortBy}>
          <option value="title">Sort: title</option>
          {#each dims as d}
            <option value={d.id}>Sort: {d.name.en}</option>
          {/each}
        </select>
        <small>{rows.length} of {data.tracks.length}</small>
      </div>
      <ul>
        {#each rows as t (t.id)}
          <li>
            <button class:active={t.id === selectedId} onclick={() => (selectedId = t.id)}>
              {#if t.pinned}<span title="pinned">★</span>{/if}
              <strong>{t.title}</strong>
              <span class="artist">{t.artists.join(", ")}</span>
            </button>
          </li>
        {/each}
      </ul>
    </aside>
    <main>
      {#if selected}
        {#key selected.id}
          <TrackEditor track={selected} dimensions={dims} {onSave} />
        {/key}
      {:else}
        <p class="hint">Select a track.</p>
      {/if}
    </main>
  </div>
{/if}

<style>
  .layout { display: grid; grid-template-columns: 24rem 1fr; height: 100vh; }
  aside { display: flex; flex-direction: column; border-right: 1px solid color-mix(in srgb, currentColor 20%, transparent); min-height: 0; }
  .controls { display: grid; gap: 0.4rem; padding: 0.6rem; }
  ul { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
  li button { all: unset; display: block; width: 100%; box-sizing: border-box; padding: 0.4rem 0.7rem; cursor: pointer; }
  li button:hover { background: color-mix(in srgb, currentColor 8%, transparent); }
  li button.active { background: color-mix(in srgb, currentColor 16%, transparent); }
  .artist { display: block; opacity: 0.65; font-size: 0.9em; }
  main { padding: 1rem 1.5rem; overflow-y: auto; }
  .hint { opacity: 0.6; }
  .error { color: crimson; padding: 1rem; white-space: pre-wrap; }
</style>
