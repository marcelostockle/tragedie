<script lang="ts">
  import { onMount } from "svelte";
  import type { Facet } from "@tragedie/schema/browser";
  import type { LoadedTag } from "./api";
  import { tagName, tagTitle } from "./tags";

  let {
    tags,
    facets,
    selected,
    onToggle,
    onClose,
  }: {
    tags: LoadedTag[];
    facets: Facet[];
    /** Tag ids currently on the track. */
    selected: string[];
    onToggle: (id: string) => void;
    onClose: () => void;
  } = $props();

  let dialog: HTMLDialogElement;
  onMount(() => dialog.showModal());

  const groups = $derived(
    facets
      .map((f) => ({
        facet: f,
        tags: tags
          .filter((t) => t.file.facet === f.id)
          .sort((a, b) => tagName(a).localeCompare(tagName(b))),
      }))
      .filter((g) => g.tags.length),
  );
</script>

<!-- Escape fires `close` too, so every way of leaving ends up in onClose. -->
<dialog bind:this={dialog} onclose={onClose}>
  <header>
    <strong>All tags</strong>
    <small>{selected.length} selected · click a tag to add or remove it</small>
    <button type="button" onclick={() => dialog.close()}>Done</button>
  </header>

  <!-- One continuous flow: facet labels and tags are siblings, so nothing breaks the line
       between facets. -->
  <div class="flow">
    {#each groups as g (g.facet.id)}
      <span class="facet" title={g.facet.definition.en}>{g.facet.name.en}</span>
      {#each g.tags as t (t.file.id)}
        <button
          type="button"
          class="chip"
          class:on={selected.includes(t.file.id)}
          aria-pressed={selected.includes(t.file.id)}
          title={tagTitle(t)}
          onclick={() => onToggle(t.file.id)}
        >{tagName(t)}</button>
      {/each}
    {/each}
  </div>
</dialog>

<style>
  dialog {
    width: 100vw;
    height: 100vh;
    max-width: none;
    max-height: none;
    margin: 0;
    padding: 0;
    border: 0;
    flex-direction: column;
  }
  dialog[open] { display: flex; }
  header {
    display: flex;
    align-items: baseline;
    gap: 0.8rem;
    padding: 0.6rem 1rem;
    border-bottom: 1px solid color-mix(in srgb, currentColor 20%, transparent);
  }
  header small { flex: 1; opacity: 0.65; }
  .flow {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem 0.4rem;
    padding: 1rem;
    overflow-y: auto;
    flex: 1;
    align-content: flex-start;
  }
  .facet {
    font-size: 0.8em;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    opacity: 0.7;
    padding: 0 0.2rem 0 0.8rem;
  }
  .facet:first-child { padding-left: 0; }
  .chip { border-radius: 1rem; padding: 0.1rem 0.7rem; cursor: pointer; }
  .chip.on { font-weight: 600; background: color-mix(in srgb, currentColor 22%, transparent); }
</style>
