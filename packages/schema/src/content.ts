import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ZodType } from "zod";
import { DimensionsFile, type Dimension } from "./dimension.js";
import { FacetsFile, type Facet } from "./facet.js";
import { LOCALES, type Locale } from "./locale.js";
import { TagFile, TagProse } from "./tag.js";
import { Track } from "./track.js";

export interface Issue {
  /** Path relative to the content root. */
  file: string;
  message: string;
}

export interface LoadedTag {
  dir: string;
  file: TagFile;
  prose: Partial<Record<Locale, TagProse>>;
}

export interface Content {
  facets: Facet[];
  dimensions: Dimension[];
  tracks: Track[];
  tags: LoadedTag[];
}

/** Parse a `---` frontmatter block of single-line `key: value` pairs, then a body. */
export function parseProse(text: string): { data: Record<string, string>; body: string } | null {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!m) return null;
  const data: Record<string, string> = {};
  for (const line of m[1]!.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) return null;
    data[kv[1]!] = kv[2]!.trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return { data, body: m[2]!.trim() };
}

function readJson<T>(root: string, rel: string, schema: ZodType<T>, issues: Issue[]): T | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(root, rel), "utf8"));
  } catch (e) {
    issues.push({ file: rel, message: `cannot read JSON: ${(e as Error).message}` });
    return undefined;
  }
  const r = schema.safeParse(raw);
  if (!r.success) {
    for (const i of r.error.issues) {
      issues.push({ file: rel, message: `${i.path.join(".") || "(root)"}: ${i.message}` });
    }
    return undefined;
  }
  return r.data;
}

const dirs = (p: string) =>
  existsSync(p) ? readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()) : [];
const files = (p: string, ext: string) =>
  existsSync(p) ? readdirSync(p).filter((f) => f.endsWith(ext)) : [];

/** Load and shape-validate everything under `root`. Cross-references are checked elsewhere. */
export function loadContent(root: string): { content: Content; issues: Issue[] } {
  const issues: Issue[] = [];
  const content: Content = { facets: [], dimensions: [], tracks: [], tags: [] };

  if (existsSync(join(root, "facets.json")))
    content.facets = readJson(root, "facets.json", FacetsFile, issues) ?? [];
  if (existsSync(join(root, "dimensions.json")))
    content.dimensions = readJson(root, "dimensions.json", DimensionsFile, issues) ?? [];

  for (const f of files(join(root, "tracks"), ".json")) {
    const track = readJson(root, `tracks/${f}`, Track, issues);
    if (!track) continue;
    // Filename is the bare video id: yt:<id> -> <id>.json
    if (`${track.id.slice(3)}.json` !== f) {
      issues.push({ file: `tracks/${f}`, message: `filename must match id (${track.id})` });
    }
    content.tracks.push(track);
  }

  for (const d of dirs(join(root, "tags"))) {
    const rel = `tags/${d.name}`;
    const file = readJson(root, `${rel}/tag.json`, TagFile, issues);
    if (!file) continue;
    if (file.id !== d.name) {
      issues.push({ file: `${rel}/tag.json`, message: `id must match directory name (${d.name})` });
    }
    const prose: LoadedTag["prose"] = {};
    for (const loc of LOCALES) {
      const p = join(root, rel, `${loc}.md`);
      if (!existsSync(p)) continue;
      const parsed = parseProse(readFileSync(p, "utf8"));
      if (!parsed) {
        issues.push({
          file: `${rel}/${loc}.md`,
          message: "expected frontmatter with `name:` and `definition:`",
        });
        continue;
      }
      const r = TagProse.safeParse({ ...parsed.data, notes: parsed.body });
      if (!r.success) {
        issues.push({
          file: `${rel}/${loc}.md`,
          message: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        });
        continue;
      }
      prose[loc] = r.data;
    }
    content.tags.push({ dir: d.name, file, prose });
  }

  return { content, issues };
}
