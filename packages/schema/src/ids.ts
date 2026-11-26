import { z } from "zod";
import { isVideoId } from "./url.js";

/**
 * PRELIMINARY id scheme (see manifest §5): lowercase slug segments joined by `.` or `-`,
 * e.g. `warm.timbre`. Defined here once so it can change in one place.
 */
export const SLUG = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

export const SlugId = z.string().regex(SLUG, "must be a lowercase slug (a-z, 0-9, '.' or '-')");

export const TrackId = z
  .string()
  .refine((s) => s.startsWith("yt:") && isVideoId(s.slice(3)), "must be yt:<11-char videoId>");

export const TagId = SlugId;
export const FacetId = SlugId;
export const DimensionId = SlugId;
