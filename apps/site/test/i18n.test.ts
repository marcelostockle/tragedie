import { LOCALES, SOURCE_LOCALE } from "@tragedie/schema/browser";
import { describe, expect, it } from "vitest";
import { isLocale, localePath, switchLocale } from "../src/i18n/paths";
import { fmt, LOCALE_NAMES, strings } from "../src/i18n/strings";

/** Flatten nested strings to `a.b.c -> text`. */
function flat(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  return Object.entries(obj).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === "string" ? { ...acc, [key]: v } : { ...acc, ...flat(v as Record<string, unknown>, key) };
  }, {});
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("strings", () => {
  const source = flat(strings(SOURCE_LOCALE));

  it.each(LOCALES.filter((l) => l !== SOURCE_LOCALE))("%s has every key and no empty text", (locale) => {
    const own = flat(strings(locale));
    expect(Object.keys(own).sort()).toEqual(Object.keys(source).sort());
    for (const [key, text] of Object.entries(own)) expect(text.trim(), key).not.toBe("");
  });

  it.each(LOCALES)("%s keeps the same placeholders as the source", (locale) => {
    const own = flat(strings(locale));
    for (const [key, text] of Object.entries(source)) {
      expect(placeholders(own[key]!), key).toEqual(placeholders(text));
    }
  });

  it("names every locale in itself", () => {
    expect(Object.keys(LOCALE_NAMES).sort()).toEqual([...LOCALES].sort());
  });

  it("fills placeholders and leaves unknown ones visible", () => {
    expect(fmt("{a} of {b}", { a: 2, b: 5 })).toBe("2 of 5");
    expect(fmt("{a} of {b}", { a: 2 })).toBe("2 of {b}");
  });
});

describe("paths", () => {
  it("builds locale paths with a trailing slash", () => {
    expect(localePath("en")).toBe("/en/");
    expect(localePath("es", "tags")).toBe("/es/tags/");
    expect(localePath("es", "tags/warm.mood")).toBe("/es/tags/warm.mood/");
  });

  it("switches the locale and keeps the rest of the path", () => {
    expect(switchLocale("/en/", "es")).toBe("/es/");
    expect(switchLocale("/en/tags/warm.mood/", "es")).toBe("/es/tags/warm.mood/");
  });

  it("falls back to the locale home for paths without a locale", () => {
    expect(switchLocale("/", "es")).toBe("/es/");
  });

  it("recognises locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});
