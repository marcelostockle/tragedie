<script lang="ts">
  /**
   * A rating polygon with one axis per dimension (a pentagon for five, a hexagon for six...).
   * Drawn from the dimension list, so the shape follows `dimensions.json`.
   *
   * Unrated dimensions are left as gaps. They are never plotted as 0: the lowest rating is 1,
   * so 0 would claim something the data does not say.
   */
  import type { PublicDimension } from "@tragedie/schema/browser";

  let {
    dimensions,
    ratings,
    max = 5,
    unratedLabel,
  }: {
    dimensions: PublicDimension[];
    ratings: Record<string, number>;
    max?: number;
    unratedLabel: string;
  } = $props();

  const C = 100;
  const R = 62;
  const LABEL_R = 76;

  const n = $derived(dimensions.length);
  const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const at = (i: number, r: number) => ({ x: C + r * Math.cos(angle(i)), y: C + r * Math.sin(angle(i)) });
  const pts = (list: { x: number; y: number }[]) => list.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  const rings = $derived(Array.from({ length: max }, (_, k) => k + 1));
  const ringPoints = (level: number) =>
    pts(dimensions.map((_, i) => at(i, (R * level) / max)));

  // One entry per axis: the plotted point, or null for an unrated dimension.
  const points = $derived(
    dimensions.map((d, i) => {
      const v = ratings[d.id];
      return v === undefined ? null : at(i, (R * v) / max);
    }),
  );
  const complete = $derived(points.every((p) => p !== null));

  // With gaps, only join neighbouring axes that are both rated, so the outline never
  // bridges an unrated dimension.
  const segments = $derived(
    points.flatMap((p, i) => {
      const q = points[(i + 1) % points.length];
      return p && q && points.length > 2 ? [`${p.x.toFixed(1)},${p.y.toFixed(1)} ${q.x.toFixed(1)},${q.y.toFixed(1)}`] : [];
    }),
  );

  const anchor = (i: number) => {
    const c = Math.cos(angle(i));
    return Math.abs(c) < 0.2 ? "middle" : c > 0 ? "start" : "end";
  };

  const summary = $derived(
    dimensions.map((d) => `${d.name}: ${ratings[d.id] ?? unratedLabel}`).join(", "),
  );
</script>

{#if n >= 3}
  <svg viewBox="-45 -8 290 216" role="img" aria-label={summary}>
    {#each rings as level}
      <polygon class="ring" points={ringPoints(level)} />
    {/each}
    {#each dimensions as d, i (d.id)}
      {@const end = at(i, R)}
      {@const label = at(i, LABEL_R)}
      <line class="axis" x1={C} y1={C} x2={end.x} y2={end.y} />
      <text
        class="label"
        class:missing={ratings[d.id] === undefined}
        x={label.x}
        y={label.y}
        text-anchor={anchor(i)}
        dominant-baseline="middle"
      >{d.name}</text>
    {/each}

    {#if complete}
      <polygon class="shape" points={pts(points as { x: number; y: number }[])} />
    {:else}
      {#each segments as s}
        <polyline class="edge" points={s} />
      {/each}
    {/if}
    {#each points as p, i (dimensions[i]!.id)}
      {#if p}<circle class="dot" cx={p.x} cy={p.y} r="3.2" />{/if}
    {/each}
  </svg>
{/if}

<dl class="values">
  {#each dimensions as d (d.id)}
    <dt title={d.definition}>{d.name}</dt>
    <dd class:missing={ratings[d.id] === undefined}>{ratings[d.id] ?? unratedLabel}</dd>
  {/each}
</dl>

<style>
  svg { width: 100%; height: auto; display: block; overflow: visible; }
  .ring { fill: none; stroke: color-mix(in srgb, currentColor 22%, transparent); stroke-width: 0.6; }
  .axis { stroke: color-mix(in srgb, currentColor 22%, transparent); stroke-width: 0.6; }
  .shape { fill: color-mix(in srgb, var(--accent) 30%, transparent); stroke: var(--accent); stroke-width: 1.6; stroke-linejoin: round; }
  .edge { fill: none; stroke: var(--accent); stroke-width: 1.6; stroke-linecap: round; }
  .dot { fill: var(--accent); }
  .label { font-size: 10px; fill: currentColor; }
  .label.missing { opacity: 0.5; }

  .values { display: grid; grid-template-columns: auto 1fr; gap: 0.1rem 0.8rem; margin: 0.5rem 0 0; font-size: 0.9rem; }
  .values dt { color: var(--muted); }
  .values dd { margin: 0; font-variant-numeric: tabular-nums; }
  .values dd.missing { color: var(--muted); font-style: italic; }
</style>
