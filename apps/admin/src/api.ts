import type { Content, Issue, LoadedTag } from "@tragedie/schema";
import type { Track } from "@tragedie/schema/browser";

export type Loaded = Content & { issues: Issue[] };
export type { LoadedTag };

async function send<T>(method: string, url: string, body: unknown): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await r.json();
  if (!r.ok) throw new Error((json.errors as string[]).join("\n"));
  return json;
}

export async function loadAll(): Promise<Loaded> {
  const r = await fetch("/api/content");
  if (!r.ok) throw new Error(`load failed: ${r.status}`);
  return r.json();
}

/** Resolves to the saved track; rejects with an Error listing the problems. */
export const saveTrack = (track: Track) =>
  send<Track>("PUT", `/api/tracks/${track.id.slice(3)}`, track);

export interface TagPayload {
  file: LoadedTag["file"];
  prose: LoadedTag["prose"];
}

export const createTag = (p: TagPayload) => send<LoadedTag>("POST", "/api/tags", p);
export const updateTag = (p: TagPayload) =>
  send<LoadedTag>("PUT", `/api/tags/${p.file.id}`, p);
