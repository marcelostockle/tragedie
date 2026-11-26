import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../server/app.js";

const ID = "Pq9syWwgSEA";
let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "tragedie-admin-"));
  // Everything is a test fixture, so editing the real vocabulary or tracks cannot break these.
  const w = (p: string, v: unknown) => {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), JSON.stringify(v));
  };
  const named = (id: string, en: string) => ({ id, name: { en }, definition: { en: `${en}.` } });
  const track = (id: string, link: string) => ({
    id: `yt:${id}`,
    title: `Track ${id}`,
    artists: ["Artist"],
    link,
    tags: [],
    ratings: { bass: 3, mix: 4 },
    pinned: false,
    lastUpdated: "2026-01-01T00:00:00.000Z",
  });
  w("facets.json", [named("timbre", "Timbre")]);
  w("dimensions.json", [named("bass", "Bass"), named("mix", "Mix")]);
  w(`tracks/${ID}.json`, track(ID, `https://www.youtube.com/watch?v=${ID}`));
  // A track whose link points at a different (re-uploaded) video than its id.
  w("tracks/W_KmrFrgJh4.json", track("W_KmrFrgJh4", "https://www.youtube.com/watch?v=Ay4AulRg2tY"));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const put = (app: ReturnType<typeof createApp>, id: string, body: unknown) =>
  app.request(`/api/tracks/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const load = async (app: ReturnType<typeof createApp>) =>
  (await app.request("/api/content")).json() as Promise<any>;

describe("admin api", () => {
  it("serves content", async () => {
    const data = await load(createApp(root));
    expect(data.tracks.length).toBe(2);
    expect(data.dimensions.length).toBe(2);
  });

  it("saves a valid edit and stamps lastUpdated", async () => {
    const app = createApp(root);
    const track = (await load(app)).tracks.find((t: any) => t.id === `yt:${ID}`);
    const res = await put(app, ID, { ...track, ratings: { ...track.ratings, bass: 5 }, pinned: true });
    expect(res.status).toBe(200);
    const saved = JSON.parse(readFileSync(join(root, `tracks/${ID}.json`), "utf8"));
    expect(saved.ratings.bass).toBe(5);
    expect(saved.pinned).toBe(true);
    expect(saved.lastUpdated).not.toBe(track.lastUpdated);
  });

  it("rejects invalid ratings without touching the file", async () => {
    const app = createApp(root);
    const track = (await load(app)).tracks.find((t: any) => t.id === `yt:${ID}`);
    const before = readFileSync(join(root, `tracks/${ID}.json`), "utf8");
    const res = await put(app, ID, { ...track, ratings: { bass: 6 } });
    expect(res.status).toBe(400);
    expect(readFileSync(join(root, `tracks/${ID}.json`), "utf8")).toBe(before);
  });

  it("rejects unknown dimensions and tags", async () => {
    const app = createApp(root);
    const track = (await load(app)).tracks.find((t: any) => t.id === `yt:${ID}`);
    expect((await put(app, ID, { ...track, ratings: { nope: 5 } })).status).toBe(422);
    expect((await put(app, ID, { ...track, tags: ["ghost"] })).status).toBe(422);
  });

  it("rejects an id/url mismatch and unknown tracks", async () => {
    const app = createApp(root);
    const track = (await load(app)).tracks.find((t: any) => t.id === `yt:${ID}`);
    expect((await put(app, "AAAAAAAAAAA", track)).status).toBe(400);
    const ghost = { ...track, id: "yt:AAAAAAAAAAA" };
    expect((await put(app, "AAAAAAAAAAA", ghost)).status).toBe(404);
  });
});

const post = (app: ReturnType<typeof createApp>, body: unknown) =>
  app.request("/api/tags", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const putTag = (app: ReturnType<typeof createApp>, id: string, body: unknown) =>
  app.request(`/api/tags/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

const warm = (over: { file?: object; prose?: object } = {}) => ({
  file: { id: "warm.timbre", facet: "timbre", ...over.file },
  prose: { en: { name: "Warm", definition: 'Rounded, "low-mid" heavy tone.', notes: "Notes." }, ...over.prose },
});

describe("tag api", () => {
  it("creates a tag and reads it back, with quotes preserved", async () => {
    const app = createApp(root);
    expect((await post(app, warm({ prose: { es: { name: "Cálido", definition: "Tono redondo." } } }))).status).toBe(200);
    const tag = (await load(app)).tags.find((t: any) => t.file.id === "warm.timbre");
    expect(tag.prose.en.definition).toBe('Rounded, "low-mid" heavy tone.');
    expect(tag.prose.es.name).toBe("Cálido");
    expect(readFileSync(join(root, "tags/warm.timbre/tag.json"), "utf8")).toContain('"facet": "timbre"');
  });

  it("updates, and removes a locale file when its prose is dropped", async () => {
    const app = createApp(root);
    await post(app, warm({ prose: { es: { name: "Cálido", definition: "x" } } }));
    const res = await putTag(app, "warm.timbre", warm({ file: { sameWord: "warm" } }));
    expect(res.status).toBe(200);
    const tag = (await load(app)).tags.find((t: any) => t.file.id === "warm.timbre");
    expect(tag.file.sameWord).toBe("warm");
    expect(tag.prose.es).toBeUndefined();
  });

  it("rejects duplicates, id changes and unknown targets", async () => {
    const app = createApp(root);
    await post(app, warm());
    expect((await post(app, warm())).status).toBe(409);
    expect((await putTag(app, "warm.timbre", warm({ file: { id: "other" } }))).status).toBe(400);
    expect((await putTag(app, "ghost", warm({ file: { id: "ghost" } }))).status).toBe(404);
  });

  it("validates facet, source-locale prose, references and name clashes", async () => {
    const app = createApp(root);
    expect((await post(app, warm({ file: { facet: "nope" } }))).status).toBe(422);
    expect((await post(app, { file: warm().file, prose: { es: { name: "a", definition: "b" } } })).status).toBe(400);
    expect((await post(app, warm({ file: { examples: [{ trackId: "yt:AAAAAAAAAAA" }] } }))).status).toBe(422);
    expect((await post(app, warm({ file: { related: [{ type: "contrasts", target: "ghost" }] } }))).status).toBe(422);
    await post(app, warm());
    const clash = await post(app, warm({ file: { id: "warm.other" } }));
    expect(clash.status).toBe(422);
    expect(existsSync(join(root, "tags/warm.other"))).toBe(false);
  });

  it("lets a track use a newly created tag", async () => {
    const app = createApp(root);
    await post(app, warm());
    const track = (await load(app)).tracks.find((t: any) => t.id === `yt:${ID}`);
    expect((await put(app, ID, { ...track, tags: ["warm.timbre"] })).status).toBe(200);
  });
});
