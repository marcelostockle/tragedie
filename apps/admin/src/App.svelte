<script lang="ts">
  import type { Track } from "@tragedie/schema/browser";
  import { loadAll, saveTrack, type Loaded } from "./api";
  import AddTrack from "./AddTrack.svelte";
  import TagsView from "./TagsView.svelte";
  import TrackEditor from "./TrackEditor.svelte";

  let view = $state<"tracks" | "tags">("tracks");

  let data = $state<Loaded | null>(null);
  let error = $state("");
  let selectedId = $state<string | null>(null);

  let query = $state("");
  let show = $state<"all" | "untagged" | "unrated" | "pinned">("all");
  let sortBy = $state<string>("title");
  let groupByArtist = $state(false);
  let adding = $state(false);

  loadAll().then((d) => (data = d), (e) => (error = String(e)));

  const dims = $derived(data?.dimensions ?? []);

  const NO_ARTIST = "(no artist)";
  /** Tracks group and sort under their first-listed artist. */
  const primaryArtist = (t: Track) => t.artists[0] ?? NO_ARTIST;

  const rows = $derived.by(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    let list = data.tracks.filter((t) => {
      if (q && !`${t.title} ${t.artists.join(" ")} ${t.album ?? ""}`.toLowerCase().includes(q)) return false;
      if (show === "untagged") return t.tags.length === 0;
      if (show === "unrated") return dims.some((d) => t.ratings[d.id] === undefined);
      if (show === "pinned") return t.pinned;
      return true;
    });
    const dim = sortBy;
    list = [...list].sort((a, b) =>
      dim === "title"
        ? a.title.localeCompare(b.title)
        : dim === "artist"
          ? primaryArtist(a).localeCompare(primaryArtist(b)) || a.title.localeCompare(b.title)
          : (b.ratings[dim] ?? -1) - (a.ratings[dim] ?? -1),
    );
    return list;
  });

  /** The list as shown: tracks, with a header before each artist when grouping. */
  type Item = { kind: "group"; artist: string; count: number } | { kind: "track"; track: Track };
  const items = $derived.by((): Item[] => {
    if (!groupByArtist) return rows.map((track) => ({ kind: "track", track }));
    const groups = new Map<string, Track[]>();
    for (const t of rows) groups.set(primaryArtist(t), [...(groups.get(primaryArtist(t)) ?? []), t]);
    return [...groups]
      .sort(([a], [b]) => (a === NO_ARTIST ? 1 : b === NO_ARTIST ? -1 : a.localeCompare(b)))
      .flatMap(([artist, tracks]): Item[] => [
        { kind: "group", artist, count: tracks.length },
        ...tracks.map((track): Item => ({ kind: "track", track })),
      ]);
  });

  const selected = $derived(data?.tracks.find((t) => t.id === selectedId) ?? null);

  async function onSave(t: Track) {
    const saved = await saveTrack(t);
    data!.tracks = data!.tracks.map((x) => (x.id === saved.id ? saved : x));
  }

  function onCreated(t: Track) {
    data!.tracks = [...data!.tracks, t];
    // The new track must be visible to be selected, whatever filters are on.
    query = "";
    show = "all";
    selectedId = t.id;
    adding = false;
  }
</script>

{#if error}
  <p class="error">{error}</p>
{:else if !data}
  <p>Loading…</p>
{:else}
  <nav>
    <button class:active={view === "tracks"} onclick={() => (view = "tracks")}>Tracks <small>{data.tracks.length}</small></button>
    <button class:active={view === "tags"} onclick={() => (view = "tags")}>Tags <small>{data.tags.length}</small></button>
  </nav>
  {#if view === "tags"}
    <TagsView {data} />
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
          <option value="artist">Sort: artist</option>
          {#each dims as d}
            <option value={d.id}>Sort: {d.name.en}</option>
          {/each}
        </select>
        <label class="inline"><input type="checkbox" bind:checked={groupByArtist} /> Group by artist</label>
        <span class="row">
          <small>{rows.length} of {data.tracks.length}</small>
          <button onclick={() => { adding = true; selectedId = null; }}>+ Add track</button>
        </span>
      </div>
      <ul>
        {#each items as item (item.kind === "group" ? `g:${item.artist}` : item.track.id)}
          {#if item.kind === "group"}
            <li class="group">{item.artist} <small>{item.count}</small></li>
          {:else}
            {@const t = item.track}
            <li>
              <button class:active={t.id === selectedId} onclick={() => { selectedId = t.id; adding = false; }}>
                {#if t.pinned}<span title="pinned">★</span>{/if}
                <strong>{t.title}</strong>
                <span class="artist">{t.artists.join(", ")}</span>
              </button>
            </li>
          {/if}
        {/each}
      </ul>
    </aside>
    <main>
      {#if adding}
        <AddTrack {onCreated} />
      {:else if selected}
        {#key selected.id}
          <TrackEditor track={selected} dimensions={dims} tags={data.tags} facets={data.facets} {onSave} />
        {/key}
      {:else}
        <p class="hint">Select a track.</p>
      {/if}
    </main>
  </div>
  {/if}
{/if}

<style>
  nav { display: flex; gap: 0.3rem; padding: 0.4rem 0.6rem; border-bottom: 1px solid color-mix(in srgb, currentColor 20%, transparent); }
  nav button { padding: 0.2rem 0.8rem; cursor: pointer; }
  nav button.active { font-weight: 600; text-decoration: underline; }
  .layout { display: grid; grid-template-columns: 24rem 1fr; flex: 1; min-height: 0; }
  aside { display: flex; flex-direction: column; border-right: 1px solid color-mix(in srgb, currentColor 20%, transparent); min-height: 0; }
  .controls { display: grid; gap: 0.4rem; padding: 0.6rem; }
  ul { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; }
  li button { all: unset; display: block; width: 100%; box-sizing: border-box; padding: 0.4rem 0.7rem; cursor: pointer; }
  li button:hover { background: color-mix(in srgb, currentColor 8%, transparent); }
  li button.active { background: color-mix(in srgb, currentColor 16%, transparent); }
  .artist { display: block; opacity: 0.65; font-size: 0.9em; }
  main { padding: 1rem 1.5rem; overflow-y: auto; }
  .group { position: sticky; top: 0; padding: 0.3rem 0.7rem; font-weight: 600; background: Canvas; border-bottom: 1px solid color-mix(in srgb, currentColor 20%, transparent); }
  .inline { display: flex; gap: 0.4rem; align-items: center; }
  .row { display: flex; justify-content: space-between; align-items: center; }
  .hint { opacity: 0.6; }
  .error { color: crimson; padding: 1rem; white-space: pre-wrap; }
</style>
