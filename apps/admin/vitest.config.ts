import { defineConfig } from "vitest/config";

// Tests copy the real content tree (~1.3k files); that is slow on a synced folder.
export default defineConfig({ test: { testTimeout: 30_000, hookTimeout: 30_000 } });
