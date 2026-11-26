import { z } from "zod";
import { DimensionId } from "./ids.js";
import { LocalizedString } from "./locale.js";

/** Rating dimensions are data. The id is stable: renaming it orphans stored ratings. */
export const Dimension = z.object({
  id: DimensionId,
  name: LocalizedString,
  definition: LocalizedString,
});
export type Dimension = z.infer<typeof Dimension>;

export const DimensionsFile = z.array(Dimension);
