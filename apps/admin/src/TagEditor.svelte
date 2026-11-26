<script lang="ts">
  import {
    LOCALES,
    RELATION_TYPES,
    SOURCE_LOCALE,
    type Facet,
    type Locale,
    type Track,
  } from "@tragedie/schema/browser";
  import type { LoadedTag, TagPayload } from "./api";
  import { slug, tagName } from "./tags";
  import TrackPicker from "./TrackPicker.svelte";

  let {
    tag,
    tags,
    facets,
    tracks,
    onSave,
  }: {
    /** null = creating a new tag. */
    tag: LoadedTag | null;
    tags: LoadedTag[];
    facets: Facet[];
    tracks: Track[];
    onSave: (p: TagPayload, isNew: boolean) => Promise<void>;
  } = $props();

  type ProseDraft = { name: string; definition: string; notes: string };
  type ExampleDraft = { trackId: string; note: string; start: string; end: string };
  type RelationDraft = { type: (typeof RELATION_TYPES)[number]; target: string };

  // svelte-ignore state_referenced_locally
  const isNew = tag === null;

  function initialProse(): Record<Locale, ProseDraft> {
    return Object.fromEntries(
      LOCALES.map((l) => {
        const p = tag?.prose[l];
        return [l, { name: p?.name ?? "", definition: p?.definition ?? "", notes: p?.notes ?? "" }];
      }),
    ) as Record<Locale, ProseDraft>;
  }

  // Seeded once; the parent re-keys this component when another tag is selected.
  /* svelte-ignore state_referenced_locally */
  let id = $state(tag?.file.id ?? "");
  /* svelte-ignore state_referenced_locally */
  let idTouched = $state(!isNew);
  /* svelte-ignore state_referenced_locally */
  let facet = $state(tag?.file.facet ?? facets[0]?.id ?? "");
  /* svelte-ignore state_referenced_locally */
  let sameWord = $state(tag?.file.sameWord ?? "");
  let prose = $state(initialProse());
  /* svelte-ignore state_referenced_locally */
  let examples = $state<ExampleDraft[]>(
    (tag?.file.examples ?? []).map((e) => ({
      trackId: e.trackId,
      note: e.note ?? "",
      start: e.start?.toString() ?? "",
      end: e.end?.toString() ?? "",
    })),
  );
  /* svelte-ignore state_referenced_locally */
  let related = $state<RelationDraft[]>((tag?.file.related ?? []).map((r) => ({ ...r })));
  let message = $state("");
  let saving = $state(false);

  // New tags get a suggested id (name + facet) until the user types their own.
  $effect(() => {
    if (!isNew || idTouched) return;
    const base = slug(prose[SOURCE_LOCALE].name);
    id = base ? `${base}.${facet}` : "";
  });

  const trackById = $derived(new Map(tracks.map((t) => [t.id, t])));
  const sameWordOptions = $derived([...new Set(tags.map((t) => t.file.sameWord).filter(Boolean))]);
  const usedBy = $derived(tracks.filter((t) => t.tags.includes(id)));
  const otherTags = $derived(tags.filter((t) => t.file.id !== id));

  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

  function payload(): TagPayload {
    const outProse: TagPayload["prose"] = {} as TagPayload["prose"];
    for (const l of LOCALES) {
      const p = prose[l];
      // Optional locales are omitted when left entirely blank.
      if (l !== SOURCE_LOCALE && !p.name.trim() && !p.definition.trim() && !p.notes.trim()) continue;
      outProse[l] = { name: p.name.trim(), definition: p.definition.trim(), notes: p.notes };
    }
    return {
      file: {
        id: id.trim(),
        facet,
        ...(sameWord.trim() ? { sameWord: sameWord.trim() } : {}),
        examples: examples.map((e) => ({
          trackId: e.trackId,
          ...(e.note.trim() ? { note: e.note.trim() } : {}),
          ...(num(e.start) !== undefined ? { start: num(e.start)! } : {}),
          ...(num(e.end) !== undefined ? { end: num(e.end)! } : {}),
        })),
        related: related.filter((r) => r.target).map((r) => ({ ...r })),
      },
      prose: outProse,
    };
  }

  async function save() {
    saving = true;
    message = "";
    try {
      await onSave(payload(), isNew);
      message = "Saved.";
    } catch (e) {
      message = (e as Error).message;
    } finally {
      saving = false;
    }
  }
</script>

