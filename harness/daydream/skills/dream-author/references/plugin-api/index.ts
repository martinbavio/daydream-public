// @daydream/plugin-api — the contract a plugin imports (decision #48).
//
// TYPES ONLY. Nothing here runs: the kernel (src/plugin-host/) builds the
// object these types describe and hands it to the plugin's default export.
// A plugin author — usually an agent — reads THIS file to learn the API, so
// every member carries a one-line doc. Members arrive phase by phase
// (decision #48); add nothing speculative.
//
// SELF-CONTAINED (P11): the document, finding and manifest types live in
// the sibling files (document.ts, findings.ts, manifest.ts) and the
// framework-free core imports them FROM here — this package never imports
// src/ (eslint.config.js pins it), so it publishes as-is and an
// out-of-repo plugin type-checks against it alone
// (src/plugin-host/publishedTypes.test.ts). The subpath exports
// `@daydream/plugin-api/{document,findings,manifest}` are for core; a
// plugin imports everything from the root. A viewport shows a page of
// the open project by path, and a page is its markup and its sheets
// (decision #78).

import type { JSX } from "@solidjs/web";

import type {
  DreamCanvas,
  DreamDocument,
  DreamItem,
  DreamMeta,
  DreamPage,
  DreamPageEntry,
  DreamPageMeta,
  DreamViewport,
  ElementId,
  MediaEnvironment,
  PageSheet,
  SheetSource,
  ViewportEnv,
  ViewportKind,
  ViewportPayload,
  ViewportVariant,
} from "./document.ts";
import type {
  Finding,
  FindingSeverity,
  FindingTier,
  MeasuredBox,
  MeasuredElement,
  MeasuredViewport,
  MeasureFinding,
  MeasureFindingKind,
  MeasureFlag,
  MeasureReport,
} from "./findings.ts";
import type {
  ItemAssetFields,
  PluginContributions,
  PluginManifest,
  PluginPermission,
} from "./manifest.ts";
import type {
  AgentAgents,
  AgentAuthMethod,
  AgentChange,
  AgentCommand,
  AgentConfigChoice,
  AgentConfigOption,
  AgentContentBlock,
  AgentConversation,
  AgentListing,
  AgentMode,
  AgentModes,
  AgentPermissionAsk,
  AgentPermissionOption,
  AgentPlanEntry,
  AgentPromptReferences,
  AgentSessionUpdate,
  AgentStartIntent,
  AgentStatus,
  AgentThread,
  AgentToolCall,
  AgentToolCallContent,
  AgentToolCallStatus,
  AgentToolCallUpdate,
} from "./agent.ts";

export type {
  DreamCanvas,
  DreamDocument,
  DreamItem,
  DreamMeta,
  DreamPage,
  DreamPageEntry,
  DreamPageMeta,
  DreamViewport,
  ElementId,
  Finding,
  FindingSeverity,
  FindingTier,
  MeasuredBox,
  MeasuredElement,
  MeasuredViewport,
  MeasureFinding,
  MeasureFindingKind,
  MeasureFlag,
  MeasureReport,
  MediaEnvironment,
  PageSheet,
  SheetSource,
  ViewportEnv,
  ViewportKind,
  ViewportPayload,
  ViewportVariant,
  ItemAssetFields,
  PluginContributions,
  PluginManifest,
  PluginPermission,
  AgentAgents,
  AgentAuthMethod,
  AgentCommand,
  AgentConfigChoice,
  AgentConfigOption,
  AgentContentBlock,
  AgentConversation,
  AgentChange,
  AgentListing,
  AgentMode,
  AgentModes,
  AgentPermissionAsk,
  AgentPermissionOption,
  AgentPlanEntry,
  AgentPromptReferences,
  AgentSessionUpdate,
  AgentThread,
  AgentStartIntent,
  AgentStatus,
  AgentToolCall,
  AgentToolCallContent,
  AgentToolCallStatus,
  AgentToolCallUpdate,
};

/** Read-only to any depth. The document is a Solid store proxy that
 * silently ignores writes outside a setter; a shallow Readonly would let
 * `dd.document().items.push(...)` type-check and do nothing. */
export type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

// The manifest types — PluginManifest, PluginContributions,
// PluginPermission — are in manifest.ts (the validator both the shell and
// the bridge run is core's, src/core/pluginManifest.ts); read them there
// for the per-field docs. The host-part contract (`bridge.ts`) is the
// sibling entry `@daydream/plugin-api/host`.

/** Returned by every `register*` / `on` call; the kernel also tracks it and
 * disposes it on unload, in reverse registration order. Idempotent. */
export interface Disposable {
  dispose(): void;
}

export interface ItemResizeContext {
  /** Browser-measured item size at gesture start, in world pixels. */
  startSize: { width: number; height: number };
  /** Current resized item size, in world pixels. */
  size: { width: number; height: number };
  /** Whether Shift is currently constraining the gesture. */
  proportional: boolean;
}

/** A plugin-owned canvas kind. Undeclared kinds and namespace collisions
 * are refused. Disposing preserves its documents as unknown-kind items. */
export interface ItemKindRegistration {
  /** This plugin's id, or a dotted id beneath its namespace. */
  kind: string;
  /** Validate only the payload, returning a path-prefixed problem or null. */
  payloadProblem(raw: unknown, where: string): string | null;
  /** Fill optional payload fields after successful validation, in place. */
  normalize?(payload: unknown): void;
  /** Render a canvas item under its own component owner. */
  render(props: { item: DeepReadonly<DreamItem> }): JSX.Element;
  /** CSS for the kind's own DOM; the kernel mounts it inside the item's
   * root wrapper (`<div data-plugin-item="<pluginId>">`, laid out as
   * `display: contents`) wrapped in `@layer dream-plugin` (decision #71).
   * It can never restyle a document: a page renders in its own shadow
   * root, which no plugin rule reaches (decision #76). The ONE way to
   * ship CSS: a `<style>` element rendered inside the item is unlayered,
   * would beat every layered rule of the app and of every plugin, and is
   * disabled by the kernel with a console problem. */
  styles?: string;
  /** Optional plain description for the agent's canvas summary. */
  describe?(item: DeepReadonly<DreamItem>): string | null;
  /** Display name for the item's core title bar. */
  name?(item: DeepReadonly<DreamItem>): string;
  /** Rename a validated working item; core commits it as one undo step. */
  rename?(item: DreamItem, name: string): void;
  /** Whether core draws its title bar; defaults to true. */
  title?: boolean;
  /** Resize bounds in world px, freeform behavior, reset behavior, and an
   * optional payload update inside the same document mutation. */
  resize?: {
    /** Horizontal side drags materialize both frame axes instead of preserving automatic height. */
    freeform?: boolean;
    /** Render all four side and all four corner handles. */
    handles?: "all";
    min?: number;
    max?: number;
    reset?: boolean;
    /** Update payload state derived from the resized frame and gesture. */
    onResize?(item: DreamItem, context: ItemResizeContext): void;
  };
  /** True while an item is being edited; suppresses core resize chrome. */
  editing?(id: string): boolean;
}

/** A multi-write editing session over the document and the pages' files:
 * one undo step on commit, none on cancel. An unrelated document or
 * file write, an undo/redo, a load, or a file the session wrote changed
 * on disk interrupts the session — what it wrote so far stays as one
 * step, `onInterrupted` is called, and every write then answers false
 * or a refusal. */
export interface ItemTransaction {
  /** Mutate a working array; validated and applied live. False once ended. */
  mutate(mutation: (items: DreamItem[]) => void): boolean;
  /** Update one existing item's working copy without cloning other items.
   * Its id/kind stay fixed. False if missing or the session has ended. */
  update(id: string, mutation: (item: DreamItem) => void): boolean;
  /** A page edit exactly as `dd.writePage` takes and answers it, the
   * session's: with the item writes one undo step on commit, and none on
   * cancel — a rule or a sheet an `add` created included. What a drag
   * that writes a rule on every frame needs: history's typing burst
   * would split it at every pause. */
  write(edit: CssPageEdit): string | PageWritten;
  write(edit: Exclude<PageEdit, CssPageEdit>): string | null;
  write(edit: PageEdit): string | PageWritten | null;
  /** Keep all session writes as one undo step; none when they net to
   * nothing. */
  commit(): void;
  /** Restore the starting document, files and selection unless already
   * interrupted. */
  cancel(): void;
}

/** Positions and movement state for a plugin-owned canvas drag. */
export interface CanvasDragContext {
  /** The browser pointer id captured for this gesture. */
  pointerId: number;
  /** Pointer-down position in window client pixels. */
  startScreen: { x: number; y: number };
  /** Latest pointer position in window client pixels. */
  currentScreen: { x: number; y: number };
  /** Screen-pixel displacement from the pointer-down position. */
  deltaScreen: { x: number; y: number };
  /** Pointer-down position in canvas world coordinates. */
  startWorld: { x: number; y: number };
  /** Latest pointer position in canvas world coordinates. */
  currentWorld: { x: number; y: number };
  /** World-coordinate displacement from the pointer-down position. */
  deltaWorld: { x: number; y: number };
  /** Whether Shift is held at the latest pointer event. */
  shiftKey: boolean;
  /** Whether the gesture crossed the standard click/drag threshold on its active axes. */
  moved: boolean;
}

