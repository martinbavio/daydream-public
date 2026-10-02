// @daydream/plugin-api/host — the contract a plugin's HOST PART imports
// (decision #48, "Agent guidance is a plugin's, delivered by the
// bridge"; decision #48 P9). TYPES ONLY, like the sibling entry.
//
// A plugin may ship `bridge.ts` beside its manifest, default-exporting
// `(host: DaydreamHostApi) => void | Promise<void>`. The bridge (the
// dev-server host, tools/bridge/plugins/) loads it under NODE — never the
// page — for every plugin `.daydream/plugins.json` enables, and registers
// what it contributes on the MCP server only while the plugin stays
// enabled: tools, prompts and resources any harness sees, an instructions
// section read at connect time, a knowledge folder the core knowledge
// tools serve. Node's own module loader runs the file (type stripping, no
// bundler): write erasable TypeScript only — no enums, no parameter
// properties — and give every relative import its `.ts` extension. The
// bridge re-imports `bridge.ts` itself on every reload (a config edit, a
// manifest or bridge.ts change), but a helper it imports from `bridge/`
// stays in Node's module cache for the life of the dev server: after
// editing a helper, restart the dev server. Read files at request time
// (as a part serving a resource from a file does) and an edit to DATA needs neither. The
// entry has ten seconds to import and return; one that hangs is skipped
// with a logged problem. The browser part (`index.ts`) and the host part
// never share a runtime; what they share is the manifest.

import type { ZodOptional, ZodRawShape, ZodType, z } from "zod";

import type { PluginManifest, ToolAnnotations } from "./index.ts";

/** What a host tool answers: the text the model reads, an optional
 * structured copy, and whether the call failed (a refusal the model must
 * act on — findings, a missing canvas). */
export interface HostToolResult {
  text: string;
  structured?: Record<string, unknown>;
  isError?: boolean;
}

/** An MCP tool the host part registers. `name` MUST be listed in the
 * manifest's `contributes.tools` (an undeclared one is refused, as a
 * browser part's undeclared panel is) and may not collide with a core
 * tool's. `inputSchema` is a zod RAW SHAPE (`{ id: z.string() }`), the
 * same form the MCP SDK takes; `run` gets the parsed arguments. A thrown
 * error becomes an error result carrying its message. */
export interface HostToolRegistration<Shape extends ZodRawShape = ZodRawShape> {
  name: string;
  /** Sentence case; what a harness shows in its tool list. */
  title: string;
  description: string;
  inputSchema: Shape;
  /** The tool's MCP annotations (readOnlyHint, destructiveHint,
   * idempotentHint, openWorldHint) — hints a harness reads to auto-allow
   * a read or confirm a destructive call; the same `ToolAnnotations` a
   * browser tool declares. */
  annotations?: ToolAnnotations;
  run: (args: {
    [K in keyof Shape]: z.output<Shape[K]>;
  }) => HostToolResult | Promise<HostToolResult>;
}

/** A prompt's arguments: names to zod STRING schemas, optional ones with
 * `.optional()` — the protocol's rule (prompt arguments are strings), so
 * the type refuses a number or an object schema where the SDK would only
 * fail at request time. */
export type HostPromptArgs = Record<
  string,
  ZodType<string> | ZodOptional<ZodType<string>>
>;

/** An MCP prompt the host part registers. `name` MUST be listed in the
 * manifest's `contributes.prompts`. `argsSchema` is a HostPromptArgs;
 * `build` returns the prompt's one user message as text, read at request
 * time — so a prompt generated from a file on disk never goes stale. */
export interface HostPromptRegistration<
  Args extends HostPromptArgs = HostPromptArgs,
> {
  name: string;
  title: string;
  description: string;
  argsSchema?: Args;
  build: (args: {
    [K in keyof Args]: z.output<Args[K]>;
  }) => string | Promise<string>;
}

/** An MCP resource the host part registers: one document at a fixed URI,
 * read on demand. `name` MUST be listed in the manifest's
 * `contributes.resources`. */
