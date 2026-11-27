import { extractVideoId } from "@tragedie/schema";

/** What we could learn about a track from a link. Every field but `artists` may be missing. */
export interface Lookup {
  source: "youtube" | "spotify";
  /** YouTube links only: the track's identity. Spotify links cannot give one. */
  videoId?: string;
  title?: string;
  artists: string[];
  album?: string;
  year?: string;
}

export class LookupError extends Error {}

const UA = "Mozilla/5.0 (compatible; tragedie-admin)";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/** All `<meta property|name=… content=…>` values, in document order. */
export function parseMeta(html: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const m of html.matchAll(/<meta\s+(?:property|name)="([^"]+)"\s+content="([^"]*)"/g)) {
    const list = out.get(m[1]!) ?? [];
    list.push(decode(m[2]!));
    out.set(m[1]!, list);
  }
  return out;
}

const first = (meta: Map<string, string[]>, key: string) => meta.get(key)?.[0];

export const spotifyTrackId = (input: string): string | null => {
  try {
    const url = new URL(input.trim());
    if (url.hostname !== "open.spotify.com") return null;
    return /\/track\/([A-Za-z0-9]{22})(?:\/|$)/.exec(url.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
};

/** YouTube Music: og:title is the clean song title, og:description is the artist. */
export function fromYoutubeMusic(html: string): Pick<Lookup, "title" | "artists"> {
  const meta = parseMeta(html);
  const title = first(meta, "og:title");
  const who = first(meta, "og:description");
  // Plain uploads put the video description here, which is no artist: ignore anything long.
  const artists = who && who.length <= 60 && !who.includes("\n") ? [who] : [];
  return { ...(title ? { title } : {}), artists };
}

/** oEmbed names auto-generated artist channels "<Artist> - Topic". */
export function fromOembed(json: { title?: string; author_name?: string }): Pick<Lookup, "title" | "artists"> {
  const author = json.author_name?.replace(/ - Topic$/, "").trim();
  return { ...(json.title ? { title: json.title } : {}), artists: author ? [author] : [] };
}

/** Spotify: og:description is "Artist · Album · Song · Year"; musician tags list every artist. */
export function fromSpotify(html: string): Omit<Lookup, "source"> {
  const meta = parseMeta(html);
  const parts = (first(meta, "og:description") ?? "").split(" · ");
  const named = meta.get("music:musician_description") ?? [];
  const artists = named.length ? named : parts[0] ? parts[0].split(", ") : [];
  const year = first(meta, "music:release_date")?.slice(0, 4) ?? (/^\d{4}$/.test(parts.at(-1) ?? "") ? parts.at(-1) : undefined);
  const title = first(meta, "og:title");
  const album = parts.length >= 4 ? parts[1] : undefined;
  return {
    artists,
    ...(title ? { title } : {}),
    ...(album ? { album } : {}),
    ...(year ? { year } : {}),
  };
}

async function text(f: typeof fetch, url: string): Promise<string | null> {
  const r = await f(url, { headers: { "user-agent": UA, "accept-language": "en" } }).catch(() => null);
  return r?.ok ? r.text() : null;
}

export async function lookup(input: string, f: typeof fetch = fetch): Promise<Lookup> {
  const videoId = extractVideoId(input);
  if (videoId) {
    const [page, oembed] = await Promise.all([
      text(f, `https://music.youtube.com/watch?v=${videoId}`),
      text(f, `https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${videoId}`),
    ]);
    const music = page ? fromYoutubeMusic(page) : { artists: [] };
    const embed = oembed ? fromOembed(JSON.parse(oembed)) : { artists: [] };
    if (!music.title && !embed.title) throw new LookupError("YouTube did not return anything for that video");
    const title = music.title ?? embed.title;
    const artists = music.artists.length ? music.artists : embed.artists;
    return { source: "youtube", videoId, ...(title ? { title } : {}), artists };
  }

  const id = spotifyTrackId(input);
  if (id) {
    const page = await text(f, `https://open.spotify.com/track/${id}`);
    if (!page) throw new LookupError("Spotify did not return that track");
    return { source: "spotify", ...fromSpotify(page) };
  }

  throw new LookupError("Not a YouTube, YouTube Music or Spotify track link");
}
