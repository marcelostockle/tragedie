<script lang="ts">
  import { onMount } from "svelte";
  import type {
    Locale,
    PublicDictionary,
    PublicTag,
    PublicTrack,
  } from "@tragedie/schema/browser";
  import type { Strings } from "../i18n/strings";
  import RatingPolygon from "./RatingPolygon.svelte";

  let { locale, ui }: { locale: Locale; ui: Strings["library"] } = $props();

  let tracks = $state<PublicTrack[]>([]);
  let dict = $state<PublicDictionary | null>(null);
  let failed = $state(false);

  let query = $state("");
  let sortBy = $state("title");
  let selectedTags = $state<string[]>([]);
  /** Hover previews a track; click locks it. A locked track wins over the preview. */
  let previewId = $state<string | null>(null);
  let lockedId = $state<string | null>(null);

  const fmt = (tpl: string, v: Record<string, string | number>) =>
    tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

  onMount(async () => {
    try {
      const [tr, di] = await Promise.all([
        fetch("/data/tracks.json").then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
        fetch(`/data/${locale}.json`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      ]);
      tracks = tr;
      dict = di;
    } catch {
      failed = true;
      return;
    }
    // Deep links: ?tag=a,b filters, ?track=<id> locks a track (used by the tag pages).
    const params = new URLSearchParams(location.search);
    const known = new Set(dict!.tags.map((t) => t.id));
    selectedTags = (params.get("tag") ?? "").split(",").filter((id) => known.has(id));
    const wanted = params.get("track");
    if (wanted && tracks.some((t) => t.id === wanted)) {
      lockedId = wanted;
      query = tracks.find((t) => t.id === wanted)!.title;
    }
  });

  /** Keep the URL in step with the tag filter, so a filtered view can be shared. */
  $effect(() => {
    if (!dict) return;
    const url = new URL(location.href);
    if (selectedTags.length) url.searchParams.set("tag", selectedTags.join(","));
    else url.searchParams.delete("tag");
    url.searchParams.delete("track");
    history.replaceState(null, "", url);
  });

  const tagById = $derived(new Map((dict?.tags ?? []).map((t) => [t.id, t])));
  const facetName = $derived(new Map((dict?.facets ?? []).map((f) => [f.id, f.name])));

  /** Only tags that some track carries are offered as filters. */
  const filterGroups = $derived(
    [...(dict?.facets ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name, locale))
      .map((f) => ({
        facet: f,
        tags: (dict?.tags ?? [])
          .filter((t) => t.facet === f.id && t.count > 0)
          .sort((a, b) => a.name.localeCompare(b.name, locale)),
      }))
      .filter((g) => g.tags.length),
  );

  const shown = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const list = tracks.filter((t) => {
      if (selectedTags.some((id) => !t.tags.includes(id))) return false;
      if (!q) return true;
      return `${t.title} ${t.artists.join(" ")} ${t.album ?? ""}`.toLowerCase().includes(q);
    });
    return list.sort((a, b) => {
      if (sortBy !== "title") {
        // Highest first; tracks that were not rated on this dimension go last.
        const d = (b.ratings[sortBy] ?? -1) - (a.ratings[sortBy] ?? -1);
        if (d) return d;
      }
      return a.title.localeCompare(b.title, locale);
    });
  });

  const activeId = $derived(lockedId ?? previewId);
  const active = $derived(tracks.find((t) => t.id === activeId) ?? null);

  const toggleTag = (id: string) => {
    selectedTags = selectedTags.includes(id)
      ? selectedTags.filter((x) => x !== id)
      : [...selectedTags, id];
  };
  const toggleLock = (id: string) => (lockedId = lockedId === id ? null : id);

  function groupedTags(track: PublicTrack) {
    const byFacet = new Map<string, PublicTag[]>();
    for (const id of track.tags) {
      const tag = tagById.get(id);
      if (tag) byFacet.set(tag.facet, [...(byFacet.get(tag.facet) ?? []), tag]);
    }
    return [...byFacet.entries()]
      .map(([facet, tags]) => ({ facet, name: facetName.get(facet) ?? facet, tags }))
      .sort((a, b) => a.name.localeCompare(b.name, locale));
  }
</script>

<svelte:window onkeydown={(e) => e.key === "Escape" && (lockedId = null)} />

