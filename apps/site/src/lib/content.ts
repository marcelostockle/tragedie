import { resolve } from "node:path";
import { buildPublicData, validateContentDir } from "@tragedie/schema";

/**
 * Loads and validates `content/` once per build. Any validation issue fails the build, so
 * the site can never ship content that `npm run validate` rejects.
 *
 * `CONTENT_DIR` overrides the location (relative to the site package by default).
 */
const root = resolve(process.env.CONTENT_DIR ?? "../../content");
const { content, issues } = validateContentDir(root);

if (issues.length) {
  const list = issues.map((i) => `  ${i.file}: ${i.message}`).join("\n");
  throw new Error(`Content failed validation (${issues.length} issue(s)) in ${root}:\n${list}`);
}

export const publicData = buildPublicData(content);
