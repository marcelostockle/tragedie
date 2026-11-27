import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../server/app.js";
import { fromOembed, fromSpotify, fromYoutubeMusic, lookup, parseMeta, spotifyTrackId } from "../server/lookup.js";

const YTM = `<meta property="og:title" content="Don&#39;t Stop Me Now"><meta property="og:description" content="Queen">`;
const SPOTIFY = `<meta property="og:title" content="Never Gonna Give You Up">
<meta property="og:description" content="Rick Astley · Whenever You Need Somebody · Song · 1987">
<meta name="music:release_date" content="1987-11-12">
<meta name="music:musician_description" content="Rick Astley">`;

/** A fetch that answers from a URL-prefix table and 404s everything else. */
const fakeFetch = (table: Record<string, string>) =>
  (async (input: RequestInfo | URL) => {
    const url = String(input);
    const hit = Object.entries(table).find(([prefix]) => url.startsWith(prefix));
    return hit ? new Response(hit[1]) : new Response("", { status: 404 });
  }) as typeof fetch;

describe("metadata parsing", () => {
  it("reads meta tags and decodes entities", () => {
    expect(parseMeta(YTM).get("og:title")).toEqual(["Don't Stop Me Now"]);
  });

  it("takes title and artist from a YouTube Music page", () => {
    expect(fromYoutubeMusic(YTM)).toEqual({ title: "Don't Stop Me Now", artists: ["Queen"] });
  });

  it("ignores a video description in place of an artist", () => {
    const html = `<meta property="og:title" content="A cover"><meta property="og:description" content="${"long ".repeat(30)}">`;
    expect(fromYoutubeMusic(html)).toEqual({ title: "A cover", artists: [] });
  });

  it("drops the ' - Topic' suffix from oEmbed channels", () => {
    expect(fromOembed({ title: "T", author_name: "Queen - Topic" })).toEqual({ title: "T", artists: ["Queen"] });
  });

  it("reads Spotify's title, artists, album and year", () => {
    expect(fromSpotify(SPOTIFY)).toEqual({
      title: "Never Gonna Give You Up",
      artists: ["Rick Astley"],
      album: "Whenever You Need Somebody",
      year: "1987",
    });
  });

  it("finds Spotify track ids", () => {
    expect(spotifyTrackId("https://open.spotify.com/intl-es/track/4cOdK2wGLETKBW3PvgPWqT?si=x")).toBe("4cOdK2wGLETKBW3PvgPWqT");
    expect(spotifyTrackId("https://open.spotify.com/album/5Z9iiGl2FcIfa3BMiv6OIw")).toBeNull();
  });
});

describe("lookup", () => {
  const f = fakeFetch({
    "https://music.youtube.com/watch": YTM,
    "https://www.youtube.com/oembed": JSON.stringify({ title: "Raw title", author_name: "Queen - Topic" }),
    "https://open.spotify.com/track/": SPOTIFY,
  });

  it("prefers YouTube Music and returns the video id", async () => {
    expect(await lookup("https://youtu.be/1UjLFMg18cY", f)).toEqual({
      source: "youtube",
      videoId: "1UjLFMg18cY",
      title: "Don't Stop Me Now",
      artists: ["Queen"],
    });
  });

  it("falls back to oEmbed when the music page has nothing", async () => {
    const only = fakeFetch({ "https://www.youtube.com/oembed": JSON.stringify({ title: "Raw", author_name: "Queen - Topic" }) });
    expect(await lookup("https://www.youtube.com/watch?v=1UjLFMg18cY", only)).toMatchObject({ title: "Raw", artists: ["Queen"] });
  });

  it("has no video id for Spotify links", async () => {
    const r = await lookup("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT", f);
    expect(r).toMatchObject({ source: "spotify", album: "Whenever You Need Somebody" });
    expect(r.videoId).toBeUndefined();
  });

  it("rejects other links and unknown videos", async () => {
    await expect(lookup("https://example.com/x", f)).rejects.toThrow(/Not a YouTube/);
    await expect(lookup("https://youtu.be/1UjLFMg18cY", fakeFetch({}))).rejects.toThrow(/did not return/);
  });
});

describe("POST /api/tracks", () => {
  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "tragedie-add-"));
    const w = (p: string, v: unknown) => {
      mkdirSync(join(root, p, ".."), { recursive: true });
      writeFileSync(join(root, p), JSON.stringify(v));
    };
    w("facets.json", [{ id: "timbre", name: { en: "Timbre" }, definition: { en: "x." } }]);
    w("dimensions.json", [{ id: "bass", name: { en: "Bass" }, definition: { en: "x." } }]);
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const post = (app: ReturnType<typeof createApp>, path: string, body: unknown) =>
    app.request(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  it("creates a track from any YouTube link form, with a cleaned link", async () => {
    const app = createApp(root);
    const res = await post(app, "/api/tracks", {
      link: "https://music.youtube.com/watch?v=1UjLFMg18cY&list=PLx",
      title: "Don't Stop Me Now",
      artists: ["Queen"],
      album: "Jazz",
    });
    expect(res.status).toBe(201);
    const saved = JSON.parse(readFileSync(join(root, "tracks/1UjLFMg18cY.json"), "utf8"));
    expect(saved).toMatchObject({
      id: "yt:1UjLFMg18cY",
      link: "https://www.youtube.com/watch?v=1UjLFMg18cY",
      tags: [],
      ratings: {},
      pinned: false,
      album: "Jazz",
    });
    expect(saved.lastUpdated).toBeTruthy();
  });

  it("refuses duplicates, non-YouTube links and blank titles", async () => {
    const app = createApp(root);
    const body = { link: "https://youtu.be/1UjLFMg18cY", title: "T", artists: [] };
    expect((await post(app, "/api/tracks", body)).status).toBe(201);
    expect((await post(app, "/api/tracks", body)).status).toBe(409);
    expect((await post(app, "/api/tracks", { ...body, link: "https://open.spotify.com/track/x" })).status).toBe(400);
    expect((await post(app, "/api/tracks", { ...body, link: "https://youtu.be/AAAAAAAAAAA", title: "" })).status).toBe(400);
    expect(existsSync(join(root, "tracks/AAAAAAAAAAA.json"))).toBe(false);
  });

  it("serves lookups through the injected fetch", async () => {
    const app = createApp(root, fakeFetch({ "https://music.youtube.com/watch": YTM }));
    const res = await post(app, "/api/lookup", { url: "https://youtu.be/1UjLFMg18cY" });
    expect(await res.json()).toMatchObject({ videoId: "1UjLFMg18cY", title: "Don't Stop Me Now" });
    expect((await post(app, "/api/lookup", { url: "nope" })).status).toBe(422);
    expect((await post(app, "/api/lookup", {})).status).toBe(400);
  });
});