{#if failed}
  <p class="error">{ui.loadError}</p>
{:else if !dict}
  <p class="muted">{ui.loading}</p>
{:else}
  <div class="library">
    <section class="list-pane">
      <div class="controls">
        <input type="search" placeholder={ui.search} aria-label={ui.search} bind:value={query} />
        <label>
          <span class="muted">{ui.sortBy}</span>
          <select bind:value={sortBy}>
            <option value="title">{ui.sortTitle}</option>
            {#each dict.dimensions as d (d.id)}<option value={d.id}>{d.name}</option>{/each}
          </select>
        </label>
      </div>

      <details class="filter">
        <summary>{ui.filterTags}{selectedTags.length ? ` (${selectedTags.length})` : ""}</summary>
        {#if filterGroups.length === 0}
          <p class="muted">{ui.noTagsInUse}</p>
        {:else}
          {#each filterGroups as g (g.facet.id)}
            <div class="facet-row">
              <span class="facet-name" title={g.facet.definition}>{g.facet.name}</span>
              {#each g.tags as t (t.id)}
                <button
                  type="button"
                  class="chip"
                  class:on={selectedTags.includes(t.id)}
                  aria-pressed={selectedTags.includes(t.id)}
                  title={t.definition}
                  onclick={() => toggleTag(t.id)}
                >{t.name} <small>{t.count}</small></button>
              {/each}
            </div>
          {/each}
        {/if}
      </details>

      {#if selectedTags.length}
        <div class="chosen">
          {#each selectedTags as id (id)}
            {@const t = tagById.get(id)}
            <button type="button" class="chip on" onclick={() => toggleTag(id)}>{t?.name ?? id} ×</button>
          {/each}
          <button type="button" class="link" onclick={() => (selectedTags = [])}>{ui.clearTags}</button>
        </div>
      {/if}

      <p class="muted count">{fmt(ui.showing, { shown: shown.length, total: tracks.length })}</p>

      {#if shown.length === 0}
        <p class="muted">{ui.noResults}</p>
      {:else}
        <ul class="rows">
          {#each shown as t (t.id)}
            <li>
              <button
                type="button"
                class="row"
                class:locked={t.id === lockedId}
                class:active={t.id === activeId}
                aria-pressed={t.id === lockedId}
                onmouseenter={() => (previewId = t.id)}
                onmouseleave={() => (previewId = null)}
                onfocus={() => (previewId = t.id)}
                onblur={() => (previewId = null)}
                onclick={() => toggleLock(t.id)}
              >
                {#if t.pinned}<span class="pin" title={ui.pinned} aria-label={ui.pinned}>★</span>{/if}
                <span class="title">{t.title}</span>
                <span class="artist muted">{t.artists.join(", ")}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <!-- Wide screens: a sticky side panel that follows hover. Narrow screens: a bottom
         sheet that only appears once a track is locked, since touch has no hover. -->
    <aside class="panel" class:open={lockedId !== null} aria-live="polite">
      {#if active}
        <div class="panel-head">
          <h2>{active.title}</h2>
          {#if lockedId}
            <button type="button" class="link" onclick={() => (lockedId = null)}>{ui.unlock}</button>
          {/if}
        </div>
        <p class="muted meta">
          {active.artists.join(", ")}{active.album ? ` · ${active.album}` : ""}
        </p>
        <p><a href={active.link} target="_blank" rel="noreferrer noopener">{ui.openOnYoutube} ↗</a></p>

        <h3>{ui.tags}</h3>
        {#each groupedTags(active) as g (g.facet)}
          <div class="facet-row">
            <span class="facet-name">{g.name}</span>
            {#each g.tags as t (t.id)}
              <a class="chip" href={`/${locale}/tags/${t.id}/`} title={t.definition}>{t.name}</a>
            {/each}
          </div>
        {:else}
          <p class="muted">{ui.noTags}</p>
        {/each}

        <h3>{ui.ratings}</h3>
        <RatingPolygon dimensions={dict.dimensions} ratings={active.ratings} unratedLabel={ui.unrated} />
      {:else}
        <p class="muted">{ui.hint}</p>
      {/if}
    </aside>
  </div>
{/if}

<style>
  .library { display: grid; grid-template-columns: minmax(0, 1fr) 22rem; gap: 1.5rem; align-items: start; }

  .controls { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; margin-bottom: 0.6rem; }
  .controls input { flex: 1; min-width: 14rem; padding: 0.4rem 0.6rem; border: 1px solid var(--line); border-radius: 0.4rem; background: var(--chip-bg); }
  .controls label { display: flex; gap: 0.4rem; align-items: center; }
  select { padding: 0.35rem 0.4rem; border: 1px solid var(--line); border-radius: 0.4rem; background: var(--chip-bg); }

  .filter { margin-bottom: 0.6rem; }
  .filter summary { cursor: pointer; }
  .facet-row { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; padding: 0.3rem 0.5rem; }
  .facet-row:nth-of-type(even) { background: var(--band); }
  .facet-name { font-size: 0.78rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); padding-right: 0.3rem; }
  .chosen { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; margin-bottom: 0.4rem; }
  .count { margin: 0.2rem 0; font-size: 0.9rem; }

  .link { background: none; border: 0; padding: 0; color: var(--accent); text-decoration: underline; cursor: pointer; }

  .rows { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--line); }
  .rows li { border-bottom: 1px solid var(--line); }
  .row { all: unset; box-sizing: border-box; display: flex; gap: 0.6rem; align-items: baseline; width: 100%; padding: 0.35rem 0.5rem; cursor: pointer; }
  .row:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  .row.active { background: var(--band); }
  .row.locked { background: color-mix(in srgb, var(--accent) 18%, transparent); box-shadow: inset 3px 0 0 var(--accent); }
  .title { font-weight: 500; }
  .artist { font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pin { color: var(--accent); }

  .panel { position: sticky; top: 1rem; max-height: calc(100vh - 2rem); overflow-y: auto; padding: 0.9rem 1rem; border: 1px solid var(--line); border-radius: 0.6rem; background: var(--band); }
  .panel-head { display: flex; justify-content: space-between; gap: 1rem; align-items: baseline; }
  .panel h2 { margin: 0; font-size: 1.1rem; }
  .panel h3 { margin: 1rem 0 0.3rem; font-size: 0.95rem; }
  .meta { margin: 0.2rem 0 0.4rem; }
  .panel .facet-row { padding: 0.2rem 0; }
  .panel .facet-row:nth-of-type(even) { background: none; }

  .error { color: crimson; }

  /* Narrow: the list takes the page; the panel becomes a bottom sheet, shown when locked. */
  @media (max-width: 52rem) {
    .library { grid-template-columns: minmax(0, 1fr); }
    .panel { display: none; }
    .panel.open {
      display: block;
      position: fixed;
      inset: auto 0 0 0;
      max-height: 70vh;
      border-radius: 0.8rem 0.8rem 0 0;
      box-shadow: 0 -6px 24px rgb(0 0 0 / 0.25);
      z-index: 10;
    }
  }
</style>
