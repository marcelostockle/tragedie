import { serializeTrack, Track, type PublicTrack } from "@tragedie/schema/browser";
import { describe, expect, it } from "vitest";
import { baseline, sameDraft, sanitize, toTrack, trackFile } from "../src/lib/drafts";
import { crc32, zip } from "../src/lib/zip";

const track: PublicTrack = {
  id: "yt:aaaaaaaaaaa",
  title: "A",
  artists: ["X", "Y"],
  album: "Alb",
  link: "https://www.youtube.com/watch?v=aaaaaaaaaaa",
  ratings: { bass: 3 },
  tags: ["warm.mood"],
  pinned: true,
};
const now = new Date("2026-11-28T10:00:00.000Z");

describe("drafts", () => {
  it("treats tag order as no change, and a different rating as a change", () => {
    const base = baseline(track);
    expect(sameDraft(base, { tags: ["warm.mood"], ratings: { bass: 3 }, pinned: true })).toBe(true);
    expect(sameDraft(base, { ...base, pinned: false })).toBe(false);
    expect(sameDraft(base, { tags: [], ratings: { bass: 3 }, pinned: true })).toBe(false);
    expect(sameDraft(base, { tags: ["warm.mood"], ratings: { bass: 4 }, pinned: true })).toBe(false);
    expect(sameDraft(base, { tags: ["warm.mood"], ratings: {}, pinned: true })).toBe(false);
    expect(sameDraft({ tags: ["a", "b"], ratings: {}, pinned: false }, { tags: ["b", "a"], ratings: {}, pinned: false })).toBe(true);
  });

  it("builds a track the schema accepts, keeping everything it was not asked to change", () => {
    const out = toTrack(track, { tags: ["warm.mood", "calm.mood"], ratings: { bass: 5 }, pinned: false }, now);
    expect(Track.parse(out)).toEqual(out);
    expect(out).toMatchObject({ title: "A", artists: ["X", "Y"], album: "Alb", pinned: false, lastUpdated: now.toISOString() });
    expect(toTrack({ ...track, album: undefined } as PublicTrack, baseline(track), now)).not.toHaveProperty("album");
  });

  it("writes files exactly as the admin does", () => {
    const text = serializeTrack(toTrack(track, baseline(track), now));
    expect(text.endsWith("}\n")).toBe(true);
    expect(Object.keys(JSON.parse(text))).toEqual(["id", "title", "artists", "album", "link", "tags", "ratings", "pinned", "lastUpdated"]);
    expect(trackFile(track.id)).toBe("tracks/aaaaaaaaaaa.json");
  });

  it("drops unknown tags, unknown dimensions and bad ratings from stored drafts", () => {
    const tags = new Set(["warm.mood"]);
    const dims = new Set(["bass"]);
    expect(sanitize({ tags: ["warm.mood", "gone.mood", "warm.mood"], ratings: { bass: 2, mix: 3 } }, tags, dims)).toEqual({
      tags: ["warm.mood"],
      ratings: { bass: 2 },
      pinned: false,
    });
    expect(sanitize({ tags: [], ratings: {}, pinned: true }, tags, dims)?.pinned).toBe(true);
    expect(sanitize({ tags: [], ratings: { bass: 0 } }, tags, dims)?.ratings).toEqual({});
    expect(sanitize({ tags: [], ratings: { bass: 2.5 } }, tags, dims)?.ratings).toEqual({});
    expect(sanitize("junk", tags, dims)).toBeNull();
    expect(sanitize({ tags: "x", ratings: {} }, tags, dims)).toBeNull();
  });
});

describe("zip", () => {
  it("computes the standard CRC-32", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("lays out an archive that lists every entry with the right sizes", () => {
    const entries = [
      { name: "tracks/a.json", text: '{"a":1}\n' },
      { name: "tracks/é.json", text: "{}\n" },
    ];
    const bytes = zip(entries, new Date(2026, 10, 28, 10, 0, 0));
    const v = new DataView(bytes.buffer);
    const end = bytes.length - 22;
    expect(v.getUint32(end, true)).toBe(0x06054b50);
    expect(v.getUint16(end + 10, true)).toBe(2);

    let at = v.getUint32(end + 16, true);
    const dec = new TextDecoder();
    for (const e of entries) {
      expect(v.getUint32(at, true)).toBe(0x02014b50);
      const size = new TextEncoder().encode(e.text).length;
      expect(v.getUint32(at + 16, true)).toBe(crc32(new TextEncoder().encode(e.text)));
      expect(v.getUint32(at + 24, true)).toBe(size);
      const nameLen = v.getUint16(at + 28, true);
      expect(dec.decode(bytes.subarray(at + 46, at + 46 + nameLen))).toBe(e.name);
      // The local header it points at carries the same name, followed by the data.
      const local = v.getUint32(at + 42, true);
      expect(v.getUint32(local, true)).toBe(0x04034b50);
      const dataAt = local + 30 + nameLen;
      expect(dec.decode(bytes.subarray(dataAt, dataAt + size))).toBe(e.text);
      at += 46 + nameLen;
    }
  });
});
