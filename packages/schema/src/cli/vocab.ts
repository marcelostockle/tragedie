/**
 * Compact, read-only summary of the tag vocabulary, for people and agents.
 * Usage: tsx src/cli/vocab.ts [--facet <id>] [--json]
 */
import { resolve } from "node:path";
import { SOURCE_LOCALE } from "../locale.js";
import { loadContent } from "../content.js";

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(`--${n}`);
const facetFilter = args[args.indexOf("--facet") + 1] && args.includes("--facet") ? args[args.indexOf("--facet") + 1] : undefined;

const { content } = loadContent(resolve(process.env.CONTENT_DIR ?? "../../content"));

const uses = new Map<string, number>();
for (const t of content.tracks) for (const id of t.tags) uses.set(id, (uses.get(id) ?? 0) + 1);

const rows = content.tags
  .filter((t) => !facetFilter || t.file.facet === facetFilter)
  .map((t) => ({
    id: t.file.id,
    facet: t.file.facet,
    name: t.prose[SOURCE_LOCALE]?.name ?? "",
    definition: t.prose[SOURCE_LOCALE]?.definition ?? "",
    sameWord: t.file.sameWord,
    related: t.file.related.map((r) => `${r.type}:${r.target}`),
    examples: t.file.examples.length,
    usedBy: uses.get(t.file.id) ?? 0,
    locales: Object.keys(t.prose),
  }));

if (flag("json")) {
  console.log(JSON.stringify({ facets: content.facets, tags: rows }, null, 2));
} else {
  console.log(`Facets (${content.facets.length}):`);
  for (const f of content.facets) {
    const n = content.tags.filter((t) => t.file.facet === f.id).length;
    console.log(`  ${f.id} (${n} tags): ${f.definition[SOURCE_LOCALE]}`);
  }
  console.log(`\nTags (${rows.length}${facetFilter ? `, facet=${facetFilter}` : ""}):`);
  for (const r of rows) {
    console.log(`  ${r.id} [${r.facet}] "${r.name}"${r.sameWord ? ` ~${r.sameWord}` : ""}`);
    console.log(`      ${r.definition}`);
    const bits = [
      r.related.length ? `related: ${r.related.join(", ")}` : "",
      `${r.examples} example(s)`,
      `${r.usedBy} track(s)`,
      `locales: ${r.locales.join("/")}`,
    ].filter(Boolean);
    console.log(`      ${bits.join(" · ")}`);
  }
  if (!rows.length) console.log("  (none yet)");
}
