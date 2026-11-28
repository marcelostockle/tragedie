<script lang="ts">
  import { onMount } from "svelte";
  import {
    RATING_MAX,
    serializeTrack,
    type PublicDictionary,
    type PublicTag,
    type PublicTrack,
  } from "@tragedie/schema/browser";
  import { baseline, sameDraft, sanitize, toTrack, trackFile, type Draft } from "../lib/drafts";
  import { zip } from "../lib/zip";

  /** English only: this is a working tool, not part of the public site's copy. */
  const STORE = "tragedie.tagger.v1";

  let tracks = $state<PublicTrack[]>([]);
  let dict = $state<PublicDictionary | null>(null);
  let failed = $state(false);
  let drafts = $state<Record<string, Draft>>({});
  let ready = $state(false);

  let query = $state("");
  let show = $state<"all" | "untagged" | "unrated" | "changed">("all");
  let selectedId = $state<string | null>(null);
  let tagQuery = $state("");
  let browsing = $state(false);

  onMount(async () => {
    try {
      const [tr, di] = await Promise.all([
        fetch("/data/tracks.json").then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
        fetch("/data/en.json").then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      ]);
      tracks = tr;
      dict = di;
    } catch {
      failed = true;
      return;
    }
    drafts = restore();
    ready = true;
  });

  /** Saved drafts, minus anything unknown or already published (a redeploy catches them up). */
  function restore(): Record<string, Draft> {
    let raw: unknown = null;
    try {
      raw = JSON.parse(localStorage.getItem(STORE) ?? "null");
    } catch {
      /* storage blocked or corrupt: start clean */
    }
    const tagIds = new Set(dict!.tags.map((t) => t.id));
    const dimIds = new Set(dict!.dimensions.map((d) => d.id));
    const byId = new Map(tracks.map((t) => [t.id, t]));
    const out: Record<string, Draft> = {};
    if (typeof raw === "object" && raw !== null) {
      for (const [id, value] of Object.entries(raw)) {
        const track = byId.get(id);
        const draft = track && sanitize(value, tagIds, dimIds);
        if (track && draft && !sameDraft(draft, baseline(track))) out[id] = draft;
      }
    }
    return out;
  }

  $effect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORE, JSON.stringify($state.snapshot(drafts)));
    } catch {
      /* private window or full storage: the draft just won't survive a reload */
    }
  });

  const facets = $derived([...(dict?.facets ?? [])].sort((a, b) => a.name.localeCompare(b.name)));
  const dims = $derived(dict?.dimensions ?? []);
  const tagById = $derived(new Map((dict?.tags ?? []).map((t) => [t.id, t])));
  const tagsByFacet = $derived(
    facets.map((f) => ({
      facet: f,
      tags: (dict?.tags ?? []).filter((t) => t.facet === f.id).sort((a, b) => a.name.localeCompare(b.name)),
    })),
  );

  const effective = (t: PublicTrack): Draft => drafts[t.id] ?? baseline(t);
  const changedCount = $derived(Object.keys(drafts).length);

  const rows = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return tracks.filter((t) => {
      if (q && !`${t.title} ${t.artists.join(" ")} ${t.album ?? ""}`.toLowerCase().includes(q)) return false;
      const d = effective(t);
      if (show === "untagged") return d.tags.length === 0;
      if (show === "unrated") return dims.some((x) => d.ratings[x.id] === undefined);
      if (show === "changed") return t.id in drafts;
      return true;
    });
  });

  const selected = $derived(tracks.find((t) => t.id === selectedId) ?? null);
  const current = $derived(selected ? effective(selected) : null);

  function update(t: PublicTrack, next: Draft) {
    if (sameDraft(next, baseline(t))) delete drafts[t.id];
    else drafts[t.id] = next;
  }

  function setRating(dim: string, value: number) {
    if (!selected || !current) return;
    const ratings = { ...current.ratings };
    // Clicking the current value clears it: a missing rating is "unrated", never 0.
    if (ratings[dim] === value) delete ratings[dim];
    else ratings[dim] = value;
    update(selected, { tags: current.tags, ratings });
  }

  function toggleTag(id: string) {
    if (!selected || !current) return;
    const tags = current.tags.includes(id) ? current.tags.filter((x) => x !== id) : [...current.tags, id];
    update(selected, { tags, ratings: current.ratings });
    tagQuery = "";
  }

  const matches = $derived.by(() => {
    const q = tagQuery.trim().toLowerCase();
    if (!q || !current) return [];
    return (dict?.tags ?? [])
      .filter((t) => !current.tags.includes(t.id) && `${t.name} ${t.id}`.toLowerCase().includes(q))
      .slice(0, 12);
  });

  const chosenByFacet = $derived(
    facets
      .map((f) => ({
        facet: f,
        tags: (current?.tags ?? [])
          .map((id) => tagById.get(id))
          .filter((t): t is PublicTag => !!t && t.facet === f.id),
      }))
      .filter((g) => g.tags.length),
  );

  function next(step: 1 | -1) {
    const i = rows.findIndex((t) => t.id === selectedId);
    const target = rows[i < 0 ? 0 : i + step];
    if (target) selectedId = target.id;
  }

  function revert() {
    if (selected) delete drafts[selected.id];
  }

  function discardAll() {
    if (confirm(`Discard changes to ${changedCount} track(s)?`)) drafts = {};
  }

  function download() {
    const now = new Date();
    const byId = new Map(tracks.map((t) => [t.id, t]));
    const entries = Object.entries(drafts)
      .flatMap(([id, d]) => {
        const t = byId.get(id);
        return t ? [{ name: trackFile(id), text: serializeTrack(toTrack(t, d, now)) }] : [];
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    if (!entries.length) return;
    const stamp = now.toISOString().slice(0, 16).replace(/[-:]/g, "").replace("T", "-");
    const url = URL.createObjectURL(new Blob([zip(entries, now) as BlobPart], { type: "application/zip" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `tragedie-tracks-${stamp}.zip` });
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

{#if failed}
  <p class="error">Could not load the library data.</p>
{:else if !ready}
  <p class="muted">Loading…</p>
{:else}
  <div class="bar">
    <strong>{changedCount} changed</strong>
    <button class="primary" onclick={download} disabled={!changedCount}>Download changed tracks (.zip)</button>
    <button onclick={discardAll} disabled={!changedCount}>Discard all</button>
    <span class="muted">Unzip into <code>content/</code>, commit, push. Nothing is saved on the server.</span>
  </div>

  <div class="layout">
    <aside>
      <div class="controls">
        <input type="search" placeholder="Search title, artist, album" bind:value={query} />
        <select bind:value={show} aria-label="Show">
          <option value="all">All</option>
          <option value="untagged">Untagged</option>
          <option value="unrated">Unrated</option>
          <option value="changed">Changed here</option>
        </select>
        <small class="muted">{rows.length} of {tracks.length}</small>
      </div>
      <ul>
        {#each rows as t (t.id)}
          <li>
            <button class:active={t.id === selectedId} onclick={() => (selectedId = t.id)}>
              <strong>{t.title}</strong>
              {#if t.id in drafts}<span class="dot" title="changed here">●</span>{/if}
              <span class="artist">{t.artists.join(", ")}</span>
            </button>
          </li>
        {/each}
      </ul>
    </aside>

    <section>
      {#if selected && current}
        {#key selected.id}
          <h2>{selected.title}</h2>
          <p class="muted">
            {selected.artists.join(", ")}{selected.album ? ` · ${selected.album}` : ""} ·
            <a href={selected.link} target="_blank" rel="noreferrer noopener">open on YouTube</a>
          </p>

          <div class="nav">
            <button onclick={() => next(-1)}>← Previous</button>
            <button onclick={() => next(1)}>Next →</button>
            <button onclick={revert} disabled={!(selected.id in drafts)}>Revert this track</button>
          </div>

          <h3>Ratings</h3>
          {#each dims as d (d.id)}
            <div class="rating">
              <span class="dim" title={d.definition}>{d.name}</span>
              {#each Array.from({ length: RATING_MAX }, (_, i) => i + 1) as v (v)}
                <button
                  class="chip"
                  class:on={current.ratings[d.id] === v}
                  aria-pressed={current.ratings[d.id] === v}
                  onclick={() => setRating(d.id, v)}>{v}</button>
              {/each}
              {#if current.ratings[d.id] === undefined}<small class="muted">unrated</small>{/if}
            </div>
          {/each}

          <h3>Tags</h3>
          {#each chosenByFacet as g (g.facet.id)}
            <div class="chips">
              <span class="facet" title={g.facet.definition}>{g.facet.name}</span>
              {#each g.tags as t (t.id)}
                <button class="chip on" title={t.definition} onclick={() => toggleTag(t.id)}>{t.name} ×</button>
              {/each}
            </div>
          {/each}
          {#if current.tags.length === 0}<p class="muted">No tags.</p>{/if}

          <div class="add">
            <input type="search" placeholder="Add a tag…" bind:value={tagQuery} />
            <button onclick={() => (browsing = !browsing)}>{browsing ? "Hide all tags" : "Browse all tags"}</button>
          </div>
          {#if matches.length}
            <ul class="matches">
              {#each matches as t (t.id)}
                <li><button title={t.definition} onclick={() => toggleTag(t.id)}>{t.name} <small class="muted">{facets.find((f) => f.id === t.facet)?.name}</small></button></li>
              {/each}
            </ul>
          {/if}
          {#if browsing}
            <div class="browse">
              {#each tagsByFacet as g (g.facet.id)}
                <div class="chips">
                  <span class="facet" title={g.facet.definition}>{g.facet.name}</span>
                  {#each g.tags as t (t.id)}
                    <button class="chip" class:on={current.tags.includes(t.id)} title={t.definition} onclick={() => toggleTag(t.id)}>{t.name}</button>
                  {/each}
                </div>
              {/each}
            </div>
          {/if}
        {/key}
      {:else}
        <p class="muted">Select a track.</p>
      {/if}
    </section>
  </div>
{/if}

<style>
  .bar { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; margin-bottom: 1rem; }
  .bar button, .nav button, .add button { padding: 0.25rem 0.8rem; cursor: pointer; }
  .primary { background: var(--accent); color: var(--accent-fg); border: 0; border-radius: 0.3rem; }
  .primary:disabled { opacity: 0.4; cursor: default; }
  .layout { display: grid; grid-template-columns: 22rem 1fr; gap: 1.5rem; align-items: start; }
  aside { position: sticky; top: 0; display: flex; flex-direction: column; max-height: 85vh; border: 1px solid var(--line); }
  .controls { display: grid; gap: 0.4rem; padding: 0.6rem; }
  aside ul { list-style: none; margin: 0; padding: 0; overflow-y: auto; }
  aside li button { all: unset; display: block; width: 100%; box-sizing: border-box; padding: 0.35rem 0.7rem; cursor: pointer; }
  aside li button:hover { background: var(--band); }
  aside li button.active { background: color-mix(in srgb, var(--accent) 18%, transparent); }
  .artist { display: block; color: var(--muted); font-size: 0.9em; }
  .dot { color: var(--accent); }
  h2 { margin-top: 0; }
  .nav { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
  .rating { display: flex; align-items: center; gap: 0.35rem; margin: 0.25rem 0; }
  .rating .chip { min-width: 2rem; text-align: center; padding: 0.15rem 0.5rem; }
  .dim { width: 6.5rem; }
  .chips { display: flex; flex-wrap: wrap; gap: 0.35rem; align-items: center; margin: 0.3rem 0; }
  .facet { min-width: 8rem; color: var(--muted); font-size: 0.85rem; }
  .add { display: flex; gap: 0.5rem; margin-top: 0.8rem; }
  .add input { flex: 1; }
  .matches { list-style: none; margin: 0.3rem 0; padding: 0; border: 1px solid var(--line); }
  .matches button { all: unset; display: block; width: 100%; box-sizing: border-box; padding: 0.3rem 0.6rem; cursor: pointer; }
  .matches button:hover { background: var(--band); }
  .browse { margin-top: 0.8rem; padding: 0.6rem; border: 1px solid var(--line); }
  .error { color: crimson; }
  @media (max-width: 52rem) {
    .layout { grid-template-columns: 1fr; }
    aside { position: static; max-height: 18rem; }
  }
</style>
