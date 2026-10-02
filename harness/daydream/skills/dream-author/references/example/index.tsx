// daydream.example — the worked example docs/plugin-authoring.md embeds
// (decision #48, P13). It exists to be READ: every
// extension point an author meets first, in one folder and nothing more —
// a panel that follows the selection, a badge drawn in the screen overlay
// slot at the selection's top-left, one command with a shortcut, one hook,
// and a toggle remembered through `dd.storage`. It is DISABLED in
// `.daydream/plugins.json`: documentation that must keep compiling and
// keep passing its test, not a feature of the app.

import { createEffect, createSignal, Show, untrack } from "solid-js";

import type {
  DaydreamApi,
  ElementId,
  OverlayRect,
  PanelContext,
} from "@daydream/plugin-api";

import { classPrefix, css } from "./styles";

/** The command's id: `<pluginId>.<name>`, the only namespace a plugin may
 * register under, and declared in `contributes.commands`. */
export const TOGGLE_COMMAND = "daydream.example.toggle-badge";
/** The keys the manifest declares for it. Declaring is not binding: the
 * entry still calls `dd.bindShortcut`. */
export const TOGGLE_KEYS = "Mod+Shift+E";
/** Storage keys, in the plugin's own file
 * (`.daydream/plugin-data/daydream.example.json` through the host). */
export const BADGE_KEY = "badge-visible";
export const LAST_SELECTION_KEY = "last-selection";

export default async function activate(dd: DaydreamApi): Promise<void> {
  // THE SYNCHRONOUS PREFIX. Only what runs before the first `await` runs
  // under the plugin's reactive root, so reactive state and anything that
  // must exist immediately is created here (PluginEntry). Reading is fine
  // here; WRITING a signal is not — the prefix is an owned scope, and
  // Solid 2.0 refuses reactive writes inside one (decision #33). The
  // writes below all happen later: in a command, in a click handler, and
  // after the await.
  const [badgeVisible, setBadgeVisible] = createSignal(true);

  dd.registerCommand({
    id: TOGGLE_COMMAND,
    title: "Toggle the tag badge",
    // canvas scope: the chord carries a modifier, but an unmodified
    // printable key bound in `always` or `editor` would claim that
    // character in every text field (CommandScope).
    scope: "canvas",
    run: () => {
      const next = !badgeVisible();
      setBadgeVisible(next);
      dd.storage.set(BADGE_KEY, next).catch((error: unknown) => {
        console.error(`[${dd.plugin.id}] could not store the toggle`, error);
      });
    },
  });
  dd.bindShortcut(TOGGLE_COMMAND, TOGGLE_KEYS);

  // One hook. A handler is for work OUTSIDE the reactive graph — what the
  // panel and the overlay need they read reactively instead. It fires on
  // every change after subscribing, never for the present state, so the
  // stored value is a change, not the state at activation.
  dd.on("selection", ({ elementId }) => {
    dd.storage.set(LAST_SELECTION_KEY, elementId).catch((error: unknown) => {
      console.error(`[${dd.plugin.id}] could not store the selection`, error);
    });
  });

  // The stored toggle BEFORE the panel and the overlay: `dd.storage`
  // answers once host detection has, and a badge that appears hidden and
  // then flashes on would be a lie about what the last session left. A
  // read that fails (a corrupt file, no host) logs and takes the default.
  let stored: unknown;
  try {
    stored = await dd.storage.get(BADGE_KEY);
  } catch (error) {
    console.error(`[${dd.plugin.id}] could not read the stored toggle`, error);
  }
  if (typeof stored === "boolean") setBadgeVisible(stored);

  // CSS goes through the registration, never a <style> in the JSX: the
  // kernel mounts `styles` inside the root in the dream-plugin layer
  // (decision #71), and no plugin rule reaches a page, which renders in
  // its own shadow root (decision #76); a <style> a plugin renders
  // itself is unlayered and gets disabled.
  const styles = css(classPrefix(dd.plugin.id));
  dd.registerPanel({
    id: "example",
    title: "Example",
    ariaLabel: "Example plugin",
    styles,
    render: (context) => createPanel(dd, context, badgeVisible),
  });
  dd.registerOverlay({
    id: "tag-badge",
    slot: "overlay.screen",
    styles,
    render: () => createBadge(dd, badgeVisible),
  });
}

