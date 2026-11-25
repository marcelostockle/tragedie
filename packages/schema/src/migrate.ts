import { Track } from "./track.js";
import { cleanYoutubeUrl } from "./url.js";

/** Old-project fields we carry over. `tags` is deliberately never read (manifest §10). */
export interface OldTrack {
  id: string;
  title: string;
  artists: string[];
  album?: string;
  link: string;
  pinned?: boolean;
  ratings?: Record<string, number>;
  lastUpdated?: string;
}

export interface MigrationResult {
  track?: Track;
  /** Human-readable notes about anything altered or dropped. */
  notes: string[];
  error?: string;
}

/**
 * The old scale was 1–10; the new one is 1–5. Round down (floor of half), except that 1
 * stays 1: 1→1, 2–3→1, 4–5→2, 6–7→3, 8–9→4, 10→5.
 */
export const rescaleRating = (v: number) => Math.max(1, Math.floor(v / 2));

/**
 * Pure old -> new track conversion. A rating of 0 means "not set" in the old data,
 * so it is dropped rather than treated as invalid.
 */
export function migrateTrack(old: OldTrack): MigrationResult {
  const notes: string[] = [];

  const link = cleanYoutubeUrl(old.link);
  if (!link) return { notes, error: `link is not a YouTube video URL: ${old.link}` };
  if (link !== old.link) notes.push("link cleaned");

  const ratings: Record<string, number> = {};
  for (const [k, v] of Object.entries(old.ratings ?? {})) {
    if (v === 0) notes.push(`dropped unset rating ${k}=0`);
    else ratings[k] = rescaleRating(v);
  }

  const candidate = {
    id: old.id,
    title: old.title,
    artists: old.artists,
    ...(old.album ? { album: old.album } : {}),
    link,
    ratings,
    pinned: old.pinned ?? false,
    ...(old.lastUpdated ? { lastUpdated: old.lastUpdated } : {}),
  };
  const parsed = Track.safeParse(candidate);
  if (!parsed.success) {
    return {
      notes,
      error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    };
  }
  return { track: parsed.data, notes };
}
