import { resolve } from "node:path";
import { validateContentDir } from "../validate.js";

const root = resolve(process.argv[2] ?? "../../content");
const { content, issues } = validateContentDir(root);

if (issues.length) {
  for (const i of issues) console.error(`${i.file}: ${i.message}`);
  console.error(`\n${issues.length} issue(s) in ${root}`);
  process.exit(1);
}
console.log(
  `OK: ${content.tracks.length} tracks, ${content.tags.length} tags, ` +
    `${content.facets.length} facets, ${content.dimensions.length} dimensions`,
);
