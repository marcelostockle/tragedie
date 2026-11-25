import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../server/app.js";

const ID = "Pq9syWwgSEA";
let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "tragedie-admin-"));
  cpSync(resolve(__dirname, "../../../content"), root, { recursive: true });
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
    expect(data.tracks.length).toBe(1267);
    expect(data.dimensions.length).toBe(5);
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
