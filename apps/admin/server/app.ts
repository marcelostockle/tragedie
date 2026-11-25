import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { checkContent, loadContent, Track, videoIdFromTrackId } from "@tragedie/schema";

/**
 * Local admin API. Reads and writes per-entity files under `contentRoot`.
 * Every write is validated with the shared schema, including cross-references.
 */
export function createApp(contentRoot: string) {
  const app = new Hono();

  app.get("/api/content", (c) => {
    const { content, issues } = loadContent(contentRoot);
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

    const { content } = loadContent(contentRoot);
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
    return c.json(track);
  });

  return app;
}

function writeAtomic(path: string, text: string) {
  mkdirSync(join(path, ".."), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
}