<form onsubmit={(e) => { e.preventDefault(); save(); }}>
  <h2>{isNew ? "New tag" : tagName(tag!)}</h2>

  <div class="grid">
    <label>
      Id {#if !isNew}<small>(fixed once created)</small>{/if}
      <input
        bind:value={id}
        oninput={() => (idTouched = true)}
        readonly={!isNew}
        required
        placeholder="e.g. warm.timbre"
      />
    </label>
    <label>
      Facet
      <select bind:value={facet}>
        {#each facets as f (f.id)}<option value={f.id}>{f.name.en}</option>{/each}
      </select>
    </label>
    <label>
      Same word group <small>(links homonyms)</small>
      <input bind:value={sameWord} list="same-words" />
      <datalist id="same-words">{#each sameWordOptions as w}<option value={w}></option>{/each}</datalist>
    </label>
  </div>

  {#each LOCALES as l (l)}
    <fieldset>
      <legend>{l.toUpperCase()}{l === SOURCE_LOCALE ? " (source, required)" : " (optional)"}</legend>
      <label>Name <input bind:value={prose[l].name} required={l === SOURCE_LOCALE} /></label>
      <label>
        Definition <small>(1–2 sentences: what it is and what it isn't)</small>
        <textarea rows="3" bind:value={prose[l].definition} required={l === SOURCE_LOCALE}></textarea>
      </label>
      <label>Notes <small>(markdown)</small> <textarea rows="4" bind:value={prose[l].notes}></textarea></label>
    </fieldset>
  {/each}

  <fieldset>
    <legend>Examples</legend>
    {#each examples as ex, i (i)}
      {@const t = trackById.get(ex.trackId)}
      <div class="item">
        <strong>{t ? `${t.title} — ${t.artists.join(", ")}` : ex.trackId}</strong>
        <input placeholder="note" bind:value={ex.note} />
        <input class="short" type="number" min="0" step="any" placeholder="start s" bind:value={ex.start} />
        <input class="short" type="number" min="0" step="any" placeholder="end s" bind:value={ex.end} />
        <button type="button" onclick={() => examples.splice(i, 1)}>Remove</button>
      </div>
    {/each}
    <TrackPicker {tracks} onPick={(t) => examples.push({ trackId: t.id, note: "", start: "", end: "" })} />
  </fieldset>

  <fieldset>
    <legend>Related</legend>
    {#each related as r, i (i)}
      <div class="item">
        <select bind:value={r.type}>{#each RELATION_TYPES as ty}<option value={ty}>{ty}</option>{/each}</select>
        <select bind:value={r.target}>
          <option value="">— choose tag —</option>
          {#each otherTags as o (o.file.id)}<option value={o.file.id}>{tagName(o)} ({o.file.id})</option>{/each}
        </select>
        <button type="button" onclick={() => related.splice(i, 1)}>Remove</button>
      </div>
    {/each}
    <button type="button" onclick={() => related.push({ type: "often-with", target: "" })}>Add relation</button>
  </fieldset>

  {#if !isNew}
    <fieldset>
      <legend>Used by {usedBy.length} track{usedBy.length === 1 ? "" : "s"}</legend>
      <ul class="used">
        {#each usedBy.slice(0, 50) as t (t.id)}<li>{t.title} <small>{t.artists.join(", ")}</small></li>{/each}
      </ul>
      {#if usedBy.length > 50}<small>…and {usedBy.length - 50} more</small>{/if}
    </fieldset>
  {/if}

  <div class="row">
    <button type="submit" disabled={saving}>{saving ? "Saving…" : isNew ? "Create tag" : "Save"}</button>
    {#if message}<span class="message">{message}</span>{/if}
  </div>
</form>

<style>
  form { display: grid; gap: 0.8rem; max-width: 46rem; }
  h2 { margin: 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr)); gap: 0.6rem; }
  label { display: grid; gap: 0.2rem; }
  textarea { font: inherit; resize: vertical; }
  fieldset { display: grid; gap: 0.5rem; }
  .item { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
  .item strong { flex: 1 1 100%; }
  .item input:not(.short) { flex: 1; min-width: 8rem; }
  .short { width: 6rem; }
  .used { margin: 0; padding-left: 1.2rem; max-height: 12rem; overflow-y: auto; }
  .row { display: flex; gap: 0.6rem; align-items: center; }
  .message { white-space: pre-wrap; }
</style>
