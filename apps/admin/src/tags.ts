import { SOURCE_LOCALE } from "@tragedie/schema/browser";
import type { LoadedTag } from "./api";

export const tagName = (t: LoadedTag) => t.prose[SOURCE_LOCALE]?.name ?? t.file.id;
export const tagDefinition = (t: LoadedTag) => t.prose[SOURCE_LOCALE]?.definition ?? "";

/** Hover text: name, facet-independent definition. */
export const tagTitle = (t: LoadedTag) => `${tagName(t)}: ${tagDefinition(t)}`;

export const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
