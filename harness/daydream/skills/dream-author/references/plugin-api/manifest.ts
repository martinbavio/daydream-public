// @daydream/plugin-api/manifest — the plugin MANIFEST's types (decision
// #48; P11 moved them here from src/core/pluginManifest.ts, which
// re-exports them beside the validator both the shell and the bridge run).
// Types only; a plugin author reads the per-field docs here.

/** A declared permission: disclosure with a reason, never enforcement
 * (decision #48: plugins are trusted in-process code; the trust prompt
 * for a non-repo plugin shows this list). */
export interface PluginPermission {
  name: string;
  reason: string;
}

/** The shape of `contributes.itemAssets` (payload fields, keyed by
 * declared item kind and then top-level payload field): a declaration
 * nothing reads since decision #78, whose host downloads no item's files
 * (PluginContributions.itemAssets). */
export type ItemAssetFields = Record<
  string,
  Record<string, "image" | "video" | "font">
>;

/** What the plugin contributes, declared so the shell and the bridge can
 * list it without running the plugin's code. Every field is optional. */
export interface PluginContributions {
  /** Command ids the plugin registers. Every `dd.registerCommand` id must
   * be listed here (the API refuses an undeclared one, as it does an
   * undeclared panel); each carries the `<pluginId>.` prefix. */
  commands?: string[];
  /** Shortcut bindings, as `"<keys>": "<command id>"`. Each key is a
   * `Shortcut` string (parsed by the same rules as `dd.bindShortcut`) and
   * each value one of THIS plugin's command ids (`<pluginId>.<name>`). */
  shortcuts?: Record<string, string>;
  /** Panel ids the plugin registers (`dd.registerPanel`). */
  panels?: string[];
  /** Canvas kinds registered by the browser part: this plugin's id or
   * dotted descendants of it; repo plugins may share the reserved daydream.
   * namespace. Unloading keeps their data as unknown kinds. */
  itemKinds?: string[];
  /** Asset slots owned by these item kinds. Validated, and read by
   * nothing since decision #78: a project's items are never downloaded
   * into (docs/plugin-authoring.md). Leave it out of a new manifest. */
  itemAssets?: ItemAssetFields;
  /** Overlay ids the plugin registers onto the canvas. */
  overlays?: string[];
  /** Item action ids the plugin registers into item title bars
   * (`dd.registerItemAction`, decision #67): bare ids, unique within
   * the plugin. */
  itemActions?: string[];
  /** Gate ids the plugin registers, which `lint` runs. Every
   * `dd.registerGate` id must be listed here (undeclared ones are refused,
   * as panels are): bare ids, no plugin prefix — the project config keys
   * its overrides `gates[<pluginId>][<gateId>]`. */
  gates?: string[];
  /** MCP tool names the plugin registers — from its browser part
   * (`dd.registerTool`, forwarded into the tab by the bridge) or its host
   * part (`bridge.ts`, `host.registerTool`); an undeclared name is refused
   * on either side, and a core tool's name on either side too. */
  tools?: string[];
  /** MCP prompt names the plugin's host part registers. */
  prompts?: string[];
  /** MCP resource names the plugin's host part registers. */
  resources?: string[];
  /** Short guidance the bridge appends to the MCP server instructions,
   * under a heading with the plugin's name, while the plugin is enabled
   * (decision #48: read at connect time, so a toggle applies on the
   * next connection). A host part may replace it (`host.instructions`). */
  instructions?: string;
  /** Plugin-relative path of a knowledge folder (frontmattered markdown:
   * `topic`, `title`, `tier`, `summary`; docs/plugin-authoring.md §5.6
   * carries the whole contract) the bridge serves
   * through the core knowledge tools while the plugin is enabled; paths
   * are listed as `<pluginId>/<file>`. Its `private/` subfolder is served
   * by the local host only and never indexed into a committed INDEX.md. */
  knowledge?: string;
}

/** `<plugin folder>/manifest.json`. `id` is dotted; `daydream.` is
 * reserved for plugins living in the repo's own `plugins/` folder. */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  /** The plugin API version it was built against, `major.minor` (`"1.2"`):
   * it runs on a Daydream whose API has the same major and a minor at
   * least this one. */
  api: string;
  contributes?: PluginContributions;
  permissions?: PluginPermission[];
  /** Declares use of the `unstable` API part. First-party may not set it. */
  unstable?: true;
  /** Plugin-relative path of the browser part PREBUILT as one ES module
   * (`"dist/index.js"`; `pnpm plugin:build <folder>` writes it): what
   * the stable host serves, since it ships no compiler. It imports
   * `solid-js` and `@solidjs/web` bare and gets the page's own instance
   * through its import map; everything else is bundled in. The dev host
   * prefers the source entry beside it when there is one. Repo plugins
   * never set it — they are compiled into the page. */
  built?: string;
}
