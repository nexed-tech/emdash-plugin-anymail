import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "core/index": "src/core/index.ts",
  },
  format: ["esm"],
  target: "node18",
  platform: "neutral",
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: true,
  treeshake: true,
  // `emdash` is a peer dependency and must never be bundled — only its
  // types are used, and only by the plugin entry.
  external: ["emdash"],
});
