import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";

const contentRoot = resolve(process.env.CONTENT_DIR ?? "../../content");
const port = Number(process.env.PORT ?? 5174);

// Local only: bind to loopback, never deployed.
serve({ fetch: createApp(contentRoot).fetch, port, hostname: "127.0.0.1" }, () =>
  console.log(`admin api on http://127.0.0.1:${port} (content: ${contentRoot})`),
);