/** The selected element's tag, read off its rendered node — the page is
 * the browser's, so the browser says what the element is — or null when
 * it has none (an item, nothing, the live-iframe strategy). A DOM read:
 * call it from an effect's apply phase or an event handler only. */
function tagOf(dd: DaydreamApi, id: ElementId): string | null {
  return dd.geometry.node(id)?.localName ?? null;
}

/** The panel body. A FACTORY, not a `<Component>`: the kernel calls it
 * once, as a component is, under the panel's owner, so the effect below
 * lives as long as the panel's body and dies with it. Its selection is
 * read from what the panel is rendered for (`context`), not from `dd`:
 * the same today, and the panel's own should a panel be bound to one
 * item. */
function createPanel(
  dd: DaydreamApi,
  context: PanelContext,
  badgeVisible: () => boolean,
) {
  const p = classPrefix(dd.plugin.id);
  const [tag, setTag] = createSignal<string | null>(null);
  // THE PHASE RULE (decision #33, GeometryApi): the compute phase
  // subscribes — to the selection and to every document change, since an
  // edit can remount the page under a new id — and the apply phase reads
  // the node, once render effects have written the frame's DOM.
  createEffect(
    () => {
      dd.documentVersion();
      return context.selection();
    },
    (id: ElementId | null) => {
      setTag(id === null ? null : untrack(() => tagOf(dd, id)));
    },
  );
  return (
    <div class={`${p}-panel`}>
      <Show when={tag()} fallback={<span>Nothing selected.</span>}>
        {(name) => (
          <span>
            Selected: <span class={`${p}-tag`}>{name()}</span>
          </span>
        )}
      </Show>
      <div>
        <button
          class={`${p}-toggle`}
          type="button"
          onClick={() => dd.runCommand(TOGGLE_COMMAND)}
        >
          {badgeVisible() ? "Hide the badge" : "Show the badge"}
        </button>
      </div>
    </div>
  );
}

/** What the badge draws: the selection's box in overlay coordinates and
 * the tag to print above it. */
interface Badge {
  rect: OverlayRect;
  tag: string;
}

/** The selection's badge, read from the geometry cache: its box in
 * overlay coordinates and its tag, or null when the element has no
 * rendered node (the live-iframe strategy renders none). */
function read(dd: DaydreamApi, id: ElementId): Badge | null {
  const rect = dd.geometry.rect(id);
  const tag = tagOf(dd, id);
  return rect === null || tag === null ? null : { rect, tag };
}

/** The overlay body, in the `overlay.screen` slot: one badge at the
 * selection's top-left, constant-size at any zoom. The slot is
 * pointer-events: none — an overlay is drawn, never clicked. */
function createBadge(dd: DaydreamApi, badgeVisible: () => boolean) {
  const p = classPrefix(dd.plugin.id);
  const [badge, setBadge] = createSignal<Badge | null>(null);
  // THE PHASE RULE (decision #33, GeometryApi): the compute phase
  // subscribes — to every invalidation state and to the selection — and
  // reads no layout; the apply phase does the reading, after the frame's
  // render effects have written the DOM, so the rect is this frame's and
  // the badge never trails a pan by one update.
  createEffect(
    () => {
      dd.geometry.version();
      return badgeVisible() ? dd.selection() : null;
    },
    (id: ElementId | null) => {
      // untrack: the reads are the apply phase's, and an effect callback
      // that reads reactive state outside a tracking scope is a mistake
      // the runtime warns about (STRICT_READ_UNTRACKED). Everything this
      // effect depends on is subscribed to in the compute phase above.
      setBadge(id === null ? null : untrack(() => read(dd, id)));
    },
  );
  return (
    <>
      <Show when={badge()}>
        {(it) => (
          <div
            class={`${p}-badge`}
            style={{ left: `${it().rect.x}px`, top: `${it().rect.y}px` }}
          >
            {it().tag}
          </div>
        )}
      </Show>
    </>
  );
}