/** Final state for a completed or canceled plugin-owned canvas drag. */
export interface CanvasDragEndContext extends CanvasDragContext {
  /** Escape, pointer cancellation, window blur, or disposal ended the drag. */
  canceled: boolean;
}

/** Hooks and movement policy for `CanvasApi.bindDrag`. */
export interface CanvasDragHandlers {
  /** Decide synchronously whether this primary pointer press is yours. */
  shouldStart?(event: PointerEvent): boolean;
  /** Choose which screen axes count toward `context.moved`; both count by default. */
  movementAxes?(): { x: boolean; y: boolean };
  /** Pointer capture was acquired; snapshot initial state here. */
  onStart?(context: CanvasDragContext): void;
  /** Coalesced to at most one update per animation frame. */
  onMove?(context: CanvasDragContext): void;
  /** The gesture ended; commit normally or restore when `context.canceled`. */
  onEnd?(context: CanvasDragEndContext): void;
}

/** Canvas gestures and placement, scoped to this plugin's lifetime. */
export interface CanvasApi {
  /** Register the item window for geometry and standard move/selection.
   * Dispose when the node unmounts; the host also disposes on unload.
   * Also reports item hover to core title-bar dimensions.
   * canDrag=false leaves editing pointer/click behavior to the plugin. */
  bindItemNode(
    id: string,
    node: HTMLElement,
    options?: {
      canDrag?: () => boolean;
      /** Suppress only standard item movement for a particular press. */
      canMove?: (event: PointerEvent) => boolean;
      draggable?: boolean;
    },
  ): Disposable;
  /** Bind a pointer-captured, world-space drag using the canvas's standard
   * rAF batching and Escape/blur cancellation. A claimed press is prevented,
   * and the terminal click after a moved or canceled drag is suppressed. */
  bindDrag(node: HTMLElement, handlers: CanvasDragHandlers): Disposable;
  /** Whether Space is currently held for canvas panning. Reactive. */
  panMode(): boolean;
  /** Whether Alt/Option is currently held. Reactive. */
  optionMode(): boolean;
  /** The visible canvas center in world coordinates. */
  center(): { x: number; y: number };
  /** Convert window client coordinates to world coordinates. */
  screenToWorld(clientX: number, clientY: number): { x: number; y: number };
  /** Unmodified primary double-click on empty canvas (never a pan/drag). */
  onEmptyDoubleClick(
    handler: (event: MouseEvent, position: { x: number; y: number }) => void,
  ): Disposable;
  /** Window capture-phase presses, including outside the canvas. Claim an
   * empty-canvas press with preventDefault to preserve selection. */
  onPointerDown(
    handler: (event: PointerEvent, context: { empty: boolean }) => void,
  ): Disposable;
  /** Canvas interaction notifications: pointerdown, wheel or drop, even
   * when a gesture does not change document, selection or camera state. */
  onActivity(handler: () => void): Disposable;
  /** Paste outside editable controls; preventDefault to claim it. Higher
   * priority runs first (default 0); ties follow registration order. */
  onPaste(
    handler: (event: ClipboardEvent) => void,
    options?: { priority?: number },
  ): Disposable;
  /** Canvas dragover; preventDefault to accept the transfer. */
  onDragOver(handler: (event: DragEvent) => void): Disposable;
  /** Canvas drop; core only stops the browser navigating to it. Claim
   * synchronously. */
  onDrop(handler: (event: DragEvent) => void): Disposable;
  /** Copy outside editable controls; preventDefault to claim it. */
  onCopy(handler: (event: ClipboardEvent) => void): Disposable;
}

/**
 * What a panel is rendered for (decision #79), given to its `render`.
 * Today it is always the canvas's own selection — what `dd.selection()`
 * and `dd.itemSelection()` read — but a panel that reads it here rather
 * than from `dd` follows whatever its panel is for: a panel bound to one
 * item, should panels come to be, is given that item's selection here,
 * without a change to the panel. Taking it is optional.
 */
export interface PanelContext {
  /** The selected element the panel is for, or null. Accessor: tracks. */
  selection(): ElementId | null;
  /** The envelope ids of the selected canvas items the panel is for.
   * Accessor: tracks. */
  itemSelection(): readonly string[];
}

/** A panel in a stack the user arranges (decision #79): moved, joined,
 * pinned to the screen or loose on the canvas (drawn scaled with it),
 * minimized or open — its place and size the user's. `render` runs once
 * per mount as a component
 * under the panel's owner: effects and memos created inside it live as
 * long as the panel's body is mounted — a minimized panel's body is
 * unmounted — and reactive reads inside its JSX track as usual. */
export interface PanelRegistration {
  /** Unique within the plugin; also declared in `contributes.panels`. */
  id: string;
  /** The caption in the panel's header. */
  title: string;
  /** The accessible name of the panel's section — it becomes a
   * landmark region assistive tech can jump to. Defaults to `title`;
   * give a fuller one when the caption is terse ("CSS" → "CSS editor"). */
  ariaLabel?: string;
  /** The panel's body: called once per mount, untracked under its own
   * owner, as a component is — given what the panel is for, which a
   * panel may ignore (`render: () => …` is a render too). */
  render: (context: PanelContext) => JSX.Element;
  /** CSS for the plugin's own DOM; the kernel mounts it inside the root
   * wrapped in `@layer dream-plugin` (decision #71), above the app's own
   * layer. It can never restyle a document: a page renders in its own
   * shadow root, which no plugin rule reaches (decision #76). The ONE way
   * to ship CSS: a `<style>` element rendered inside the root is
   * unlayered, would beat every layered rule of the app and of every
   * plugin, and is disabled by the kernel with a console problem. */
  styles?: string;
  /** The panel wants space, as a weight: in the default stack the
   * growing panels share whatever the content-sized ones leave in
   * proportion (`true` is 1; the CSS editor declares 2, the HTML editor
   * 1). Otherwise the panel starts as long as what `render` puts in it,
   * measured once. After that its size is the user's, like its width and
   * where it sits: a panel has no say over them. */
  grow?: number | boolean;
  /** Where the panel lands the first time the layout sees it: `"right"`,
   * a stack of its own pinned full height against the window's right
   * edge, left of any stack pinned there already, whether its plugin was
   * on at the start or turned on later. Absent, it joins the first stack
   * at the start, and lands loose beside the items in view when its
   * plugin is turned on later. Once landed, its place is the user's. */
  lands?: "right";
  /** Whether the panel wants the user's eye: while it is minimized and
   * this answers true, its header carries a dot. Accessor: tracks. */
  attention?: () => boolean;
}

/** A screenshot of a viewport, as the desktop app took it. */
export interface ViewportCapture {
  /** The PNG's bytes, base64. */
  data: string;
  mimeType: "image/png";
  width: number;
  height: number;
}

/**
 * Screenshots of the canvas's viewports (decision #87), which only the
 * desktop app around the page can take: in a browser tab there are none.
 * Apart from `dd.agent` — a screenshot is the page's, whoever it is for.
 */
export interface CaptureApi {
  /** Whether screenshots can be taken here: true in the desktop app
   * alone. Hide a screenshot affordance otherwise. */
  available(): boolean;
  /** A screenshot of the viewport `viewportId` as the canvas renders its
   * page — a variant's included — laid out at the viewport's width with
   * its frame's height as the window, and taken the whole page down
   * (capped); null anywhere but the desktop app, or for anything but a
   * viewport of a page. Rejects with the app's sentence when it could not
   * take one. */
  viewport(viewportId: string): Promise<ViewportCapture | null>;
}

/**
 * The open project's conversation with the user's own agent (decision
 * #87), over the Agent Client Protocol: the host starts the agent — one of
 * the known ones on the user's PATH, named by id — in the project's
 * folder, hands it Daydream's MCP server, and passes everything it sends
 * on to every tab as the ACP SDK parses it (the ACP shapes in
 * AgentSessionUpdate; a kind the SDK does not know is dropped). The
 * conversation is the host's and the project's, never a tab's: a plugin
 * follows it (`follow`), the kernel keeping what it hears whole. Daydream
 * runs no model and no loop of its own; it is a client. Every method but
 * `available` rejects with the host's sentence on a refusal, and without
 * a host that runs agents.
 */
export interface AgentApi extends AgentConversation {
  /** Whether this host runs agents (a plain static build does not). */
  available(): Promise<boolean>;
  /** Follow the conversation: `handler` hears it whole first (a `thread`
   * change), then every change after it, in order — and whole again
   * whenever part of it may have been missed (the host started over, the
   * connection to it came back, a change was lost), which the kernel
   * finds and reads for it. `start`, `newConversation` and `authenticate`
   * resolve once every follower has heard where they left it. Disposing
   * stops it. Nothing without a host that runs agents. */
  follow(handler: (change: AgentChange) => void): Disposable;
}

