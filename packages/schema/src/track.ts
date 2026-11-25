import { z } from "zod";
import { DimensionId, TagId, TrackId } from "./ids.js";
import { cleanYoutubeUrl } from "./url.js";

export const Rating = z.number().int().min(1).max(10);

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
