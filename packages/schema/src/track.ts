import { z } from "zod";
import { DimensionId, TagId, TrackId } from "./ids.js";
import { canonicalLink, videoIdFromTrackId } from "./url.js";

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
    lastUpdated: z.iso.datetime(),
  })
  .strict()
  .superRefine((t, ctx) => {
    const vid = videoIdFromTrackId(t.id);
    if (vid && t.link !== canonicalLink(vid)) {
      ctx.addIssue({
        code: "custom",
        path: ["link"],
        message: `link must be the cleaned form ${canonicalLink(vid)}`,
      });
    }
    if (new Set(t.tags).size !== t.tags.length) {
      ctx.addIssue({ code: "custom", path: ["tags"], message: "duplicate tags" });
    }
  });
export type Track = z.infer<typeof Track>;
