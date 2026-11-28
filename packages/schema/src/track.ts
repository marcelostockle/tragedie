import { z } from "zod";
import { DimensionId, TagId, TrackId } from "./ids.js";
import { cleanYoutubeUrl } from "./url.js";

/** Ratings are a discrete 1–5 scale. */
export const RATING_MAX = 5;
export const Rating = z.number().int().min(1).max(RATING_MAX);

export const Track = z
  .object({
    id: TrackId,
    title: z.string().min(1),
    artists: z.array(z.string().min(1)),
    album: z.string().optional(),
    link: z.string(),
    tags: z.array(TagId).default([]),
    ratings: z.record(DimensionId, Rating).default({}),
    pinned: z.boolean().default(false),
    /** Absent on a few migrated tracks that never had one. */
    lastUpdated: z.iso.datetime().optional(),
  })
  .strict()
  .superRefine((t, ctx) => {
    // The id is the stable identity. The link may point at a different video, because
    // uploads get taken down and re-uploaded. It only has to be in cleaned form.
    if (t.link !== cleanYoutubeUrl(t.link)) {
      ctx.addIssue({
        code: "custom",
        path: ["link"],
        message: "link must be the cleaned form https://www.youtube.com/watch?v=<id>",
      });
    }
    if (new Set(t.tags).size !== t.tags.length) {
      ctx.addIssue({ code: "custom", path: ["tags"], message: "duplicate tags" });
    }
  });
export type Track = z.infer<typeof Track>;

/**
 * The exact text of a track file. Key order is the schema's, so every writer (the admin and
 * the public tagger) produces the same bytes and git diffs stay limited to real changes.
 */
export function serializeTrack(track: Track): string {
  const ordered: Track = {
    id: track.id,
    title: track.title,
    artists: track.artists,
    ...(track.album !== undefined ? { album: track.album } : {}),
    link: track.link,
    tags: track.tags,
    ratings: track.ratings,
    pinned: track.pinned,
    ...(track.lastUpdated !== undefined ? { lastUpdated: track.lastUpdated } : {}),
  };
  return JSON.stringify(ordered, null, 2) + "\n";
}
