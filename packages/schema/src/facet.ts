import { z } from "zod";
import { FacetId } from "./ids.js";
import { LocalizedString } from "./locale.js";

/** A facet is an aspect of a song being described (genre, rhythm, timbre, ...). */
export const Facet = z.object({
  id: FacetId,
  name: LocalizedString,
  definition: LocalizedString,
});
export type Facet = z.infer<typeof Facet>;

export const FacetsFile = z.array(Facet);
