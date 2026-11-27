import { defineConfig } from "astro/config";
import svelte from "@astrojs/svelte";
import { LOCALES, SOURCE_LOCALE } from "@tragedie/schema/browser";

export default defineConfig({
  output: "static",
  integrations: [svelte()],
  // Locale-prefixed routes (/en/..., /es/...). `/` is a small page of ours that forwards to the source locale.
  i18n: {
    locales: [...LOCALES],
    defaultLocale: SOURCE_LOCALE,
    routing: { prefixDefaultLocale: true, redirectToDefaultLocale: false },
  },
  server: { host: "127.0.0.1" },
});
