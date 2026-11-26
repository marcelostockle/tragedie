/**
 * YouTube URL cleaning. Run once at import/edit time, never at render time.
 * Policy: keep only `v`; every other param is dropped.
 */

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

export function isVideoId(s: string): boolean {
  return VIDEO_ID.test(s);
}

/** Extract the video id from any YouTube URL form, or null if none. */
export function extractVideoId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (!HOSTS.has(url.hostname.toLowerCase())) return null;

  const segments = url.pathname.split("/").filter(Boolean);
  let candidate: string | null | undefined;
  if (url.hostname.toLowerCase().endsWith("youtu.be")) {
    candidate = segments[0];
  } else if (segments[0] === "watch") {
    candidate = url.searchParams.get("v");
  } else if (["shorts", "embed", "live", "v"].includes(segments[0] ?? "")) {
    candidate = segments[1];
  }
  return candidate && isVideoId(candidate) ? candidate : null;
}

export const canonicalLink = (videoId: string) =>
  `https://www.youtube.com/watch?v=${videoId}`;

/** Canonicalize to `https://www.youtube.com/watch?v=<id>`, or null if not a video URL. */
export function cleanYoutubeUrl(input: string): string | null {
  const id = extractVideoId(input);
  return id ? canonicalLink(id) : null;
}

export const trackIdFromVideoId = (videoId: string) => `yt:${videoId}`;

export function videoIdFromTrackId(trackId: string): string | null {
  const m = /^yt:([A-Za-z0-9_-]{11})$/.exec(trackId);
  return m ? m[1]! : null;
}
