<script lang="ts">
  import type { Track } from "@tragedie/schema/browser";

  let { tracks, onPick }: { tracks: Track[]; onPick: (t: Track) => void } = $props();

  let query = $state("");
  const matches = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return tracks
      .filter((t) => `${t.title} ${t.artists.join(" ")}`.toLowerCase().includes(q))
      .slice(0, 8);
  });

  function pick(t: Track) {
    onPick(t);
    query = "";
  }
</script>

<div class="picker">
  <input type="search" placeholder="Find a track to add…" bind:value={query} />
  {#if matches.length}
    <ul>
      {#each matches as t (t.id)}
        <li><button type="button" onclick={() => pick(t)}>{t.title} <span>{t.artists.join(", ")}</span></button></li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .picker { display: grid; gap: 0.2rem; }
  ul { list-style: none; margin: 0; padding: 0; border: 1px solid color-mix(in srgb, currentColor 20%, transparent); }
  button { all: unset; display: block; width: 100%; padding: 0.3rem 0.5rem; cursor: pointer; box-sizing: border-box; }
  button:hover { background: color-mix(in srgb, currentColor 10%, transparent); }
  span { opacity: 0.6; }
</style>