/**
 * Where a command applies (decision #48; the router is
 * src/commands/router.ts). On a keypress the scopes are tried in this
 * order and the FIRST enabled command that handles the key wins:
 * - `drag`: only while a canvas drag is live — and while one is, nothing
 *   outside this scope fires (Escape cancels the drag and nothing else).
 * - `editor`: the key was typed in a text field (an input, a textarea, a
 *   contenteditable) or inside an element carrying the `data-dd-editable`
 *   attribute — how a plugin declares an editor of its own to the router
 *   (the CSS editor marks its CodeMirror host); the router knows no
 *   editor library's class names. An
 *   UNMODIFIED printable key bound here (`"K"`, `"/"`, `"Space"`) claims
 *   that character in every text field — the user can no longer type it.
 *   Bind such keys in `canvas`; the router warns at bind time.
 * - `canvas`: the key was typed anywhere else.
 * - `always`: regardless of where — undo, redo, save. Tried LAST, so an
 *   editor-scope command can take a key first; today none takes ⌘Z, which
 *   is how undo wins over the focused CSS editor (decision #21). The
 *   same typing caveat as `editor` applies: an unmodified printable key
 *   here is taken away from every text field, so bind those in `canvas`.
 * Within a scope the most recently bound command wins, so a plugin can
 * shadow a core binding.
 */
export type CommandScope = "drag" | "editor" | "canvas" | "always";

/** What a command runs (and is enabled) with: the keypress, or null for a
 * direct call. */
export interface CommandContext {
  event: KeyboardEvent | null;
  source: "shortcut" | "call";
}

/** A named action. Core commands are `core.<name>`; a plugin's are
 * `<pluginId>.<name>` (the API refuses any other prefix). */
export interface Command {
  id: string;
  /** Sentence case; shown by a later command palette. */
  title: string;
  scope: CommandScope;
  /** Enablement, re-evaluated per keypress (and per direct call) with the
   * same context `run` gets, so it can read the event's target. A throw
   * is reported and read as `false`. Default: always enabled. */
  when?: (ctx: CommandContext) => boolean;
  /** Returning `false` means "did not handle": the key falls through to
   * the next command as if this one were disabled. Anything else handles
   * it (the keypress is default-prevented and stops there). */
  run: (ctx: CommandContext) => void | boolean;
  /** Called on the keyup of the key that ran this command (a held key,
   * like Space for pan mode), and on window blur while it is held. */
  release?: (ctx: CommandContext) => void;
}

/** A key chord. `mod` is ⌘ OR Ctrl (either one, on every platform — the
 * rule since decision #21); `meta` / `ctrl` name one of them exactly,
 * and may not be combined with `mod` (refused). `key` is the event's `key`
 * value; letters are case-insensitive and `"Space"` / `" "` both name the
 * space bar. A shifted punctuation key also matches its unshifted binding
 * (`Mod+/` fires for ⇧⌘/ too); letters never do. The string form is
 * `"Shift+Mod+Z"`, `"Escape"`, `"Delete"`, `"Space"`: modifiers `Mod`,
 * `Shift`, `Alt`, `Ctrl`, `Meta`, then the key. An Alt chord is matched by
 * the PHYSICAL key, because macOS composes ⌥ (⌥K arrives as `˚`, ⌥\ as
 * `«`): name the character a US layout produces unmodified. A BARE
 * modifier — `"Alt"`, `"Shift"`, `"Control"`, `"Meta"` — binds that key's
 * own keydown (with `release`, a held mode: core's ⌥ browse mode); the
 * router never claims such a keydown, so the modifier keeps composing
 * characters and chording (decision #52). */
