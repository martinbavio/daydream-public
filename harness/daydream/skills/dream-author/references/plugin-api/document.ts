// @daydream/plugin-api/document — the document model's TYPES (decision
// #48, P11). Interfaces and type aliases only, no runtime value: this file
// is the one place the shapes are written, so the package publishes
// self-contained and the framework-free core (src/core/types.ts,
// conditions.ts, environment.ts) imports them FROM here and
// re-exports them for every document consumer. The dependency points from
// core to a types-only package on purpose — a type import is erased, so
// core stays framework-free and DOM-free — and the package never imports
// src/ (eslint.config.js pins it). The viewport kind constant stays in
// core: a value is not a type.

/** An element's id: the one a page's mount stamps (decision #76), never
 * stored and gone with the mount. */
export type ElementId = string;

/** Media evaluation inputs. height null = full-page viewport (no
 * frame.height). */
export interface MediaEnvironment {
  width: number;
  height: number | null;
}

/**
 * The project's own metadata (decision #78): a title for the canvas and
 * notes about the project. Never rendered on the canvas; not CSS. Both
 * optional, so a project Daydream just opened has none.
 */
export interface DreamMeta {
  /** The project's name on the canvas; absent, the folder's name. */
  title?: string;
  /** Markdown: what the project is and what to look at first. */
  notes?: string;
}

/** A page's provenance (decision #78): where it came from, when it was
 * made from somewhere. Never rendered. */
export interface DreamPageMeta {
  /** The page it was transcribed or pasted from. */
  sourceUrl?: string;
}

/** One page of the project as `daydream.json` lists it (decision #78):
 * its path, and nothing of its text. The list is how Daydream knows
 * which html files it has already seen, so only a file new to it is
 * placed on the canvas. */
export interface DreamPageEntry {
  /** Project-relative, with forward slashes: `index.html`,
   * `blog/post.html`. Never absolute, never `.` or `..`. */
  path: string;
  meta?: DreamPageMeta;
}

/**
 * One item on the canvas (decision #48). The ENVELOPE — id, kind,
 * position, frame — is core's: selection, drag-move, the resize handles,
 * the geometry cache and undo operate on it without knowing the kind. The
 * PAYLOAD is the kind's alone: only its renderer and its validator
 * (src/core/kinds.ts) understand it, and an item whose kind nothing
 * registered is preserved verbatim through load and save and rendered as a
 * placeholder frame — a document must never lose data because a kind was
 * missing.
 */
export interface DreamItem<K extends string = string, P = unknown> {
  /** nanoid-style id, generated locally. The renderer's synthetic window
   * ids are derived from this one under a `__`-prefix that the validator
   * refuses on a stored item id (src/core/shape.ts idProblem). */
  id: string;
  /** Dotted kind id in the plugin namespace: core ships `daydream.viewport`;
   * plugins own all other kinds, including the historical media wire ids. */
  kind: K;
  /**
   * Canvas position of the item's box, world px. Stored in the file — the
   * arrangement of items is authored content — and undoable like any
   * document mutation (decision #34).
   */
  position: { x: number; y: number };
  /**
   * The item's box on the canvas. For a viewport this is the simulated
   * window (decision #27/#30): `width` is always the window's width —
   * every viewport has one, even a full-page view, and `vw`/`vi` resolve
   * against it in every mode (as `rem` does against the root font size).
   * `height` present = window
   * mode: the renderer sizes the root to both, gives it the window's
   * scrolling, and resolves `vh`, `vb`, `vmin`, `vmax` against it too.
   * `height` absent = full-page mode: height comes from content and every
   * unit that reads the height passes through. Deliberately NOT part of
   * the page's css — a window's size is not page CSS, so it never appears
   * in the CSS editor. A width or height the page's css gives its `body`
   * means what it means on a real page: it sizes the body box, while
   * units keep resolving against the frame.
   */
  frame?: { width: number; height?: number };
  payload: P;
}

/** The kind id of a viewport item. The viewport keeps its name (#48). The
 * value is core's `VIEWPORT_KIND`, which a plugin reads as
 * `dd.core.viewportKind`. */
export type ViewportKind = "daydream.viewport";

/** Where one of a page's sheets comes from (decision #78): a project
 * file its markup links (`{ file }`, project-relative), the nth `<style>`
 * block of its markup (`{ style: n }`, from 0 in document order), or a
 * remote stylesheet it links (`{ url }`, read-only). */
export type SheetSource =
  { file: string } | { style: number } | { url: string };

