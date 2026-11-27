import { publicData } from "../../lib/content";

/** Track metadata ships once and is shared by every locale. */
export function GET() {
  return new Response(JSON.stringify(publicData.tracks), {
    headers: { "content-type": "application/json" },
  });
}
