import { LOCALES, type Locale } from "@tragedie/schema/browser";
import { publicData } from "../../lib/content";

export function getStaticPaths() {
  return LOCALES.map((locale) => ({ params: { locale } }));
}

/** Names and definitions for one locale (tags, facets, dimensions). */
export function GET({ params }: { params: { locale: Locale } }) {
  return new Response(JSON.stringify(publicData.dictionaries[params.locale]), {
    headers: { "content-type": "application/json" },
  });
}