/** One stylesheet a page uses, as the host read it (decision #78). */
export interface PageSheet {
  source: SheetSource;
  /** The sheet's text: the file's or the `<style>` block's content,
   * verbatim, or a remote sheet's as the host fetched it, decoded — its
   * relative urls resolved against where a redirect landed it, when one
   * did — and empty when it could not. */
  text: string;
  /** A sheet Daydream never writes: a remote one, or a file of the
   * project the host would refuse every write of (`unwritable`). */
  readOnly: boolean;
  /** A remote sheet the host could not fetch: why, a sentence fragment
   * ("it answered text/html, not text/css"), its `text` empty. The page
   * renders without it, and its viewport says so. Absent for every sheet
   * that was had, and on every sheet that is not remote. */
  error?: string;
  /** A sheet file of the project that no write would land in: why, a
   * sentence naming the file and, where there is one, the way forward
   * ("style.css is a link: it is neither written nor removed through
   * it", "… is not UTF-8 text …; save it as UTF-8 to edit it here"). Its
   * `text` is the file's, and `readOnly` is true. Absent on every other
   * sheet. */
  unwritable?: string;
  /** True on a VARIANT's own sheet (`.daydream/variants/<stem>.<n>.css`,
   * its css alone), in the page a variant's viewport is read as and the
   * one a copy's finalize is judged on: the sheet its markup names
   * nowhere, listed once, where its accept will append its rules — right
   * after the page's last local sheet that applies wherever it is shown,
   * so NOT always last (decision #81). Find it by this, never by its
   * place. Absent on every other sheet. */
  variant?: true;
}

/**
 * A PAGE (decision #78): an html file of the project, as the host read
 * it — its path, its markup verbatim, and every stylesheet its markup
 * names, in document order: the local sheets it links and its `<style>`
 * blocks, a remote sheet among them read-only. That is a SUPERSET of
 * what applies: a `disabled` link, a `<style>` of a type that is not css
 * and the like are listed and never apply; which do, in what order and
 * under what media, is the browser's (`dd.pageStack` reads only those).
 * Several viewports of one page share it, so an edit to it shows in
 * every one.
 *
 * Nothing in either text is a vocabulary the tool defines: any element
 * HTML has or adds, any at-rule CSS has or adds. What would RUN is
 * removed at render by the safety walk, never written back: a page's
 * file is the author's.
 */
export interface DreamPage {
  /** Project-relative, the key `daydream.json` names it by. */
  path: string;
  /** The page's markup, a whole HTML document, as its file holds it. */
  html: string;
  /** Every stylesheet its markup names, in document order: a superset of
   * what applies (above). */
  sheets: PageSheet[];
}

/** The environment a viewport simulates beyond its window's size, which
 * the envelope's `frame` holds (decision #78): the user preferences the
 * environment simulator grows. None is simulated yet; what is stored is
 * kept as written. */
export type ViewportEnv = Record<string, unknown>;

/** A viewport's payload (decision #78): the page it shows, by its path
 * in `pages`, and its own environment. Never the page's text. A
 * viewport that shows a VARIANT of its page — a design session's copy,
 * kept in the project's `.daydream/variants/` until it is accepted into
 * the page or discarded — names it too, and renders as if it sat at the
 * page's path. `variant` is the kernel's, read-only to a plugin: an item
 * write that adds, removes or changes it, or drops its viewport, throws
 * (`dd.acceptVariant` and `dd.discardVariant` end a variant). */
export interface ViewportPayload {
  page: string;
  variant?: ViewportVariant;
  env?: ViewportEnv;
}

/** The variant a viewport shows (ViewportPayload): its markup's path,
 * `.daydream/variants/<page-stem>.<n>.html` (its own css in the `.css`
 * beside it), and `base`, the sha-256 in hex of the page's bytes it was
 * copied from — an accept is refused once the page is not those bytes. */
export interface ViewportVariant {
  file: string;
  base: string;
}

/**
 * One viewport on the canvas: a simulated browser instance (environment
 * simulator, decision #27) — the `daydream.viewport` item, its window
 * frame and canvas position on the envelope, the page it shows by path
 * in the payload (decision #78).
 */
export type DreamViewport = DreamItem<ViewportKind, ViewportPayload>;

/** One canvas of the project (decision #78): a named list of items.
 * v1 shows only the first. */
export interface DreamCanvas {
  id: string;
  /** "First Canvas", "Second Canvas" and so on by default. */
  name: string;
  items: DreamItem[];
}

/**
 * A PROJECT's `daydream.json` (decision #78, format 8): the project's
 * meta, the pages Daydream has seen and the canvases. A page's texts are
 * never here; they are the project's own files, which the host reads.
 */
export interface DreamDocument {
  /** The format. 8 (decision #78). An older document is refused at every
   * door (src/core/validate.ts). */
  version: 8;
  meta?: DreamMeta;
  /** Every page Daydream has seen, in order. */
  pages: DreamPageEntry[];
  /** At least one; v1 shows the first. */
  canvases: DreamCanvas[];
}
