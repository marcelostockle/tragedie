import { describe, expect, it } from "vitest";
import type { Content } from "../src/content.js";
import { buildPublicData } from "../src/public.js";

const content: Content = {
  facets: [{ id: "mood", name: { en: "Mood", es: "Ánimo" }, definition: { en: "Feel." } }],
  dimensions: [{ id: "bass", name: { en: "Bass" }, definition: { en: "Low end." } }],
  tracks: [
    { id: "yt:bbbbbbbbbbb", title: "B", artists: ["X"], link: "l", tags: ["warm.mood"], ratings: { bass: 3 }, pinned: false },
    { id: "yt:aaaaaaaaaaa", title: "A", artists: ["Y"], album: "Alb", link: "l", tags: ["warm.mood", "calm.mood"], ratings: {}, pinned: true },
  ],
  tags: [
    {
      dir: "warm.mood",
      file: { id: "warm.mood", facet: "mood", sameWord: "warm", examples: [], related: [{ type: "contrasts", target: "calm.mood" }] },
      prose: {
        en: { name: "Warm", definition: "Cosy.", notes: "English notes." },
        es: { name: "Cálido", definition: "Acogedor.", notes: "" },
      },
    },
    {
      dir: "calm.mood",
      file: { id: "calm.mood", facet: "mood", examples: [], related: [] },
      prose: { en: { name: "Calm", definition: "Still.", notes: "" } },
    },
  ],
};

describe("buildPublicData", () => {
  const data = buildPublicData(content);

  it("ships tracks once, sorted by id, without untranslatable noise", () => {
    expect(data.tracks.map((t) => t.id)).toEqual(["yt:aaaaaaaaaaa", "yt:bbbbbbbbbbb"]);
    expect(data.tracks[0]).toMatchObject({ album: "Alb", pinned: true });
    expect(data.tracks[1]).not.toHaveProperty("album");
  });

  it("keeps unrated dimensions absent", () => {
    expect(data.tracks[1]!.ratings).toEqual({ bass: 3 });
    expect(data.tracks[0]!.ratings).toEqual({});
  });

  it("uses the locale's own text and falls back per field", () => {
    const es = data.dictionaries.es;
    expect(es.facets[0]!.name).toBe("Ánimo");
    expect(es.facets[0]!.definition).toBe("Feel."); // no es definition: source locale
    const warm = es.tags.find((t) => t.id === "warm.mood")!;
    expect(warm.name).toBe("Cálido");
    expect(warm.notes).toBe("English notes."); // empty es notes fall back
    expect(warm.fallback).toBe(false);
  });

  it("flags tags that have no translation", () => {
    const calm = data.dictionaries.es.tags.find((t) => t.id === "calm.mood")!;
    expect(calm).toMatchObject({ name: "Calm", fallback: true });
    expect(data.dictionaries.en.tags.every((t) => !t.fallback)).toBe(true);
  });

  it("counts tracks per tag and keeps relations", () => {
    const tags = data.dictionaries.en.tags;
    expect(tags.find((t) => t.id === "warm.mood")).toMatchObject({ count: 2, sameWord: "warm" });
    expect(tags.find((t) => t.id === "calm.mood")!.count).toBe(1);
    expect(tags.find((t) => t.id === "warm.mood")!.related).toEqual([{ type: "contrasts", target: "calm.mood" }]);
  });
});
