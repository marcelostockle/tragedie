import type { Content } from "./content.js";
import { LOCALES, pick, SOURCE_LOCALE, type Locale } from "./locale.js";
import type { TagFile } from "./tag.js";

/**
 * What the public site ships to the browser. Pure and browser-safe: no file access, so it
 * can be tested with plain objects and reused by any front end.
 */

/** Track metadata is data, not copy: it is not translated and ships once for all locales. */
export interface PublicTrack {
  id: string;
  title: string;
  artists: string[];
  album?: string;
  link: string;
  /** Only the dimensions that were rated. A missing key means unrated, never 0. */
  ratings: Record<string, number>;
  tags: string[];
  pinned: boolean;
}

export interface PublicFacet {
  id: string;
  name: string;
  definition: string;
}

export interface PublicDimension {
  id: string;
  name: string;
  definition: string;
}

export interface PublicTag {
  id: string;
  facet: string;
  name: string;
  definition: string;
  /** Markdown. */
  notes: string;
  sameWord?: string;
  related: TagFile["related"];
  examples: TagFile["examples"];
  /** How many tracks carry this tag. */
  count: number;
  /** True when the name and definition fell back to the source locale. */
  fallback: boolean;
}

export interface PublicDictionary {
  locale: Locale;
  /** Facets and dimensions keep the order of their files; the UI decides how to sort. */
  facets: PublicFacet[];
  dimensions: PublicDimension[];
  tags: PublicTag[];
}

export interface PublicData {
  tracks: PublicTrack[];
  dictionaries: Record<Locale, PublicDictionary>;
}

export function buildPublicData(content: Content): PublicData {
  const tracks: PublicTrack[] = [...content.tracks]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((t) => ({
      id: t.id,
      title: t.title,
      artists: t.artists,
      ...(t.album ? { album: t.album } : {}),
      link: t.link,
      ratings: t.ratings,
      tags: t.tags,
      pinned: t.pinned,
    }));

  const counts = new Map<string, number>();
  for (const t of content.tracks) for (const id of t.tags) counts.set(id, (counts.get(id) ?? 0) + 1);

  const dictionaries = Object.fromEntries(
    LOCALES.map((locale) => {
      const dict: PublicDictionary = {
        locale,
        facets: content.facets.map((f) => ({
          id: f.id,
          name: pick(f.name, locale),
          definition: pick(f.definition, locale),
        })),
        dimensions: content.dimensions.map((d) => ({
          id: d.id,
          name: pick(d.name, locale),
          definition: pick(d.definition, locale),
        })),
        tags: content.tags
          .map((t): PublicTag => {
            const own = t.prose[locale];
            const source = t.prose[SOURCE_LOCALE];
            // Validation guarantees the source locale exists; the fallbacks keep the
            // function total on content that has not been validated.
            const base = own ?? source;
            return {
              id: t.file.id,
              facet: t.file.facet,
              name: base?.name ?? t.file.id,
              definition: base?.definition ?? "",
              // Notes are optional per locale: an empty translation falls back, so a
              // locale that lags still shows something.
              notes: own?.notes || source?.notes || "",
              ...(t.file.sameWord ? { sameWord: t.file.sameWord } : {}),
              related: t.file.related,
              examples: t.file.examples,
              count: counts.get(t.file.id) ?? 0,
              fallback: !own,
            };
          })
          .sort((a, b) => a.id.localeCompare(b.id)),
      };
      return [locale, dict];
    }),
  ) as Record<Locale, PublicDictionary>;

  return { tracks, dictionaries };
}
