import { RELATION_TYPES, SOURCE_LOCALE, type Locale } from "@tragedie/schema/browser";

/**
 * Interface copy. `en` is the source: its shape defines `Strings`, and every other locale
 * is typed against it, so a missing key is a compile error, not a blank on the page.
 *
 * Track titles and artist names are data and are never translated. Tag, facet and
 * dimension names come from the content dictionaries, not from here.
 *
 * `{n}`-style placeholders are filled by `fmt`.
 */
const en = {
  siteTitle: "tragedie",
  nav: { library: "Library", tags: "Tags", language: "Language" },

  library: {
    title: "Library",
    search: "Search title, artist or album",
    sortBy: "Sort by",
    sortTitle: "Title",
    filterTags: "Filter by tag",
    noTagsInUse: "No tag is in use yet.",
    clearTags: "Clear tags",
    showing: "{shown} of {total} tracks",
    noResults: "No tracks match.",
    loading: "Loading…",
    loadError: "Could not load the library.",
    hint: "Hover a track to preview it. Click to lock it.",
    lock: "Lock",
    unlock: "Unlock",
    openOnYoutube: "Open on YouTube",
    tags: "Tags",
    noTags: "Not tagged yet.",
    ratings: "Ratings",
    unrated: "not rated",
    pinned: "Pinned",
  },

  tags: {
    title: "Tags",
    intro: "Every tag is a concept with a definition. Read what it means, and what it doesn't.",
    countTracks: "{n} tracks",
    countOne: "1 track",
    facet: "Facet",
    notes: "Notes",
    related: "Related tags",
    sameWord: "The same word in other facets",
    examples: "Examples",
    noExamples: "No examples yet.",
    tracksWith: "Tracks with this tag",
    noTracks: "No track carries this tag yet.",
    viewInLibrary: "See all in the library",
    moreTracks: "…and {n} more",
    shownInSource: "Not translated yet: shown in English.",
    back: "All tags",
  },

  relations: {
    contrasts: "Contrasts with",
    "often-with": "Often found with",
    broader: "Broader",
    narrower: "Narrower",
    "not-to-be-confused-with": "Not to be confused with",
  } satisfies Record<(typeof RELATION_TYPES)[number], string>,
};

export type Strings = typeof en;

const es: Strings = {
  siteTitle: "tragedie",
  nav: { library: "Biblioteca", tags: "Etiquetas", language: "Idioma" },

  library: {
    title: "Biblioteca",
    search: "Buscar por título, artista o álbum",
    sortBy: "Ordenar por",
    sortTitle: "Título",
    filterTags: "Filtrar por etiqueta",
    noTagsInUse: "Todavía no se usa ninguna etiqueta.",
    clearTags: "Quitar etiquetas",
    showing: "{shown} de {total} pistas",
    noResults: "Ninguna pista coincide.",
    loading: "Cargando…",
    loadError: "No se pudo cargar la biblioteca.",
    hint: "Pasa el cursor sobre una pista para verla. Haz clic para fijarla.",
    lock: "Fijar",
    unlock: "Soltar",
    openOnYoutube: "Abrir en YouTube",
    tags: "Etiquetas",
    noTags: "Aún sin etiquetas.",
    ratings: "Valoraciones",
    unrated: "sin valorar",
    pinned: "Destacada",
  },

  tags: {
    title: "Etiquetas",
    intro: "Cada etiqueta es un concepto con una definición. Lee lo que significa, y lo que no.",
    countTracks: "{n} pistas",
    countOne: "1 pista",
    facet: "Faceta",
    notes: "Notas",
    related: "Etiquetas relacionadas",
    sameWord: "La misma palabra en otras facetas",
    examples: "Ejemplos",
    noExamples: "Aún no hay ejemplos.",
    tracksWith: "Pistas con esta etiqueta",
    noTracks: "Ninguna pista tiene esta etiqueta todavía.",
    viewInLibrary: "Ver todas en la biblioteca",
    moreTracks: "…y {n} más",
    shownInSource: "Aún sin traducir: se muestra en inglés.",
    back: "Todas las etiquetas",
  },

  relations: {
    contrasts: "Contrasta con",
    "often-with": "Suele aparecer con",
    broader: "Más general",
    narrower: "Más específica",
    "not-to-be-confused-with": "No confundir con",
  },
};

const all: Record<Locale, Strings> = { en, es };

export const strings = (locale: Locale): Strings => all[locale] ?? all[SOURCE_LOCALE];

/** Fill `{name}` placeholders. */
export const fmt = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));

/** Endonyms: a language is always named in itself, so these are not translated. */
export const LOCALE_NAMES: Record<Locale, string> = { en: "English", es: "Español" };
