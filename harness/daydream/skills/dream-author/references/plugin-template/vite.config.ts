// Builds the browser part as ONE ES module, which is what the manifest's
// `built` names and what the installed host serves (it has no compiler).
// `solid-js` and `@solidjs/web` stay bare imports: the page's import map
// points those two roots at the one Solid it runs. Their subpaths
// (`solid-js/store`, `@solidjs/web/jsx-runtime`) are NOT in the map, so
// the build refuses them rather than ship an import the page cannot load.
// Everything else is bundled in.
import solid from "@solidjs/vite-plugin";
import { defineConfig } from "vite";

const ROOTS = new Set(["solid-js", "@solidjs/web"]);

export default defineConfig({
  plugins: [
    {
      name: "refuse-solid-subpaths",
      enforce: "pre",
      resolveId(id) {
        if (/^(solid-js|@solidjs\/web)\//.test(id)) {
          throw new Error(
            `${id}: only solid-js and @solidjs/web are provided by the Daydream page; import from those roots`,
          );
        }
        return null;
      },
    },
    solid(),
  ],
  build: {
    outDir: "dist",
    lib: { entry: "index.tsx", formats: ["es"], fileName: () => "index.js" },
    rollupOptions: {
      external: (id) => ROOTS.has(id),
      output: { inlineDynamicImports: true },
    },
  },
});