export interface Shortcut {
  key: string;
  mod?: boolean;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

/** Where an overlay is drawn. `overlay.world` renders INSIDE the camera
 * transform, anchored at the world origin, so what a plugin draws pans and
 * zooms with the items and a 1px stroke is 1 world px. `overlay.screen`
 * renders in screen space, fixed over the canvas container, UNDER core's
 * selection outline: strokes and labels stay constant-size at any zoom
 * (the DevTools model — the grid overlay's choice); position content from
 * `dd.geometry.rect`, which is already in that space. Both are
 * pointer-events: none — an overlay is drawn, never clicked.
 * `overlay.interactive` (decision #67) is screen space too, ABOVE the
 * outline and the item chrome, and what a plugin draws there RECEIVES
 * pointer events: a picker beside the selection, a button on the canvas.
 * Its wrapper is a point at the canvas's top-left, so position every
 * node absolutely from `dd.geometry.rect` / `itemRect` and size it
 * explicitly; the empty space around what you draw still reaches the
 * canvas. */
export type OverlaySlot =
  "overlay.world" | "overlay.screen" | "overlay.interactive";

/** An overlay for the canvas. `render` runs once per mount as a component
 * under the slot's owner: effects and memos created inside it live as
 * long as the overlay is registered. It is wrapped in a
 * `<div data-plugin-overlay="<pluginId>">` filling the slot. */
export interface OverlayRegistration {
  /** Unique within the plugin; also declared in `contributes.overlays`. */
  id: string;
  slot: OverlaySlot;
  render: () => JSX.Element;
  /** CSS for the plugin's own DOM; the kernel mounts it inside the root
   * wrapped in `@layer dream-plugin` (decision #71), above the app's own
   * layer. It can never restyle a document: a page renders in its own
   * shadow root, which no plugin rule reaches (decision #76). The ONE way
   * to ship CSS: a `<style>` element rendered inside the root is
   * unlayered, would beat every layered rule of the app and of every
   * plugin, and is disabled by the kernel with a console problem. */
  styles?: string;
}

/** An action a plugin puts in an item's TITLE BAR (decision #67):
 * one word, revealed when the bar is hovered, for the items `when`
 * accepts — the seam for "do this to that item" without a plugin
 * drawing chrome of its own. The kernel renders it in every bar whose
 * item passes `when`, re-read on every render of the bar (a document
 * change); a click runs `run` with the item and starts no drag. What
 * `run` does is the plugin's, through the write API — one undo step
 * each. */
export interface ItemActionRegistration {
  /** Unique within the plugin; also declared in `contributes.itemActions`. */
  id: string;
  /** Sentence case, short — a word; what the bar shows. */
  title: string;
  /** Which items carry the action. Read the item; track nothing. */
  when: (item: DeepReadonly<DreamItem>) => boolean;
  run: (item: DeepReadonly<DreamItem>) => void;
}

/** A rect in overlay coordinates: px from the top-left of the canvas
 * container — the space of the `overlay.screen` slot and the core
 * selection outline. Already scaled by the zoom (it is the element's
 * getBoundingClientRect, re-based). */
export interface OverlayRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The camera: the world transform is `translate(panX, panY) scale(zoom)`
 * in canvas px, so world → screen is `screen = pan + world × zoom`. */
export interface Camera {
  panX: number;
  panY: number;
  zoom: number;
}

/**
 * The geometry cache (decision #8) as a plugin reads it. The rule
 * every DOM read here obeys (decision #33): call `rect`, `node` and
 * the computed style of a node from an effect's APPLY phase or an event
 * handler — never from a compute phase or JSX, which run before render
 * effects have written the frame's DOM and would read the previous layout
 * (the overlay would trail every pan by one update). Subscribe in the
 * compute phase with `version()`; do the read in apply.
 */
export interface GeometryApi {
  /** The element's border box in overlay coordinates, or null when it has
   * no rendered node. Element ids only — for the box an ITEM occupies, call
   * `itemRect`. Cached per invalidation
   * state: a second call in the same state reads no layout. Reactive — it
   * subscribes to every invalidation trigger — but see the phase rule
   * above for where to call it. */
  rect(elementId: ElementId): OverlayRect | null;
  /** The ITEM's window box in overlay coordinates, or null when it is not
   * rendered — what `rect` is for elements, for the box an item occupies
   * on the canvas whatever its kind. A viewport's window, a media box, an
   * unknown kind's placeholder: all answer here, and an element of a
   * viewport's page is a different (inner) box you reach with `rect`.
   * Same cache, same reactivity, same phase rule as `rect`. */
  itemRect(itemId: string): OverlayRect | null;
  /** The invalidation state's identity: changes exactly when a trigger
   * fired — a pan or zoom, a ResizeObserver report on the canvas or a
   * viewport root, any document mutation, a scroll inside a viewport, or
   * `invalidate()`. Accessor: tracks. Key a per-state cache on it. It
   * reads no element layout, so a compute phase may call it — with ONE
   * exception it tolerates: when the resize trigger moved it re-reads the
   * canvas container's origin (one getBoundingClientRect of the
   * container), which is harmless there because the origin does not
   * depend on the frame's pending render writes. */
  version(): number;
  /** The ResizeObserver trigger alone — bumped when the canvas or a
   * viewport root reports a size change, never by pan/zoom. Accessor:
   * tracks. For consumers whose reads the world transform cannot change
   * (computed style), so a pan does not re-run them per frame. */
  resizeVersion(): number;
  /** Start a fresh invalidation state: every cached rect is dropped and
   * every consumer re-reads, synchronously, in the same flush. For a
   * plugin that moved rendered boxes in a way no trigger sees. */
  invalidate(): void;
  /** The element's rendered node, or undefined when it has none (the
   * live-iframe strategy, decision #29, renders no in-document nodes).
   * An SVG element for an `svg` and everything inside it (decision #75),
   * an HTML element otherwise — `getComputedStyle` and
   * `getBoundingClientRect` serve both; narrow before an `offsetWidth`.
   * Plugins are trusted in-process code (decision #48): this is for
   * `getComputedStyle` reads the API does not wrap — the grid's resolved
   * track lists. Never write to it, never hold it past the current state:
   * the node is the renderer's and may be replaced under the same id. */
  node(elementId: ElementId): HTMLElement | SVGElement | undefined;
  /** The camera, read reactively (tracks all three). */
  camera(): Camera;
}

/** What `measure` is asked for: the named viewports (an unknown id is an
 * error, not a silent skip), else every viewport of the document. */
export interface MeasureOptions {
  viewportIds?: string[];
}

/** Render a document's viewports at their own frames in the canvas tab —
 * the live strategy (decision #29, #43) — each showing its page of the
 * open project, and read back per-element geometry and plain-words
 * findings. Nothing changes; every number is the browser's. A viewport
 * whose page the project does not hold is an error. */
export type MeasureFn = (
  doc: DeepReadonly<DreamDocument>,
  options?: MeasureOptions,
) => Promise<MeasureReport>;

/** A viewport rendered in the LIVE strategy (decision #29, #43) and
 * kept alive between reads: one sandboxed, script-free iframe sized to the
 * frame, so vh/vw/@media/@container are the browser's own answers. Core
 * owns the mount; a plugin owns what it does with it. `measure` is this,
 * mounted, read once and disposed.
 *
 * A viewport mounts its page (`DreamPage`, decision #78) as its own text:
 * the markup, made safe as the canvas makes it, with each live sheet as a
 * `<style>` of its own at the end of its `<head>`, in cascade order, and
 * every `@import` stripped. `read()`
 * names each element by its unique selector (`MeasuredElement.selector`,
 * also its `id`). */
export interface MountedViewport extends BareMountedViewport {
  /** One synchronous read pass over the current layout state: the frame
   * the page was rendered in, every element's box and flags, the
   * measurer's findings. */
  read(): MeasuredViewport;
}

/** A `bare` mount (`MountOptions.bare`): the page alone, with nothing a
 * read pass needs, so it has none — its document and its disposal. */
export interface BareMountedViewport {
  /** The rendered page, for reads the read pass does not make (a node's
   * computed style through its own window, the page's CSSOM). The mount
   * is the caller's alone and nothing done to it is ever stored. */
  document(): Document;
  /** Remove the iframe. Every read after this throws. Always call it —
   * in a `finally` — a mount left behind is a leak the tests refuse. */
  dispose(): void;
}

/** What `mountViewport` renders. */
export interface MountOptions {
  /** Render the same window at this width instead of the frame's own
   * (a width sweep); the frame's height, or its full-page nature, is
   * kept. Absent: the frame's width (1024 for a viewport with no frame,
   * reported as a `no-frame` finding). */
  width?: number;
  /** Pin `transition` and `animation` to none inside the page, so every
   * read is a resting value — for a probe that writes and reads
   * synchronously (a `transition: all 200ms` would otherwise make every
   * remove→read→restore read the start value). A sheet the document
   * adopts (`document.adoptedStyleSheets`), never an element in the page
   * or one of its `document.styleSheets`; never part of the stored
   * document. */
  still?: boolean;
  /** The page alone, with nothing the read pass adds for itself: no
   * stamp on its elements and no container probe in its css, so the
   * copy's `<style>`s, one per live sheet in cascade order, are the page's
   * sheets as the face renders them (their `@import`s out, their relative
   * urls routed) and its tree is the page's, `still` or not. For a plugin that reads or exports the copy itself: the
   * mount is a `BareMountedViewport`, with no `read()`. */
  bare?: boolean;
}

/** What a gate's `run` gets beside the document. */
export interface GateContext {
  /** The viewports the caller asked about; the document is already
   * narrowed to them, so a gate may ignore this unless it addresses
   * viewports by id. Absent: every viewport. */
  viewportIds?: string[];
  /** The page a viewport of the document shows, by its path
   * (`viewport.payload.page`): its markup and every sheet its markup
   * names, in document order — a superset of what applies (DreamPage).
   * At a finalize, the draft's page as it will be written, and the
   * project's for every other path. Undefined for a path that neither
   * the draft nor the project holds. */
  page: (path: string) => DeepReadonly<DreamPage> | undefined;
  /** Core's measurer (decision #48: a gate that needs geometry calls
   * core's measure rather than owning a measurer), each viewport showing
   * the page `page` answers. */
  measure: MeasureFn;
  /** Core's live mount, `dd.mountViewport` with the same options and
   * overloads, of the page `page` answers: the page the judge is judging,
   * which at a draft's finalize is the page about to be written — a new
   * page no file holds yet, a rework as it will be read — not the
   * project's as it is. A gate mounts through this, never
   * `dd.mountViewport`, which mounts the project's page and refuses one
   * the project does not hold. A viewport `page` holds no page for is
   * refused. Dispose each mount, in a `finally`; one the gate leaves open
   * is disposed when its run ends (answered, thrown or timed out), and a
   * mount asked for after is refused. */
  mountViewport: DaydreamApi["mountViewport"];
}

/**
 * A gate (decision #48: the judge is pluggable). Core runs every
 * registered gate in registration order — config order first, then the
 * order the plugin registered them in — on MCP `lint`, over the open
 * project's pages, and at a draft's `draft_finalize`, over the page it is
 * about to write, before any file is (decision #78). `run` gets a plain
 * copy of the document judged — each viewport's page read through
 * `ctx.page(viewport.payload.page)`, and measured and mounted through
 * `ctx.measure` and `ctx.mountViewport`, whose elements a finding names by
 * selector, as the measurer does — and returns findings, each with the
 * severity the AUTHOR declares. The project config may override the
 * severity per gate in either direction. A gate that throws yields one
 * blocking finding naming it — a broken judge never passes silently.
 */
export interface GateRegistration {
  /** Unique within the plugin; also declared in `contributes.gates`. */
  id: string;
  /** Sentence case; names the gate in the finding a throw produces. */
  title: string;
  run: (
    doc: DeepReadonly<DreamDocument>,
    ctx: GateContext,
  ) => Finding[] | Promise<Finding[]>;
}

/** A JSON Schema object (draft 2020-12 or draft-07 vocabulary: `type`,
 * `properties`, `required`, `description`, `enum`, `items`, the numeric
 * bounds). Plugins have no zod; the bridge converts it for the protocol. */
export type JsonSchema = Record<string, unknown>;

/**
 * An MCP tool the BROWSER part registers (decision #48; docs/plugins-
 * plan.md P10): the bridge lists it to every connected harness under its
 * declared `name`, as it is, and forwards each call to `run` in the tab —
 * against the live canvas, with everything `dd` reaches (the document,
 * the selection, the geometry cache, the history-aware writes). For a
 * tool that needs files or processes, ship a host part instead
 * (`@daydream/plugin-api/host`). The `name` MUST be listed in the
 * manifest's `contributes.tools`, match `^[A-Za-z0-9_-]{1,64}$`, and not
 * be a core tool's (`canvas_url`, `canvas_state`, `instructions`,
 * `get_viewport`, `measure`, `lint`, `update_item`, `remove_item`, the
 * eight `draft_*` tools, `resolve_variant`, the `knowledge_*` four) — a
 * collision is refused at
 * registration, never shadowed at connect time.
 * One name, one tool: a
 * second registration under a live name is refused too.
 */
export interface ToolRegistration<
  Input extends Record<string, unknown> = Record<string, unknown>,
> {
  name: string;
  /** Sentence case; what a harness shows in its tool list. */
  title: string;
  /** What the tool does and when to call it — the model reads this. */
  description: string;
  /** The input's JSON Schema; MUST describe an object (`type: "object"`,
   * a `properties` map, `required` where it applies). The bridge validates
   * every call against it before `run` sees the input. */
  inputSchema: JsonSchema;
  /** What the tool does to the world, for a harness deciding whether to
   * ask before each call (see ToolAnnotations). Omitted: the protocol's
   * defaults — may write, may destroy. */
  annotations?: ToolAnnotations;
  /** Executed in the tab. Return JSON: an object becomes the call's
   * structured content and its text; a string is the text as is; a throw
   * is an error result carrying the message. */
  run: (input: Input) => unknown | Promise<unknown>;
}

/** The MCP tool annotations a registration may carry — hints, never
 * enforced: a harness reads them to auto-allow a read or to confirm a
 * destructive call. Core marks its own tools the same way: the reads
 * (canvas_url, canvas_state, instructions, get_viewport, measure, lint,
 * the knowledge tools) read-only; the writes that replace or remove what
 * is there (update_item, remove_item, draft_replace, draft_remove,
 * draft_edit, draft_set, draft_finalize, draft_discard) destructive;
 * draft_open and draft_append only add. */
export interface ToolAnnotations {
  /** The tool changes nothing. */
  readOnlyHint?: boolean;
  /** A write may destroy content that was there (a replacement, a
   * removal) rather than only add. Meaningful when readOnlyHint is false. */
  destructiveHint?: boolean;
  /** Calling it again with the same input changes nothing further. */
  idempotentHint?: boolean;
  /** The tool reaches outside the canvas and the host (the network). */
  openWorldHint?: boolean;
}

/** Payload per hook name. `on(hook, handler)` is typed by this map. */
export interface HookPayloads {
  /** The selected element changed (null: nothing selected). `itemIds` are
   * the selected canvas items' envelope ids (empty when the primary is an
   * inner element or nothing). Fires when the primary OR the item set
   * changes. */
  selection: { elementId: ElementId | null; itemIds: readonly string[] };
  /** The document mutated (any write); `version` is a monotonic counter.
   * `restored` is true when the change was NOT an edit — an undo, a redo,
   * or a document load — the same distinction `dd.historyVersion()` draws
   * (decision #17: an editor re-syncs on a restore even mid-focus,
   * never on an ordinary edit). A restore can notify more than once; the
   * last notification carries the flag. */
  document: { version: number; restored: boolean };
  /** Geometry was invalidated (decision #8): a pan, a zoom, a resize,
   * a document mutation, a scroll or `geometry.invalidate()`. `version` is
   * `geometry.version()`. Fires per invalidation state, so per pan frame
   * while dragging — do bounded work, and read the DOM here (the handler
   * runs after the frame's render effects). */
  geometry: { version: number };
  /** The SET of canvas item ids changed: `added` are the ids present now
   * that were not (in document order), `removed` the ids gone (in their
   * previous order). A paste or a drop adds, a delete removes; a move,
   * a resize or a style edit changes no id and fires `document` only,
   * never this. A load — a restore that replaces the items — reports
   * every old id removed and every new id added, possibly across more
   * than one notification. */
  items: { added: string[]; removed: string[] };
  /** What this plugin holds unwritten is about to be lost — typing
   * waiting on a debounce, say: the document is about to be swapped for
   * another (another project opening in this one's place), or this
   * plugin is being deactivated (turned off,
   * reloaded, stopped by an error). Unlike every other hook it is no
   * change notification: the handler is CALLED, synchronously, before
   * anything the plugin registered is disposed, or once a swap is going
   * ahead (its guard allowed it, right before the store changes) — so
   * what it
   * writes there (`dd.writePage`, `dd.mutateItems`, `dd.updateItem`, each
   * synchronous) lands in the outgoing document and is saved with it. A
   * call that wrote is saved and followed by another, until one writes
   * nothing: a handler may run more than once per swap and must be safe
   * to repeat. A promise it returns is not awaited: write before
   * returning. A throw is logged under the plugin's id and, unlike every
   * other hook's, leaves the handler on; the swap or the deactivation
   * goes on. No payload. */
  leave: undefined;
}

export type HookName = keyof HookPayloads;

export type HookHandler<H extends HookName> = (
  payload: HookPayloads[H],
) => void;

/** One rule of a css text as the kernel's source scan reads it
 * (`dd.core.cssBlocks`): a block, or a statement at-rule. */
export interface CssBlock {
  /** The text before the block — a selector list or an at-rule prelude —
   * its comments taken out as the tokenizer reads them (a comment joins
   * what is on either side of it: `.a`, a comment and `.b` read `.a.b`),
   * trimmed; a statement's, without its `;`. A stray `;` where the parser
   * reads rules alone — the sheet's top level, and the block of a
   * `@media`, `@supports`, `@container`, `@layer`, `@starting-style` or
   * `@keyframes` no style rule encloses — ends nothing: it is read into
   * the prelude of the rule after it, as the parser reads it, so that
   * rule's prelude holds the `;` (`; .b`, `.a;b`, `; @layer q; .c`) and
   * its `range` starts at it; the browser refuses such a rule whole.
   * Among declarations — a style rule's body, a group rule's nested in
   * one, an `@scope`'s own block, `@page`, `@font-face` and the like — a
   * `;` ends a declaration, or nothing, and no prelude holds it. */
  prelude: string;
  /** `[start, end)` of the whole rule in the text, prelude included. */
  range: [number, number];
  /** A statement at-rule (`@import …;`, `@layer a, b;`, or one the text
   * ends in without its `;`, which the parser keeps too) has no block. */
  statement: boolean;
  /** Its own declarations, in source order: none of a rule nested in it. */
  declarations: CssDeclaration[];
  /** The rules nested in it — an at-rule's, and CSS nesting's — in source
   * order. Every array of a block is its own, fresh from each call. */
  children: CssBlock[];
}

/** One declaration as written (`dd.core.cssBlocks`,
 * `dd.core.cssDeclarations`). */
export interface CssDeclaration {
  /** The name as the CSSOM keys the declaration: read as the tokenizer
   * reads a name, escapes decoded (`\63 olor` is `color`) and anything
   * past ASCII kept (`--größe`, `--🎨`), ASCII lower-cased but for a
   * custom property's. */
  property: string;
  /** The value, trimmed, its comments and any `!important` taken out. */
  value: string;
  important: boolean;
  /** `[start, end)` of the declaration in the text, from its name through
   * its `;` when it has one: cutting this range removes the declaration
   * and nothing else. */
  range: [number, number];
}

/** The kernel's pure functions, re-exported so a plugin needs no import
 * from src/ (decision #48): one implementation of the facts about CSS and
 * a page's text the renderer and every plugin share. All pure; none
 * mutates, and none reads the canvas — the ones that take markup, css or
 * an element work on whatever the plugin hands them: a page it parsed
 * itself, a gate's incoming page, a `mountViewport` copy. A page's own
 * vocabulary is the browser's (decision #76): what an element, an
 * attribute or a rule may be is the browser's to answer, not core's. */
export interface CoreApi {
  /** A viewport item's `kind`, `daydream.viewport`: what a plugin that
   * finds, builds or tells apart viewport items compares with. */
  readonly viewportKind: ViewportKind;
  /** Fresh local item id, excluding the renderer's reserved prefix. */
  generateId(): string;
  /** The document's viewport items on its shown canvas, in canvas order. */
  viewportItems(
    doc: DeepReadonly<DreamDocument>,
  ): DeepReadonly<DreamViewport>[];
  /** Tri-state evaluation of an `@media` prelude against a simulated
   * window: true, false, or "unknown" — a query the frame cannot answer
   * (a preference, a pointer), which the renderer leaves for the browser
   * to answer against the real environment. */
  evaluateMediaCondition(
    prelude: string,
    env: MediaEnvironment,
  ): boolean | "unknown";
  /** The window a viewport simulates, for `evaluateMediaCondition`; null
   * when the viewport has no frame. */
  viewportMediaEnvironment(
    viewport: DeepReadonly<DreamViewport>,
  ): MediaEnvironment | null;
  /** The family names a `font-family` value (or a `@font-face`
   * `font-family` descriptor) lists, split on top-level commas, quotes
   * removed, as written — comparison is the caller's. */
  familyNames(value: string): string[];
  /** Every px-axis length a `@media` prelude names — px verbatim, em/rem
   * at the initial font size. What a width sweep should probe. */
  mediaPreludePxValues(prelude: string): number[];
  /** The selector's specificity as selectors-4 counts it — ids; classes,
   * attributes and pseudo-classes; types and pseudo-elements — compared
   * as a triple. `:is()`, `:not()` and `:has()` count their most specific
   * argument, `:where()` zero; a selector list is the maximum over the
   * list. The same count `PageStackRule.specificity` carries. */
  specificity(selector: string): [number, number, number];
  /** A page's stored markup as the kernel parses it: a whole document, in
   * standards mode whatever its doctype says — the parse every selector
   * the kernel answers or resolves is read against (`canvas_state`,
   * `get_viewport`, the draft tools, `measure`). Browser only. */
  parsePage(html: string): Document;
  /** The selector that names `element` and nothing else under `root` (its
   * own document, shadow root or fragment by default): its `#id` when no
   * other element carries it, else the shortest `>`-joined path of tag
   * and class steps, `:nth-of-type` only where a same-looking sibling
   * needs one — the name the kernel gives an element everywhere. Asked of
   * `parsePage(html)`, it is what an agent addresses that element by.
   * Throws when `element` is not under `root`. Browser only. */
  uniqueSelector(element: Element, root?: ParentNode): string;
  /** Every rule of a css text, nested as the text nests them, each with
   * its declarations as written and where each is — the kernel's own scan
   * of a page's css (the CSS editor's), which finds a rule's edges where
   * the browser's parser does: strings, comments, escapes, urls and what
   * a parenthesis or a bracket holds are never structure, the legacy
   * `<!--` and `-->` between a sheet's rules are skipped, and a `;` at
   * its top level ends no rule. It decides nothing about what a rule
   * means: one the browser refuses is still read, as written. Malformed
   * text never throws: an unclosed block runs to the end, as in a
   * browser. */
  cssBlocks(css: string): CssBlock[];
  /** The declarations of a declaration list — a `style` attribute's
   * text — read as `cssBlocks` reads a rule's. */
  cssDeclarations(text: string): CssDeclaration[];
}

/** Per-plugin key/value storage (decision #48): one JSON file per
 * plugin id under the project's `.daydream/plugin-data/`, through the
 * host's storage capability; in memory for the page's life when the host
 * has none. Values must be JSON. Never inside `daydream.json`. */
export interface PluginStorage {
  /** The stored value, or undefined. Waits for host detection, so a read
   * at activation sees what the last session saved. */
  get<T = unknown>(key: string): Promise<T | undefined>;
  /** Store a value; resolves once the host has written it. */
  set(key: string, value: unknown): Promise<void>;
}

/**
 * The escape hatch (decision #48): the raw AppStore. Reachable only
 * from a plugin whose manifest declares `"unstable": true`; every read of
 * `dd.unstable` without it throws. NO contract: the store's shape, its
 * Solid 2.0 discipline (draft-first setters, structuredClone snapshots)
 * and its history rules are invisible in its types, and a plugin author
 * violates them without knowing. Typed `unknown` on purpose — every use is
 * a signal the curated API is missing a method; ask for the method.
 */
export interface UnstableApi {
  store: unknown;
}

/** One rule on a page element's stack (decision #76), as the CSS editor
 * shows it: see `dd.pageStack`. */
export interface PageStackRule {
  /** Where `dd.writePage` writes it back; valid until its sheet's text
   * changes. Opaque. */
  key: string;
  /** The sheet it is written in (decision #78): a project file, a
   * `<style>` block of the page, or a remote sheet. */
  sheet: SheetSource;
  /** The rule's selector as the page wrote it — a nested rule's own
   * (`&:hover`), never resolved against its parents. For the declarations
   * an `@scope` holds of its own, which style its roots, the `@scope`'s
   * prelude (`@scope (.card)`). */
  prelude: string;
  /** The style rules a nested rule sits inside, outermost first, each
   * prelude as written (`.card { &:hover { … } }` → `[".card"]`); empty
   * for a rule that is not nested. */
  parents: string[];
  /** The at-rule preludes it sits inside, outermost first — its sheet's
   * own `media` first when it has one (`@media print` for a
   * `<link media="print">`). */
  conditions: string[];
  /** Its OWN declarations, exactly as written and flush — comments and
   * repeated properties included, any nested rule cut out. */
  declarations: string;
  /** False for a rule with declarations after a nested rule, which a
   * save as one block would move, and for a rule of a read-only sheet
   * (a remote one): shown, not saved. */
  editable: boolean;
  /** False when the rule reaches the element but does not apply now: a
   * `@media` — its sheet's own media included — is false at the frame,
   * or a state (`:hover`, `:focus`…) is not in effect — on the design
   * canvas never; in browse mode a real hover flips it live. */
  active: boolean;
  /** `dd.core.specificity` of the selector that matched: of a list, the
   * heaviest member that matches the element, as the cascade weighs it. */
  specificity: [number, number, number];
  /** The pseudo-element the matching selector named (`::before`),
   * lower-cased, absent for an ordinary element selector. */
  pseudo?: string;
}

/** An ancestor on a page element's stack, for the inherited section. */
export interface PageStackAncestor {
  /** The ancestor's render-time id — what the breadcrumb selects it by. */
  elementId: ElementId;
  /** `tag#id.class` (decision #73). */
  name: string;
  /** Its `style` attribute, one declaration per line. */
  own: string;
  rules: PageStackRule[];
}

/** One of the sheets a page is styled by, as `dd.pageStack` lists them
 * (decision #78): what the CSS editor shows a section for. */
export interface PageStackSheet {
  /** The sheet: a project file, a `<style>` block of the page, a remote
   * sheet — or, `absent`, the file the page's first rule links. */
  source: SheetSource;
  /** Whether a save may write it: false for a remote sheet, and for an
   * inline SVG's `<style>`, whose content the browser reads as markup. */
  editable: boolean;
  /** True for `<page>.css` beside a page with no sheet of its own that a
   * save may write — none of the project's files or `<style>` blocks it
   * applies is one — which the page does not link yet: an `add` naming it
   * links it and writes the rule at its end, creating the file when the
   * project has none of that name (`dd.writePage`). */
  absent: boolean;
  /** True on a variant's own sheet, in a stack read through a variant's
   * viewport (`PageSheet.variant`): its rules are the ones whose `sheet`
   * is this `source`. Absent on every other sheet. */
  variant?: true;
}

/** The declaration that sets a property on an element, as the cascade
 * decides it: `dd.pageWinner`. */
export interface PageWinner {
  /** The winning declaration — its `range` inside `rule.declarations`,
   * or inside the element's `own` when `rule` is null. */
  declaration: CssDeclaration;
  /** The rule holding it, as `dd.pageStack` lists it, or null for the
   * element's own `style` attribute. */
  rule: PageStackRule | null;
  /** The cascade layer the rule sits in, dotted when nested (`a.b`), or
   * null: unlayered, or the element's own. */
  layer: string | null;
}

/** What the CSS editor reads for an element inside a page: `dd.pageStack`. */
export interface PageStack {
  viewportId: string;
  /** The page's sheets, in cascade order: every sheet the page's parse
   * applies, and for a page with no sheet of its own the one its first
   * rule would create (`PageStackSheet.absent`). */
  sheets: PageStackSheet[];
  /** The element's own breadcrumb name, `tag#id.class`. */
  name: string;
  /** The element's `style` attribute, one declaration per line, a
   * switched-off one as its comment. */
  own: string;
  /** The rules reaching it, most important first: by specificity, then
   * the nearer `@scope` root (a scoped rule before one in no scope), then
   * the later in the source — an `@scope`'s own declarations where their
   * block is written. */
  rules: PageStackRule[];
  /** Its ancestors, nearest first. */
  ancestors: PageStackAncestor[];
}

/** Where a mounted element was written in its page's stored `html`:
 * `dd.pageSource`. `[start, end)`, its start tag's `<` to just past its
 * end tag (or past its own content when the parser closed it). */
export interface PageSourceRange {
  viewportId: string;
  start: number;
  end: number;
}

/** A mounted page element, cheaply: `dd.pageElement`. */
export interface PageElement {
  /** The page it is in. */
  viewportId: string;
  /** Its unique selector in the page's STORED markup — what canvas_state
   * answers for it — or null when none can be told (the page changed and
   * has not remounted yet). */
  selector: string | null;
  /** Its parent's render-time id; null for the page's `<html>`. */
  parentId: ElementId | null;
}

/** An edit handed to `dd.writePage`. Each names what it writes: a rule's
 * key its sheet, an `add` its `sheet`, an `html` its page's `path`, a
 * `style` and a `remove` their element's page (decision #78). */
export type PageEdit =
  | {
      kind: "rule";
      viewportId: string;
      key: string;
      /** The declarations as shown: refused if the rule changed since. */
      expected: string;
      declarations: string;
      /** The rules nested in these declarations as they were typed there
       * — the `nested` of the save that wrote them (`PageWritten`).
       * `expected` and `declarations` hold them, so this save replaces
       * them rather than writing them twice. Absent, the declarations are
       * the rule's own, every rule nested in it cut out and kept. */
      nested?: string[];
    }
  | {
      kind: "style";
      elementId: ElementId;
      /** The element's `own` as shown: refused if its `style` changed
       * since. */
      expected: string;
      declarations: string;
    }
  | {
      kind: "add";
      viewportId: string;
      /** The sheet the rule goes in: one of the page's `sheets`' sources. */
      sheet: SheetSource;
      selector: string;
      declarations: string;
      /** A rule key to insert after; omitted, the end of the sheet. */
      after?: string;
    }
  | {
      /** The page's whole markup, as an editor of its text saves it:
       * stored as typed, never cleaned. Refused, by name, when it brings in
       * anything the render walk takes out that `expected` does not hold. */
      kind: "html";
      /** The page's file: its path in the project. */
      path: string;
      /** The page's `html` as shown: refused if it changed since. */
      expected: string;
      html: string;
    }
  | {
      /** A mounted element taken out of the page: its span cut from
       * where it was written, every other character kept. Never the
       * page's `html`, `head` or `body`. */
      kind: "remove";
      elementId: ElementId;
    };

/** The edits that write a page's css — a `rule` save and an `add` — which
 * answer what they wrote (`PageWritten`). */
export type CssPageEdit = Extract<PageEdit, { kind: "rule" | "add" }>;

/** What `dd.writePage` answers when an `add` or a `rule` save wrote. */
export interface PageWritten {
  /** The rule written: an `add`'s new rule, or the rule a `rule` save
   * saved. */
  key: string;
  /** The rules nested in the declarations written (CSS nesting's
   * `.card { gap: 0; .cta { … } }`), at any depth, in source order. A
   * later save of those declarations passes them back as its `nested`. */
  nested: string[];
  /** The rule's declarations as the page's css now holds them — tidied
   * as saved, the `nested` rules included, exactly as written: the next
   * save's `expected`. */
  declarations: string;
  /** Every other rule whose key the write changed, by its key before it:
   * a rule after one the write added, or after declarations that now
   * nest more rules or fewer. A key held across a write is found here. */
  moved: Record<string, string>;
}

/** Where `dd.createPage` places the new page's viewport. */
export interface CreatePageOptions {
  /** Its top-left, world px. Default: free space right of what is on the
   * canvas. */
  position?: { x: number; y: number };
  /** Its frame. Default: full-page, 1024 wide. */
  frame?: { width: number; height?: number };
}

/** What `dd.createPage` made. */
export interface CreatedPage {
  /** The new file's project path: `index.html` in a project with no page
   * yet, else the page's `<title>` made file-safe (`pricing.html`, then
   * `pricing-2.html`). */
  path: string;
  /** The envelope id of the viewport placed for it. */
  viewportId: string;
  /** Each remote file the page names that could not be downloaded into
   * `assets/` — left as written in the file — and why. */
  unvendored: { url: string; reason: string }[];
}

/** What `dd.acceptVariant` wrote. */
export interface AcceptedVariant {
  /** The project files written, in the order written: the page's last
   * local sheet (or its new `<page>.css`), then the page. */
  files: string[];
  /** The variant's own files the host could not remove after (changed
   * meanwhile, or not removable), which stay in `.daydream/variants/`:
   * the variant is accepted all the same, and leaves the canvas. */
  kept: string[];
  /** The project's OTHER pages the accept restyled, by path, sorted:
   * every page beside the variant's own that links the stylesheet its
   * rules were appended to (none when no other page links it). */
  alsoRestyled: string[];
}

/** The curated API object — named `dd` by convention — handed to a plugin's
 * entry. Never the store: history-aware writes and Solid store discipline
 * live behind these methods (decision #48). Reactive reads are Solid
 * accessors (or the live store proxy), so a plugin builds memos and
 * effects over them like any component. */
export interface DaydreamApi {
  /** This plugin's identity, as the loader read it. */
  readonly plugin: { readonly id: string; readonly manifest: PluginManifest };
  /** The live, read-only document — the open project's `daydream.json`
   * (decision #78) — as a fine-grained Solid store proxy. */
  document(): DeepReadonly<DreamDocument>;
  /** The shown canvas's items — `document().canvases[0].items`, reactive
   * the same way. */
  items(): readonly DeepReadonly<DreamItem>[];
  /** The open project's page at `path` (a viewport's `payload.page`): its
   * markup and every sheet its markup names, in document order, as the
   * host read them — read again when a file of it changes on disk — a
   * superset of what applies (DreamPage; `pageStack` reads only the
   * sheets that do) — or undefined for a path the project does not hold
   * (a page removed on disk among them). Reactive, like `document()`. */
  page(path: string): DeepReadonly<DreamPage> | undefined;
  /** The selected element id, or null. A Solid accessor: tracks. The
   * CSS-editor primary; a multi-selection of canvas items is
   * `itemSelection()`. */
  selection(): ElementId | null;
  /**
   * Envelope ids of the selected canvas items (decision #49). Empty
   * when the primary is an inner element or nothing. Accessor: tracks.
   */
  itemSelection(): readonly string[];
  /** Select an element (or nothing). Not a document edit: never undoable.
   * Replaces any item multi-selection. */
  select(id: ElementId | null): void;
  /** Mutate a working item array in one undo step; splice to remove items.
   * Invalid envelopes/changed payloads throw without changing the document. */
  mutateItems(mutation: (items: DreamItem[]) => void): void;
  /** Update one existing item's working copy in one undo step. Its id/kind
   * stay fixed; missing ids are no-ops. History still snapshots the document;
   * use a transaction's update for continuous edits with one snapshot. */
  updateItem(id: string, mutation: (item: DreamItem) => void): void;
  /** Begin a cancellable editing session over items and pages, canceled
   * automatically on unload. */
  beginItemTransaction(options?: {
    onInterrupted?: () => void;
  }): ItemTransaction;
  /** Monotonic counter bumped only when another document is loaded. */
  loadVersion(): number;
  /** Canvas geometry binding, placement and input subscriptions. */
  readonly canvas: CanvasApi;
  /** Undo the last edit burst (decision #20); no-op when empty. */
  undo(): void;
  /** Redo the last undone burst; no-op when empty. */
  redo(): void;
  /** Whether undo/redo have anything to do. Accessors: track. */
  canUndo(): boolean;
  canRedo(): boolean;
  /** Bumped by every document mutation. Accessor: tracks. */
  documentVersion(): number;
  /** Bumped by undo, redo and document load only — never by an edit.
   * Accessor: tracks. The editor's "re-sync even mid-focus" trigger
   * (decision #17). */
  historyVersion(): number;
  /** Bumped when the browser's answer to a STATE selector (`:hover`,
   * `:focus-within`…) may have changed: a hover, focus or press boundary
   * crossed inside a viewport window — dense while the user browses it
   * (⌥ held, decision #52), and otherwise the window's entry and
   * exit and a click's press and release, since the glass is all the
   * pointer meets there — plus browsing's own start and end. Never a
   * pointer move. Accessor: tracks. The trigger, beside
   * `documentVersion()`, that can change what `pageStack` and
   * `pageRuleMatches` answer (decision #53). */
  interactionVersion(): number;
  /**
   * The CSS editor's view of an element inside a page (decision #76): its
   * `style` attribute, the rules reaching it most important first, and
   * its ancestors' rules — every rule's declarations exactly as written.
   * Null when the element is not on a page (an item, nothing). It reads
   * the mounted page; `dd.documentVersion()` and `dd.interactionVersion()`
   * are the triggers that can change the answer.
   */
  pageStack(elementId: ElementId): PageStack | null;
  /**
   * The declaration that sets one of `properties` on the element, as the
   * cascade decides it across every rule reaching the element and its
   * `style` attribute: `!important` over normal; then a declaration on
   * the element over a sheet's; then cascade layers as the page's sheets
   * declare them (a later-declared layer wins for normal declarations, an
   * earlier one for important; unlayered normal beats layered normal and
   * loses to layered important); then specificity, scope proximity and
   * order of appearance. Several names compete as one — a longhand with
   * the shorthands that set it. Only rules active now, and no
   * pseudo-element's. Null when nothing sets them, or the element is not
   * on a page. A DOM read, subscribed as `pageStack` is.
   */
  pageWinner(
    elementId: ElementId,
    properties: readonly string[],
  ): PageWinner | null;
  /**
   * The element ids the rule `key` (a `PageStackRule.key`) of
   * `viewportId`'s page matches right now, in document order: the reverse
   * highlight. The rule is found in the page's css by its key, a nested
   * rule resolved against its parents, and asked of the browser on the
   * page's mounted tree. `[]` for anything but a mounted page, a key the
   * css no longer holds, a selector the browser refuses, or a rule an
   * inactive `@media` excludes right now. A DOM read: call it from an
   * effect's APPLY phase (decision #33), subscribed in compute to the
   * same two triggers as `pageStack`.
   */
  pageRuleMatches(viewportId: string, key: string): ElementId[];
  /**
   * The innermost element of `viewportId`'s mounted page whose span in
   * the stored `html` holds `offset` (`start <= offset < end`), by its
   * render-time id: the text editor's caret carried to the canvas. Null
   * for no mounted page, an offset in no element's span, or an element
   * the safety walk removed (it has no mounted id).
   */
  pageElementAt(viewportId: string, offset: number): ElementId | null;
  /**
   * Where a mounted page element was written in its page's stored
   * `html`: the canvas's selection carried to the text. Null for anything
   * not in a mounted page, or an element the parser supplied (an implied
   * `<body>`, a `<tbody>`), which has no place in the text.
   */
  pageSource(elementId: ElementId): PageSourceRange | null;
  /**
   * A mounted page element's page, its selector in the stored markup and
   * its parent's id — reading the mount and the markup alone, with no
   * rule matching, so it is cheap where `pageStack` is not; and read once
   * per mounted element and page text, so asking again, on every
   * selection, geometry or document change, costs a lookup: keep no copy
   * of its answer. Null for an item, nothing, or an id no mount holds.
   */
  pageElement(elementId: ElementId): PageElement | null;
  /**
   * The render-time id of the ONE element `selector` matches in
   * `viewportId`'s mounted page, resolved against the stored markup as
   * the agent tools resolve one. Null for none, several, a selector the
   * browser refuses, an element the safety walk removed, or a page that
   * is not mounted.
   */
  pageFind(viewportId: string, selector: string): ElementId | null;
  /**
   * Save an edit to a page: a rule's declarations spliced where they came
   * from, an element's `style` attribute, a new rule, or the whole
   * markup. Guarded — a stray brace or an unclosed comment or quote is
   * refused, and so is markup that brings in anything the render walk
   * takes out — and declarations are tidied in shape, not content. An edit
   * is refused when what it edits no longer holds `expected`. Answers the
   * refusal as a sentence. Every edit writes the project's FILES by splice
   * alone (decision #78): a rule's body in its sheet's file (a `<style>`
   * block's in the page's markup), a new rule into the sheet it names, an
   * element's `style` attribute's value, an element's span cut, the markup
   * as typed. One that cannot be written narrowly — a `style` for an
   * element the browser supplied with no tag of its own in the file, say
   * — is refused, naming the way forward, and never written back as the
   * browser serializes the page. An `add` naming `<page>.css` for a page
   * with no sheet of its own it may write links that file in the page's
   * `<head>` and writes the rule at its end — a file of that name already
   * there gains the rule after what it holds, and is never replaced; one
   * the tab has not read is refused at the host, and the same add made
   * again writes into it. The edit is on the canvas, and one undo step, at
   * once, a sheet shared by several pages re-rendering every one; the host
   * writes the files after, each naming the bytes it may replace, and a
   * file that changed on disk since the tab read it wins — the edit is
   * dropped, the files it wrote are read again as the disk holds them,
   * and their undo steps are forgotten; so is an edit to a file the host
   * never writes (a link, bytes that are not UTF-8), saying why. An `add`
   * or a `rule` save answers
   * what it wrote (`PageWritten`), and any other edit null.
   */
  writePage(edit: CssPageEdit): string | PageWritten;
  writePage(edit: Exclude<PageEdit, CssPageEdit>): string | null;
  writePage(edit: PageEdit): string | PageWritten | null;
  /** Core's measurer (see MeasureFn): a document in, the report of its
   * viewports rendered live out. Takes any document — the open one
   * (`dd.document()`), a working copy, a gate's input. */
  measure: MeasureFn;
  /** Core's live mount (see MountedViewport), for a judgement that must
   * read the page more than once: one viewport rendered off-screen at its
   * frame (or `options.width`), resolved once its layout has settled,
   * showing the project's page. The caller disposes it. A gate mounts
   * through its `ctx.mountViewport` instead, which shows the page being
   * judged. */
  mountViewport(
    viewport: DeepReadonly<DreamViewport>,
    options: MountOptions & { bare: true },
  ): Promise<BareMountedViewport>;
  mountViewport(
    viewport: DeepReadonly<DreamViewport>,
    options?: MountOptions & { bare?: false },
  ): Promise<MountedViewport>;
  /** `bare` unknown until run time: what both mounts have. */
  mountViewport(
    viewport: DeepReadonly<DreamViewport>,
    options?: MountOptions,
  ): Promise<BareMountedViewport>;
  /** The geometry cache (decision #8); see GeometryApi for the
   * apply-phase rule every read obeys. */
  readonly geometry: GeometryApi;
  /** Pure core helpers; see CoreApi. */
  readonly core: CoreApi;
  /** This plugin's persistent key/value store. */
  readonly storage: PluginStorage;
  /** Copy an image or a video file's bytes into the open project's
   * `assets/`, named by its bytes, answering the project-relative name an
   * item stores (`pageSrc`, `assets/<file>`; `src`, the same,
   * deprecated). Rejects with no project open, for any other type or one
   * too big, and when this activation has ended. */
  vendorFile(file: File): Promise<{ src: string; pageSrc: string }>;
  /**
   * Make a new page of the open project from `html` (decision #78): a new
   * html file, written as given — its `<style>` and `<link>` kept, nothing
   * merged, nothing cleaned (the render walk leaves what would run off the
   * canvas) — except that each remote image, video, audio, text track
   * and font file it names is downloaded into `assets/` and named there
   * (one that cannot be is left as written, and answered). Named
   * `index.html` in a project with no page yet, else after its `<title>`,
   * file-safe, `-2` and on while the name is taken. The page joins the
   * project's pages and a viewport of it is placed, as ONE undo step; an
   * undo takes the viewport off and leaves the file (a made page's file
   * is the host's write, not an edit's, and no undo removes it). Rejects
   * with no project open, and — the file written, nothing placed — when
   * the project was read again or another opened while it was written,
   * or this plugin was disabled meanwhile.
   */
  createPage(html: string, options?: CreatePageOptions): Promise<CreatedPage>;
  /** ACCEPT the variant the viewport `viewportId` shows (a viewport whose
   * `payload.variant` names one: a copy of its page an agent's
   * `draft_finalize` wrote into the project's `.daydream/variants/`): its
   * markup spliced into its page's file — every byte it did not change the
   * file's own — and its rules appended to the page's last local
   * stylesheet, every rule already there kept (or to a new `<page>.css`,
   * linked, for a page with none); then its files are removed and its
   * viewport leaves the canvas. No undo step. Rejects, nothing written,
   * with the reason: a viewport of a page's own file, the variant's files
   * or its page gone, the page not the text the variant was copied from,
   * a file changed since the canvas read it (read again, the variant's
   * own included), a write of one still owed, a draft reworking the
   * variant, no host. Answers the
   * project files written, any of the variant's files it could not
   * remove after (`kept`), and the other pages that link the stylesheet
   * it appended to, restyled with it (`alsoRestyled`). */
  acceptVariant(viewportId: string): Promise<AcceptedVariant>;
  /** DISCARD the variant the viewport `viewportId` shows: its files
   * removed from `.daydream/variants/` and its viewport off the canvas;
   * nothing else is touched. No undo step. Rejects for a viewport of a
   * page's own file, while a draft reworks it, with no host, and when a
   * file of it could not be
   * removed (named; the variant stays, and a discard again may finish
   * it). */
  discardVariant(viewportId: string): Promise<void>;
  /** Where a file of the open project is served now: `name` resolved as
   * a url in the page at `from` resolves (decision #78) — relative to its
   * folder, or to the project's root for `/…` — or, without `from`,
   * against the project's root, as an item's `assets/<file>` is. Any url
   * that names no project file (an `https:` url, a fragment) comes back
   * as it was. */
  assetUrl(name: string, from?: string): string;
  /** Run a command by id — this plugin's, core's or another plugin's — as
   * a direct call (no scope resolution; its `when` still applies). True
   * when it exists, is enabled and did not decline. */
  runCommand(id: string): boolean;
  /** Withheld unless the manifest declares `"unstable": true`: reading it
   * without the flag throws with a message naming the flag. */
  readonly unstable: UnstableApi;
  /** The open project's conversation with the user's agent (decision
   * #87); see AgentApi. */
  readonly agent: AgentApi;
  /** Screenshots of the canvas's viewports, in the desktop app (decision
   * #87); see CaptureApi. */
  readonly capture: CaptureApi;
  /** Add a panel; disposing removes it. */
  registerPanel(registration: PanelRegistration): Disposable;
  /** Register a declared, namespaced canvas item kind; unload removes it. */
  registerItemKind(registration: ItemKindRegistration): Disposable;
  /** Draw on the canvas, in the world or the screen slot (OverlaySlot).
   * The id MUST be listed in the manifest's `contributes.overlays`;
   * anything else is refused with an error. Disposing removes it. */
  registerOverlay(registration: OverlayRegistration): Disposable;
  /** Put an action in the title bar of the items its `when` accepts
   * (ItemActionRegistration). The id MUST be listed in the manifest's
   * `contributes.itemActions`; anything else is refused with an error.
   * Disposing removes it. */
  registerItemAction(registration: ItemActionRegistration): Disposable;
  /** Register a command. Its id MUST start with `<this plugin's id>.` and
   * be listed in the manifest's `contributes.commands`; anything else is
   * refused with an error. Disposing unregisters it. */
  registerCommand(command: Command): Disposable;
  /** Bind a key chord to a command id — this plugin's or any other's (a
   * later binding shadows an earlier one within the command's scope). The
   * command need not exist yet. Disposing unbinds. An unmodified printable
   * key bound to an `always` or `editor` command is warned about: it
   * would claim that character in every text field. */
  bindShortcut(commandId: string, shortcut: Shortcut | string): Disposable;
  /** Judge the open project's pages on `lint` (see GateRegistration).
   * The id MUST be listed in the manifest's `contributes.gates`; anything
   * else is refused with an error. Disposing removes the gate. */
  registerGate(registration: GateRegistration): Disposable;
  /** Expose a tool to every connected agent (see ToolRegistration): the
   * bridge lists it under its name and forwards calls into the tab. The
   * name MUST be listed in the manifest's `contributes.tools` and be no
   * core tool's; anything else is refused with an error. Disposing removes
   * it from the listing (connected sessions are told the list changed). */
  registerTool<Input extends Record<string, unknown> = Record<string, unknown>>(
    registration: ToolRegistration<Input>,
  ): Disposable;
  /** Subscribe to a hook; the handler runs on every change after
   * subscribing — `leave`'s, before the document is swapped or this
   * plugin deactivated (HookPayloads). */
  on<H extends HookName>(hook: H, handler: HookHandler<H>): Disposable;
}

/** A plugin's default export: called once on activation, under the
 * plugin's own reactive root. Only the SYNCHRONOUS prefix of an async entry
 * runs under that root: create reactive state, effects and `onCleanup`
 * hooks before the first `await`, or subscribe through `dd.on` (which is
 * owned however late it is called). Anything registered after a
 * deactivation is disposed on the spot. */
export type PluginEntry = (dd: DaydreamApi) => void | Promise<void>;

/** The shape of a plugin's entry module. */
export interface PluginModule {
  default: PluginEntry;
}
