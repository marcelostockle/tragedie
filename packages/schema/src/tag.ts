import { z } from "zod";
import { FacetId, TagId, TrackId } from "./ids.js";

export const RELATION_TYPES = [
  "contrasts",
  "often-with",
  "broader",
  "narrower",
  "not-to-be-confused-with",
] as const;

export const TagExample = z
  .object({
    trackId: TrackId,
    note: z.string().optional(),
    start: z.number().nonnegative().optional(),
    end: z.number().nonnegative().optional(),
  })
  .strict()
  .refine((e) => e.start === undefined || e.end === undefined || e.end > e.start, {
    message: "end must be after start",
  });

export const TagRelation = z
  .object({ type: z.enum(RELATION_TYPES), target: TagId })
  .strict();

/** Structure of a tag (a concept). Prose lives in `<locale>.md` beside it. */
export const TagFile = z
  .object({
    id: TagId,
    facet: FacetId,
    /** Groups homonyms so the site can say "X also means...". */
    sameWord: z.string().min(1).optional(),
    examples: z.array(TagExample).default([]),
    related: z.array(TagRelation).default([]),
  })
  .strict();
export type TagFile = z.infer<typeof TagFile>;

/** Per-locale prose, parsed from `<locale>.md`. */
export const TagProse = z.object({
  name: z.string().min(1),
  definition: z.string().min(1),
  notes: z.string().default(""),
});
export type TagProse = z.infer<typeof TagProse>;
