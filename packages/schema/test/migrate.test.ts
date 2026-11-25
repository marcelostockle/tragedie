import { describe, expect, it } from "vitest";
import { migrateTrack, rescaleRating } from "../src/migrate.js";

const base = {
  id: "yt:0-jvmh_lMXI",
  title: "T",
  artists: ["A"],
  album: "",
  link: "https://www.youtube.com/watch?v=0-jvmh_lMXI&si=x",
  tags: ["old-tag"],
};

it.each([[1,1],[2,1],[3,1],[4,2],[5,2],[6,3],[7,3],[8,4],[9,4],[10,5]])(
  "rescales %i to %i",
  (from, to) => expect(rescaleRating(from)).toBe(to),
);

describe("migrateTrack", () => {
  it("cleans links, omits empty album, never carries tags", () => {
    const r = migrateTrack(base as never);
    expect(r.error).toBeUndefined();
    expect(r.track!.link).toBe("https://www.youtube.com/watch?v=0-jvmh_lMXI");
    expect(r.track).not.toHaveProperty("album");
    expect(r.track!.tags).toEqual([]);
  });
  it("drops zero ratings as unset", () => {
    const r = migrateTrack({ ...base, ratings: { cadence: 0, bass: 4 } });
    expect(r.track!.ratings).toEqual({ bass: 2 });
  });
  it("reports a non-YouTube link", () => {
    expect(migrateTrack({ ...base, link: "https://example.com" }).error).toBeDefined();
  });
  it("keeps a missing lastUpdated missing", () => {
    expect(migrateTrack(base as never).track!.lastUpdated).toBeUndefined();
  });
});
