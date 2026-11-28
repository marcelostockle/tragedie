import { RATING_MAX, type PublicTrack, type Track } from "@tragedie/schema/browser";

/** What the tagger lets you change on a track. Everything else stays as published. */
export interface Draft {
  tags: string[];
  ratings: Record<string, number>;
  pinned: boolean;
}

export const baseline = (t: PublicTrack): Draft => ({ tags: t.tags, ratings: t.ratings, pinned: t.pinned });

/** Tags compare as a set (order is not a change); ratings compare key by key. */
export function sameDraft(a: Draft, b: Draft): boolean {
  if (a.pinned !== b.pinned) return false;
  if (a.tags.length !== b.tags.length || !a.tags.every((t) => b.tags.includes(t))) return false;
  const keys = Object.keys(a.ratings);
  return keys.length === Object.keys(b.ratings).length && keys.every((k) => a.ratings[k] === b.ratings[k]);
}

/** The full track as it should be written back to `content/tracks/`. */
export function toTrack(t: PublicTrack, d: Draft, now: Date): Track {
  return {
    id: t.id,
    title: t.title,
    artists: t.artists,
    ...(t.album ? { album: t.album } : {}),
    link: t.link,
    tags: d.tags,
    ratings: d.ratings,
    pinned: d.pinned,
    lastUpdated: now.toISOString(),
  };
}

/** `yt:<videoId>` -> the file's name under content/tracks. */
export const trackFile = (id: string) => `tracks/${id.slice(3)}.json`;

/**
 * Read a draft back from storage. Anything unrecognised is dropped rather than trusted, so a
 * stale draft can never produce a file the validator would reject.
 */
export function sanitize(
  raw: unknown,
  knownTags: Set<string>,
  knownDimensions: Set<string>,
  /** Drafts saved before `pinned` was editable have none: keep the track's own. */
  pinnedFallback = false,
): Draft | null {
  if (typeof raw !== "object" || raw === null) return null;
  const { tags, ratings, pinned } = raw as { tags?: unknown; ratings?: unknown; pinned?: unknown };
  if (!Array.isArray(tags) || typeof ratings !== "object" || ratings === null) return null;
  const cleanTags = [...new Set(tags.filter((x): x is string => typeof x === "string" && knownTags.has(x)))];
  const cleanRatings: Record<string, number> = {};
  for (const [dim, v] of Object.entries(ratings)) {
    if (knownDimensions.has(dim) && Number.isInteger(v) && (v as number) >= 1 && (v as number) <= RATING_MAX) {
      cleanRatings[dim] = v as number;
    }
  }
  return { tags: cleanTags, ratings: cleanRatings, pinned: typeof pinned === "boolean" ? pinned : pinnedFallback };
}
