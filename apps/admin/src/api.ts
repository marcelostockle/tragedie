import type { Content, Issue, Track } from "@tragedie/schema";

export type Loaded = Content & { issues: Issue[] };

export async function loadAll(): Promise<Loaded> {
  const r = await fetch("/api/content");
  if (!r.ok) throw new Error(`load failed: ${r.status}`);
  return r.json();
}

/** Returns the saved track, or throws an Error whose message lists the problems. */
export async function saveTrack(track: Track): Promise<Track> {
  const r = await fetch(`/api/tracks/${track.id.slice(3)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(track),
  });
  const body = await r.json();
  if (!r.ok) throw new Error((body.errors as string[]).join("\n"));
  return body;
}