export interface HostResourceRegistration {
  /** A stable URI of the plugin's own scheme or path, e.g.
   * `plugin://vendor.name/guide.md`. */
  uri: string;
  name: string;
  title?: string;
  description?: string;
  mimeType: string;
  read: () => string | Promise<string>;
}

/** What the host part may ask the CANVAS TAB for, through the host's own
 * channel — the three read-only requests the core tools `canvas_state`,
 * `measure` and `lint` make, and a browser tool by name (decision
 * #72): a plugin's own, run in the tab against the live document, so a
 * host part can take what only the page can produce (a rendered
 * viewport, a measurement) and do with it what only Node can (write a
 * file, run a binary) in one call an agent makes. Nothing that writes: a
 * host part changes a page as any agent does, by its files (decision
 * #78). Each rejects when no canvas tab is connected. */
export interface HostTab {
  /** The open project's items, viewports and selection (canvas_state). */
  state(): Promise<unknown>;
  /** Render viewports of the open project in the tab — `id` one, the
   * named ones, or every one — and report geometry plus findings;
   * nothing changes. */
  measure(input: {
    id?: string;
    viewportIds?: string[];
  }): Promise<{ report: unknown; text: string }>;
  /** Every gate over the open project's pages (or the named viewports'),
   * each finding with its severity; nothing changes. */
  lint(input: { viewportIds?: string[] }): Promise<{ findings: unknown[] }>;
  /** Run a BROWSER tool by its declared name with the input its schema
   * takes — what a `tool` request from an agent does — and get what it
   * answered. A throw in the tab is this promise's rejection. */
  tool(name: string, input: Record<string, unknown>): Promise<unknown>;
}

/** The object a host part's default export receives. Every `register*`
 * call takes effect when the bridge next assembles an MCP server — at
 * once for new connections; connected sessions are told the lists
 * changed — and is dropped whole when the plugin is disabled or its host
 * part is reloaded. Nothing here returns a disposable: the bridge owns
 * the lifetime, a host part only declares. */
export interface DaydreamHostApi {
  /** This plugin's identity and where its files are (absolute folder
   * path) — how a host part finds its own assets without `import.meta`.
   * `dataFile` is the absolute path of the plugin's own storage file —
   * what the browser part's `dd.storage` writes, `<project>/.daydream/
   * plugin-data/<id>.json`, saved on every set — so a host part can name
   * it to an agent (a watch that wakes on the page's writes) without
   * guessing the open project from a working directory. It names the
   * file in the project open when it is read — read it when you need it,
   * not once at load — and is null while no project is open, when
   * `dd.storage` keeps nothing. The file may not exist until the browser
   * part's first write. */
  readonly plugin: {
    readonly id: string;
    readonly dir: string;
    readonly dataFile: string | null;
    readonly manifest: PluginManifest;
  };
  registerTool<Shape extends ZodRawShape>(
    registration: HostToolRegistration<Shape>,
  ): void;
  registerPrompt<Args extends HostPromptArgs>(
    registration: HostPromptRegistration<Args>,
  ): void;
  registerResource(registration: HostResourceRegistration): void;
  /** Replace the manifest's `contributes.instructions` with this text for
   * the server instructions section under the plugin's name — for
   * guidance that needs a file or a computation. */
  instructions(text: string): void;
  /** Declare (or move) the knowledge folder the core knowledge tools serve
   * for this plugin, as a plugin-relative path; the manifest's
   * `contributes.knowledge` is the declarative form. */
  knowledgeDir(pluginRelativePath: string): void;
  /** The connected canvas tab (see HostTab). Nothing it offers writes the
   * project. */
  readonly tab: HostTab;
}

/** A host part's default export: called once per assembly of the plugin's
 * contributions (activation, and again after a reload), under Node. */
export type HostPartEntry = (host: DaydreamHostApi) => void | Promise<void>;

/** The shape of a plugin's `bridge.ts` module. */
export interface HostPartModule {
  default: HostPartEntry;
}
