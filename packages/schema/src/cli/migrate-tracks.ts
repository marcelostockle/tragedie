/**
 * One-off, idempotent migration: old tracks.json -> content/tracks/<videoId>.json.
 * Read-only on the source. Usage: tsx src/cli/migrate-tracks.ts <tracks.json> [contentDir]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { migrateTrack, type OldTrack } from "../migrate.js";

const [src, out = "../../content"] = process.argv.slice(2);
if (!src) {
  console.error("usage: migrate-tracks <tracks.json> [contentDir]");
  process.exit(2);
}

const old = JSON.parse(readFileSync(resolve(src), "utf8")) as OldTrack[];
const dir = join(resolve(out), "tracks");
mkdirSync(dir, { recursive: true });

let written = 0;
let unchanged = 0;
const errors: string[] = [];
const noteCounts = new Map<string, number>();

for (const o of old) {
  const r = migrateTrack(o);
  for (const n of r.notes) {
    const key = n.replace(/\w+=0/, "<dim>=0");
    noteCounts.set(key, (noteCounts.get(key) ?? 0) + 1);
  }
  if (!r.track) {
    errors.push(`${o.id}: ${r.error}`);
    continue;
  }
  const file = join(dir, `${r.track.id.slice(3)}.json`);
  const text = JSON.stringify(r.track, null, 2) + "\n";
  if (existsSync(file) && readFileSync(file, "utf8") === text) unchanged++;
  else {
    writeFileSync(file, text);
    written++;
  }
}

console.log(`${old.length} source tracks: ${written} written, ${unchanged} unchanged, ${errors.length} failed`);
for (const [n, c] of noteCounts) console.log(`  ${c} x ${n}`);
for (const e of errors) console.error(`FAILED ${e}`);
process.exit(errors.length ? 1 : 0);
