// @daydream/plugin-api/findings — the finding and measure-report TYPES
// (decision #43, #48; P11 moved them here from src/core/findings.ts
// and src/core/measure.ts, which re-export them). Types only: the ONE
// finding shape every gate speaks, and the measure report every judging
// plugin reads. Every message is a sentence the agent can act on, with the
// element and property already named in it; the structured fields exist
// for graders and tooling that address findings, not for rendering.

/** Where a finding came from. The four core sources are named; a plugin's
 * gate names its own (decision #48: the judge is pluggable, so the set
 * is open). */
export type FindingTier =
  | "format"
  | "static"
  | "necessity"
  | "measure"
  | (string & Record<never, never>);

/** What a finding does to a landing (decision #48): `blocking` lands
 * nothing and comes back as the answer; `advisory` lands and comes back
 * alongside the report. The gate's author declares it per finding; the
 * project config may override it per gate (src/ai/gates.ts). */
export type FindingSeverity = "blocking" | "advisory";

export interface Finding {
  tier: FindingTier;
  severity: FindingSeverity;
  /** The gate that reported it — the bare gate id, as the plugin declared
   * it (`static`, `necessity`, …); the runner fills it in. Absent on the
   * format validator's findings, which no gate owns. */
  gate?: string;
  elementId?: string;
  property?: string;
  /** The RULE a finding's declaration sits in: its position among the
   * page's style rules, in source order — the address a gate gives a
   * declaration of the page's css rather than of an element's own
   * `style`. The gate owns the count, so two gates that read the same
   * text agree on it; the gate runner keys and deduplicates findings by
   * it (src/ai/gates.ts). */
  rule?: number;
  message: string;
}

/** Per-element geometry flags. Each is a rule the measurer documents beside
 * its read (src/measure/read.ts): none of them is a layout computation, all
 * are comparisons of browser-reported boxes. */
export type MeasureFlag =
  "overflows-parent" | "overlaps-sibling" | "text-wrapped" | "text-clipped";

/** What a finding is about. `no-frame` is viewport-level: the viewport had
 * no frame, so the measurer assumed a width; its elementId is the root's.
 *
 * A `canvas-` kind is an ADVISORY about the canvas rather than the page:
 * where the canvas, which renders every page in one app document, shows
 * the page otherwise than the live view (the measurer's, and a
 * browser's), which is exact. `canvas-container-units`: an element's
 * `cq*` lengths have no size container above them, on a page that
 * declares one elsewhere, so the canvas answers them against the app
 * window. `canvas-font-face` (viewport-level, the root's elementId): a
 * `@font-face` the page declares has the family (compared
 * case-insensitively), weight, style, stretch and unicode-range of one
 * another viewport on the canvas declares from other sources, and the
 * canvas shows one face for both. */
export type MeasureFindingKind =
  | "overflow"
  | "overlap"
  | "grid-summary"
  | "flex-summary"
  | "container-query-unmatched"
  | "canvas-container-units"
  | "text-clipped"
  | "no-frame"
  | "canvas-font-face";

/** A border box relative to the frame's origin (the simulated window's
 * top-left), in unscaled CSS px. */
export interface MeasuredBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MeasuredElement {
  /**
   * What names the element: its unique SELECTOR in its page (decision
   * #76) — the same string as `selector`. A page's elements have no
   * stored ids, and the render-time ids a mount stamps are gone with the
   * mount, so the only name worth handing an agent is the one it can
   * address the element back by. The selector is unique in the page, so
   * `id` still keys a report's elements one to one, and every finding's
   * `elementId` is a selector too.
   */
  id: string;
  /**
   * A page element's unique selector (decision #76): its `#id` when the
   * page gives it an id no other element shares, else the shortest `>`
   * path of tag, classes and `:nth-of-type` that matches it and nothing
   * else — `querySelectorAll` on the page resolves it to exactly this
   * element. Every element has one: every viewport is a page since
   * format 7.
   */
  selector: string;
  tag: string;
  /** Nesting depth among measured elements: the document root is 0. Tree
   * order is the array order; depth is what the text rendering indents by. */
  depth: number;
  /** Computed `display`, verbatim (`grid`, `flex`, `block`, `none`, …). */
  display: string;
  /** Computed `position`, verbatim. */
  position: string;
  box: MeasuredBox;
  flags: MeasureFlag[];
}

export interface MeasureFinding {
  kind: MeasureFindingKind;
  /** The element's `id` in the same report: its selector (`html` for a
   * `no-frame` finding). */
  elementId: string;
  /** Plain words: the sentence the agent reads. On a page, elements are
   * named by their selectors, in backticks. */
  message: string;
  /** px where meaningful (overflow and overlap amounts, clipped excess). */
  delta?: number;
}

export interface MeasuredViewport {
  id: string;
  /** The window the document was rendered in. Height is the frame's when it
   * has one (window mode); without one (full-page view) it is the content's
   * height, never below the measurer's default window height, and
   * `heightFromContent` says so. Width is the frame's, or the assumed
   * default under `no-frame`. */
  frame: { width: number; height: number; heightFromContent?: true };
  /** The page's measured elements, in tree order: the root, and every
   * element in its body — a foreign element (`svg`, `math`) as its own
   * box, without the shapes inside it; the head is not measured. */
  elements: MeasuredElement[];
  findings: MeasureFinding[];
}

export interface MeasureReport {
  viewports: MeasuredViewport[];
}
