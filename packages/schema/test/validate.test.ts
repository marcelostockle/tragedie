import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateContentDir } from "../src/validate.js";

const ID = "0-jvmh_lMXI";
const made: string[] = [];
afterEach(() => made.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

function fixture(over: { track?: object; tagMd?: string | null; example?: string } = {}) {
  const root = mkdtempSync(join(tmpdir(), "tragedie-"));
  made.push(root);
  const w = (p: string, s: string) => {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    writeFileSync(join(root, p), s);
  };
  w("facets.json", JSON.stringify([{ id: "timbre", name: { en: "Timbre" }, definition: { en: "Tone colour." } }]));
  w("dimensions.json", JSON.stringify([{ id: "bass", name: { en: "Bass" }, definition: { en: "Low end." } }]));
  w(
    `tracks/${ID}.json`,
    JSON.stringify({
      id: `yt:${ID}`,
      title: "T",
      artists: ["A"],
      link: `https://www.youtube.com/watch?v=${ID}`,
      tags: ["warm.timbre"],
      ratings: { bass: 4 },
      lastUpdated: "2026-11-24T00:00:00Z",
      ...over.track,
    }),
  );
  w(
    "tags/warm.timbre/tag.json",
    JSON.stringify({
      id: "warm.timbre",
      facet: "timbre",
      examples: [{ trackId: over.example ?? `yt:${ID}` }],
    }),
  );
  if (over.tagMd !== null)
    w(
      "tags/warm.timbre/en.md",
      over.tagMd ?? "---\nname: Warm\ndefinition: Rounded, low-mid heavy tone.\n---\nNotes.\n",
    );
  return root;
}

const msgs = (root: string) => validateContentDir(root).issues.map((i) => i.message);

describe("validateContentDir", () => {
  it("accepts valid content", () => {
    expect(validateContentDir(fixture()).issues).toEqual([]);
  });
  it("rejects non-cleaned links", () => {
    expect(msgs(fixture({ track: { link: `https://youtu.be/${ID}` } })).join()).toContain("cleaned form");
  });
  it("allows a link that points at a different video than the id", () => {
    const link = "https://www.youtube.com/watch?v=Ay4AulRg2tY";
    expect(validateContentDir(fixture({ track: { link } })).issues).toEqual([]);
  });
  it("rejects out-of-range ratings", () => {
    expect(msgs(fixture({ track: { ratings: { bass: 6 } } })).length).toBeGreaterThan(0);
  });
  it("rejects unknown dimensions", () => {
    expect(msgs(fixture({ track: { ratings: { nope: 5 } } })).join()).toContain("unknown dimension");
  });
  it("rejects unknown tags", () => {
    expect(msgs(fixture({ track: { tags: ["ghost"] } })).join()).toContain("unknown tag");
  });
  it("requires a source-locale definition", () => {
    expect(msgs(fixture({ tagMd: null })).join()).toContain("source locale");
  });
  it("rejects examples pointing at missing tracks", () => {
    expect(msgs(fixture({ example: "yt:AAAAAAAAAAA" })).join()).toContain("example track not found");
  });
});
