import { existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Hono, type Context } from "hono";
import { z } from "zod";
import {
  checkContent,
  type Content,
  loadContent,
  LOCALES,
  localized,
  serializeProse,
  TagFile,
  TagProse,
  Track,
  videoIdFromTrackId,
} from "@tragedie/schema";

const TagPayload = z.object({ file: TagFile, prose: localized(TagProse) });

/**
 * Local admin API. Reads and writes per-entity files under `contentRoot`.
 * Every write is validated with the shared schema, including cross-references.
 */
export function createApp(contentRoot: string) {
  const app = new Hono();

  // Reading ~1.3k files takes about a second, so keep the last load in memory. A page load
  // (GET /api/content) always re-reads from disk, picking up edits made outside the admin;
  // our own writes update the cache.
  let cache: Content | null = null;
  const current = (): Content => (cache ??= loadContent(contentRoot).content);

  app.get("/api/content", (c) => {
    const { content, issues } = loadContent(contentRoot);
    cache = content;
    return c.json({ ...content, issues });
  });

  app.put("/api/tracks/:videoId", async (c) => {
    const videoId = c.req.param("videoId");
    const body = (await c.req.json().catch(() => null)) as unknown;
    const parsed = Track.safeParse(body);
    if (!parsed.success) {
      return c.json({ errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, 400);
    }
    const track = { ...parsed.data, lastUpdated: new Date().toISOString() };
    if (videoIdFromTrackId(track.id) !== videoId) {
      return c.json({ errors: ["track id does not match URL"] }, 400);
    }

    const content = current();
    if (!content.tracks.some((t) => t.id === track.id)) {
      return c.json({ errors: ["track does not exist"] }, 404);
    }
    const next = { ...content, tracks: content.tracks.map((t) => (t.id === track.id ? track : t)) };
    const file = `tracks/${videoId}.json`;
    const errors = checkContent(next)
      .filter((i) => i.file === file)
      .map((i) => i.message);
    if (errors.length) return c.json({ errors }, 422);

    writeAtomic(join(contentRoot, file), JSON.stringify(track, null, 2) + "\n");
    cache = next;
    return c.json(track);
  });

  const saveTag = async (c: Context, mode: "create" | "update") => {
    const body = (await c.req.json().catch(() => null)) as unknown;
    const parsed = TagPayload.safeParse(body);
    if (!parsed.success) {
      return c.json({ errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, 400);
    }
    const { file, prose } = parsed.data;
    const urlId = c.req.param("id");
    if (mode === "update" && file.id !== urlId) {
      return c.json({ errors: ["tag id cannot be changed"] }, 400);
    }

    const content = current();
    const exists = content.tags.some((t) => t.file.id === file.id);
    if (mode === "create" && exists) return c.json({ errors: [`tag already exists: ${file.id}`] }, 409);
    if (mode === "update" && !exists) return c.json({ errors: ["tag does not exist"] }, 404);

    const loaded = { dir: file.id, file, prose };
    const tags = exists ? content.tags.map((t) => (t.file.id === file.id ? loaded : t)) : [...content.tags, loaded];
    const prefix = `tags/${file.id}/`;
    const errors = checkContent({ ...content, tags })
      .filter((i) => i.file.startsWith(prefix))
      .map((i) => `${i.file}: ${i.message}`);
    if (errors.length) return c.json({ errors }, 422);

    const dir = join(contentRoot, "tags", file.id);
    writeAtomic(join(dir, "tag.json"), JSON.stringify(file, null, 2) + "\n");
    for (const loc of LOCALES) {
      const p = prose[loc];
      const path = join(dir, `${loc}.md`);
      if (p) writeAtomic(path, serializeProse(p));
      else if (existsSync(path)) rmSync(path);
    }
    cache = { ...content, tags };
    return c.json(loaded);
  };

  app.post("/api/tags", (c) => saveTag(c, "create"));
  app.put("/api/tags/:id", (c) => saveTag(c, "update"));

  return app;
}

function writeAtomic(path: string, text: string) {
  mkdirSync(join(path, ".."), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}
