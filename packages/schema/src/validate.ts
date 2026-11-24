import { loadContent, type Content, type Issue } from "./content.js";
import { SOURCE_LOCALE } from "./locale.js";
import { videoIdFromTrackId } from "./url.js";

const dupes = <T>(items: T[], key: (t: T) => string) => {
  const seen = new Set<string>();
  const out = new Set<string>();
  for (const i of items) (seen.has(key(i)) ? out : seen).add(key(i));
  return [...out];
};

/** Cross-reference checks. The build fails on any issue. */
export function checkContent(c: Content): Issue[] {
  const issues: Issue[] = [];
  const add = (file: string, message: string) => issues.push({ file, message });

  const facetIds = new Set(c.facets.map((f) => f.id));
  const dimIds = new Set(c.dimensions.map((d) => d.id));
  const tagIds = new Set(c.tags.map((t) => t.file.id));
  const trackIds = new Set(c.tracks.map((t) => t.id));

  for (const id of dupes(c.facets, (f) => f.id)) add("facets.json", `duplicate facet id: ${id}`);
  for (const id of dupes(c.dimensions, (d) => d.id))
    add("dimensions.json", `duplicate dimension id: ${id}`);
  for (const id of dupes(c.tracks, (t) => t.id)) add("tracks", `duplicate track id: ${id}`);

  for (const t of c.tracks) {
    const f = `tracks/${videoIdFromTrackId(t.id)}.json`;
    for (const tag of t.tags) if (!tagIds.has(tag)) add(f, `unknown tag: ${tag}`);
    for (const dim of Object.keys(t.ratings))
      if (!dimIds.has(dim)) add(f, `rating on unknown dimension: ${dim}`);
  }

  const names = new Map<string, string>();
  for (const t of c.tags) {
    const f = `tags/${t.dir}`;
    if (!facetIds.has(t.file.facet)) add(`${f}/tag.json`, `unknown facet: ${t.file.facet}`);
    const src = t.prose[SOURCE_LOCALE];
    if (!src) {
      add(`${f}/${SOURCE_LOCALE}.md`, `missing definition in source locale (${SOURCE_LOCALE})`);
    } else {
      const key = `${t.file.facet}\u0000${src.name.toLowerCase()}`;
      const clash = names.get(key);
      if (clash) add(`${f}/${SOURCE_LOCALE}.md`, `name "${src.name}" already used in this facet by ${clash}`);
      else names.set(key, t.file.id);
    }
    for (const ex of t.file.examples)
      if (!trackIds.has(ex.trackId)) add(`${f}/tag.json`, `example track not found: ${ex.trackId}`);
    for (const r of t.file.related) {
      if (!tagIds.has(r.target)) add(`${f}/tag.json`, `related tag not found: ${r.target}`);
      if (r.target === t.file.id) add(`${f}/tag.json`, "tag relates to itself");
    }
  }
  return issues;
}

/** Load, shape-validate and cross-check a content directory. */
export function validateContentDir(root: string): { content: Content; issues: Issue[] } {
  const { content, issues } = loadContent(root);
  return { content, issues: [...issues, ...checkContent(content)] };
}
