import { describe, expect, it } from "vitest";
import { migrateTrack } from "../src/migrate.js";

const base = {
  id: "yt:0-jvmh_lMXI",
  title: "T",
  artists: ["A"],
  album: "",
  link: "https://www.youtube.com/watch?v=0-jvmh_lMXI&si=x",
  tags: ["old-tag"],
};

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
    expect(r.track!.ratings).toEqual({ bass: 4 });
  });
  it("reports a non-YouTube link", () => {
    expect(migrateTrack({ ...base, link: "https://example.com" }).error).toBeDefined();
  });
  it("keeps a missing lastUpdated missing", () => {
    expect(migrateTrack(base as never).track!.lastUpdated).toBeUndefined();
  });
});
