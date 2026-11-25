<script lang="ts">
  import { LOCALES, SOURCE_LOCALE } from "@tragedie/schema/browser";
  import { createTag, updateTag, type Loaded, type TagPayload } from "./api";
  import { tagName, tagTitle } from "./tags";
  import TagEditor from "./TagEditor.svelte";

  let { data }: { data: Loaded } = $props();

  let query = $state("");
  let show = $state<"all" | "missing-translation" | "unused">("all");
  /** An existing tag id, "new", or null. */
  let selected = $state<string | null>(null);
  /** Shown after creating a tag, since the editor remounts in edit mode. */
  let notice = $state("");
  const select = (id: string | null) => {
    selected = id;
    notice = "";
  };

  const used = $derived(new Set(data.tracks.flatMap((t) => t.tags)));
  const otherLocales = LOCALES.filter((l) => l !== SOURCE_LOCALE);

  const groups = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return data.facets
      .map((f) => ({
        facet: f,
        tags: data.tags
          .filter((t) => t.file.facet === f.id)
          .filter((t) => !q || `${tagName(t)} ${t.file.id}`.toLowerCase().includes(q))
          .filter((t) => {
            if (show === "missing-translation") return otherLocales.some((l) => !t.prose[l]);
            if (show === "unused") return !used.has(t.file.id);
            return true;
          })
          .sort((a, b) => tagName(a).localeCompare(tagName(b))),
      }))
      .filter((g) => g.tags.length || (!q && show === "all"));
  });

  const current = $derived(data.tags.find((t) => t.file.id === selected) ?? null);

  async function onSave(p: TagPayload, isNew: boolean) {
    const saved = await (isNew ? createTag(p) : updateTag(p));
    data.tags = isNew
      ? [...data.tags, saved]
      : data.tags.map((t) => (t.file.id === saved.file.id ? saved : t));
    selected = saved.file.id;
    notice = isNew ? `Created ${saved.file.id}.` : "";
  }
</script>

<div class="layout">
  <aside>
    <div class="controls">
      <button type="button" onclick={() => select("new")}>+ New tag</button>
      <input type="search" placeholder="Search tags" bind:value={query} />
      <select bind:value={show}>
        <option value="all">All</option>
        <option value="missing-translation">Missing a translation</option>
        <option value="unused">Not used by any track</option>
      </select>
      <small>{data.tags.length} tag{data.tags.length === 1 ? "" : "s"}</small>
    </div>
    <div class="list">
      {#each groups as g (g.facet.id)}
        <h3 title={g.facet.definition.en}>{g.facet.name.en} <small>{g.tags.length}</small></h3>
        <ul>
          {#each g.tags as t (t.file.id)}
            <li>
              <button class:active={t.file.id === selected} title={tagTitle(t)} onclick={() => select(t.file.id)}>
                {tagName(t)}
                {#if t.file.sameWord}<small class="same">≈ {t.file.sameWord}</small>{/if}
              </button>
            </li>
          {/each}
        </ul>
      {/each}
      {#if data.tags.length === 0}<p class="hint">No tags yet.</p>{/if}
    </div>
  </aside>
  <main>
    {#if notice}<p class="notice">{notice}</p>{/if}
    {#if selected === "new"}
      {#key "new"}
        <TagEditor tag={null} tags={data.tags} facets={data.facets} tracks={data.tracks} {onSave} />
      {/key}
    {:else if current}
      {#key current.file.id}
        <TagEditor tag={current} tags={data.tags} facets={data.facets} tracks={data.tracks} {onSave} />
      {/key}
    {:else}
      <p class="hint">Select a tag, or create one.</p>
    {/if}
  </main>
</div>

<style>
  .layout { display: grid; grid-template-columns: 24rem 1fr; flex: 1; min-height: 0; }
  aside { display: flex; flex-direction: column; border-right: 1px solid color-mix(in srgb, currentColor 20%, transparent); min-height: 0; }
  .controls { display: grid; gap: 0.4rem; padding: 0.6rem; }
  .list { overflow-y: auto; flex: 1; }
  h3 { margin: 0.6rem 0.7rem 0.2rem; font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.7; }
  ul { list-style: none; margin: 0; padding: 0; }
  li button { all: unset; display: block; width: 100%; box-sizing: border-box; padding: 0.3rem 0.7rem; cursor: pointer; }
  li button:hover { background: color-mix(in srgb, currentColor 8%, transparent); }
  li button.active { background: color-mix(in srgb, currentColor 16%, transparent); }
  .same { opacity: 0.6; margin-left: 0.4rem; }
  main { padding: 1rem 1.5rem; overflow-y: auto; }
  .notice { margin: 0 0 0.6rem; }
  .hint { opacity: 0.6; padding: 0 0.7rem; }
</style>
