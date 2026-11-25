import { describe, expect, it } from "vitest";
import { parseProse, serializeProse } from "../src/content.js";

describe("prose round trip", () => {
  it.each([
    "plain",
    'has "quotes" inside',
    '"starts and ends with quotes"',
    "colon: inside, and 'single' ones",
    "unicode: ñ — 日本語",
  ])("preserves %s", (text) => {
    const md = serializeProse({ name: text, definition: text, notes: "Line one.\n\nLine two." });
    const p = parseProse(md)!;
    expect(p.data.name).toBe(text);
    expect(p.data.definition).toBe(text);
    expect(p.body).toBe("Line one.\n\nLine two.");
  });

  it("still reads hand-written plain frontmatter", () => {
    expect(parseProse("---\nname: Warm\ndefinition: Rounded tone.\n---\n")!.data.name).toBe("Warm");
  });
});
