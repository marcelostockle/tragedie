import { describe, expect, it } from "vitest";
import { cleanYoutubeUrl, extractVideoId } from "../src/url.js";

const ID = "0-jvmh_lMXI";
const OUT = `https://www.youtube.com/watch?v=${ID}`;

describe("cleanYoutubeUrl", () => {
  it.each([
    `https://www.youtube.com/watch?v=${ID}&si=abc&list=PL1&index=3&t=30&utm_source=x`,
    `https://music.youtube.com/watch?v=${ID}&si=abc`,
    `https://youtu.be/${ID}?si=abc&t=10`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `  https://m.youtube.com/watch?feature=share&v=${ID}  `,
  ])("canonicalizes %s", (u) => expect(cleanYoutubeUrl(u)).toBe(OUT));

  it.each([
    "not a url",
    `https://example.com/watch?v=${ID}`,
    "https://youtube.com/watch",
    "https://youtu.be/short",
  ])("rejects %s", (u) => expect(cleanYoutubeUrl(u)).toBeNull());

  it("is idempotent", () => expect(cleanYoutubeUrl(OUT)).toBe(OUT));
  it("extracts the id", () => expect(extractVideoId(OUT)).toBe(ID));
});
