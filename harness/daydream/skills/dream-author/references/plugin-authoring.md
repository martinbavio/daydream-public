# Authoring a Daydream plugin

Daydream is a kernel plus plugins (decision #48). The kernel owns the
document model, the canvas, viewport rendering, selection, history, the
geometry cache, the host and the plugin loader. Everything else — the CSS
editor, the notes pane, the grid overlay, the lints that judge the
project's pages — is a plugin written against the API in this document, with no
private access to the app.

This file is written to be read INSTEAD OF the repository: with it and the
type declarations in `@daydream/plugin-api` you can write a working plugin
without opening `src/`. Where a rule is enforced, the enforcement and its
exact message are given. The API object is called `dd` throughout, by
convention.

Contents:

1. [What a plugin is, and where it lives](#1-what-a-plugin-is-and-where-it-lives)
2. [The manifest](#2-the-manifest)
3. [The entry function](#3-the-entry-function)
4. [The API, member by member](#4-the-api-member-by-member)
5. [Extension points](#5-extension-points)
6. [Styling](#6-styling)
7. [Boundary rules](#7-boundary-rules)
8. [Testing a plugin](#8-testing-a-plugin)
9. [Loading and trust](#9-loading-and-trust)
10. [A complete example plugin](#10-a-complete-example-plugin)

---

## 1. What a plugin is, and where it lives

A plugin is a FOLDER whose name is its id, holding a `manifest.json` (what
it contributes, declared so the shell and the host can list it without
running its code), an `index.ts` or `index.tsx` whose default export is
`(dd: DaydreamApi) => void | Promise<void>`, and its own `package.json`. It
may also ship a host part (`bridge.ts`, Node code the dev-server host runs)
and assets (a `knowledge/` corpus, a `skills/` folder). All parts are
optional except the manifest.

```
<plugin folder>/
  manifest.json          required
  index.ts | index.tsx   the browser part: panels, overlays, commands, gates, tools
  bridge.ts              the host part (Node): MCP tools, prompts, resources
  styles.ts              CSS as a string (never a .css file — see §6)
  icon.svg               optional: the plugin's icon, a small SVG the plugins
                         page (⌥⌘P) shows in colour when the plugin is on and
                         in black and white when it is off; without one the
                         page draws its own mark
  dist/index.js          a plugin OUTSIDE the repo, for the stable host: the
                         browser part prebuilt as one ES module (§9), named
                         by the manifest's `built`
  package.json           a pnpm workspace member when it lives in the repo
  *.test.ts, *.browser.test.tsx   co-located tests
```

Inside this repository `plugins/*` is a pnpm workspace: after creating the
folder, run `pnpm install` from the repo ROOT once, so
`@daydream/plugin-api` and `@daydream/plugin-testing` are linked into it.
(Deleting a plugin folder is the same one command, and must leave build,
lint and tests green.)

Three roots are discovered, in precedence order:

| Root                                 | Origin    | Notes                                                                                       |
| ------------------------------------ | --------- | ------------------------------------------------------------------------------------------- |
| the repo's `plugins/<id>/`           | `repo`    | compiled into the build; first-party                                                        |
| `~/.daydream/plugins/<id>/`          | `user`    | `$DAYDREAM_HOME` replaces `~/.daydream`                                                     |
| `<host>/.daydream/plugins/<id>/`     | `project` | the host's own folder: the dev checkout, or the stable host's state home, `~/Daydream/`     |

The first root carrying an id wins; a duplicate elsewhere is reported and
skipped. Plugins outside the repo do not run until they are trusted (§9).
The `project` root is never an opened project's: a folder the user opens
carries no plugin code that runs, only its `.daydream/plugins.json`
layer (below).

**Id grammar.** Dotted lowercase, at least two segments, each of
`[a-z0-9-]`: `vendor.thing`, `acme.grid`, `daydream.css-editor`. The regex
is `^[a-z0-9-]+(\.[a-z0-9-]+)+$`. The folder name MUST equal `manifest.id`;
a folder whose name differs is skipped with a message.

**The reserved prefix.** `daydream.` is reserved for plugins discovered in
the repo's own `plugins/` folder. A manifest with that prefix found in a
user or project folder is refused:

> `manifest.id "daydream.x": the "daydream." prefix is reserved for plugins in the repo's plugins/ folder`

Pick your own prefix (`vendor.name`). Nothing else in the repo's `plugins/`
folder is reserved: the prefix rule is about the ORIGIN, not the folder's
other contents.

**Which plugins run** is the user's `~/.daydream/plugins.json` — the
defaults for every project, and the one place trust is recorded — which
the plugins page (⌥⌘P) writes:

```json
{
  "enabled": ["daydream.css-editor", "daydream.media"],
  "gates": { "mrbavio.css-author": { "necessity": "advisory" } },
  "trusted": {
    "acme.grid": { "hash": "<sha256>" },
    "acme.team": { "dirs": { "/Users/me/Daydream/.daydream/plugins/acme.team": "<sha256>" } }
  }
}
```

An open project's `.daydream/plugins.json`, committable and written by
hand, overrides it per setting, without restating the rest:

```json
{
  "enabled": ["acme.swatches"],
  "disabled": ["daydream.media"],
  "gates": { "mrbavio.css-author": { "static": "advisory" } }
}
```

`enabled` turns a plugin on for the project (after the user's, in the
project's order), `disabled` turns one of the user's off, and a severity
replaces that one gate's. A `trusted` block in a project file is ignored:
a project can turn your plugin on, never vouch for it (§9). `enabled` is
the activation order and the order of the first panel stack. No file in either place means a
bare canvas — the app runs with no plugins at all. An unknown key, a
non-plugin-id in `enabled`, `disabled` or as a `gates` key, a plugin in
both, or a severity that is not `blocking`/`advisory` throws with a
message rather than being ignored: in your file, that means no plugins
until it is fixed; in a project's, only the project's settings are
dropped — yours stand, and the host logs why. The project's file is read
only as the project's own plain file, never through a link. The plugins
page cannot move a project's plugin among yours: the
project's plugins follow yours, in its file's order. A plugin folder that exists but is not enabled is discovered and
not activated: its code is never even fetched.

---

## 2. The manifest

`manifest.json` is validated by one framework-free validator that both the
shell's loader and the host apply, so the two can never disagree. Every
problem is one sentence; the plugin is skipped, never the app.

| Field          | Type                                    | Required | Meaning                                                                |
| -------------- | --------------------------------------- | -------- | ---------------------------------------------------------------------- |
| `id`           | string                                  | yes      | dotted lowercase; equals the folder name                               |
| `name`         | non-empty string                        | yes      | human name (shown in disclosures)                                      |
| `version`      | non-empty string                        | yes      | the plugin's own version                                               |
| `api`          | `"major.minor"`                         | yes      | the plugin API version it was built against (e.g. `"1.2"`); it runs where the API has the same major and at least this minor, and is refused anywhere else (§9) |
| `contributes`  | object                                  | no       | what it registers, declared (below)                                    |
| `permissions`  | `{ name, reason }[]`                    | no       | disclosure only — never enforced                                       |
| `unstable`     | `true`                                  | no       | opt in to `dd.unstable`; first-party may not set it                    |

Any other top-level key is refused (`manifest has an unknown key "x"`), and
so is any unknown key inside `contributes` — a typo must not silently
contribute nothing.

### `contributes`

Eight keys are ENFORCED AT REGISTRATION: registering something the manifest
does not declare throws, so the declaration and the code cannot drift.

| Key         | Type                       | Enforced                                                                             |
| ----------- | -------------------------- | ------------------------------------------------------------------------------------ |
| `panels`    | `string[]`                 | `dd.registerPanel({ id })` must be listed                                             |
| `itemKinds` | `string[]`                 | `dd.registerItemKind({ kind })` must be listed; kind equals the plugin id or is a dotted descendant |
| `overlays`  | `string[]`                 | `dd.registerOverlay({ id })` must be listed                                           |
| `itemActions` | `string[]`               | `dd.registerItemAction({ id })` must be listed — bare ids                            |
| `commands`  | `string[]`                 | `dd.registerCommand({ id })` must be listed, and every id starts with `<pluginId>.`   |
| `shortcuts` | `Record<keys, commandId>`  | each key must parse as a chord; each value must be one of THIS plugin's command ids   |
| `gates`     | `string[]`                 | `dd.registerGate({ id })` must be listed — bare ids, no prefix                        |
| `tools`     | `string[]`                 | `dd.registerTool({ name })` and a host part's `registerTool` must be listed; each name matches `^[A-Za-z0-9_-]{1,64}$` and is no core tool's |

Every name these keys list is judged when the plugin is admitted — a
command id in your namespace, a tool name under the protocol's grammar
and no core tool's, an item kind of your own (§5.8), a prompt under no
core prompt's — so a malformed one refuses the whole plugin with its
reason, before any of it runs, and the plugins page shows that reason
on its tile as it shows a version's (§9); registration then asks only
whether a name is listed.

`shortcuts` is a DECLARATION, not a binding: the entry still calls
`dd.bindShortcut`. Declaring it is what lets a future command palette and
the host list your keys without running your code.

Four keys are HOST-SIDE — read by the dev-server host, never by the page:

| Key            | Type     | Effect while the plugin is enabled                                                                                 |
| -------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `prompts`      | `string[]` | names the host part may register as MCP prompts — never `dream-author`, the kernel's own                            |
| `resources`    | `string[]` | names the host part may register as MCP resources                                                                  |
| `instructions` | string   | appended to the MCP server instructions under the plugin's name, read at connect time (a toggle applies next connect) |
| `knowledge`    | string   | plugin-relative folder of frontmattered markdown the core `knowledge_*` tools serve as `<pluginId>/<file>`           |

`knowledge` must stay inside the plugin: an absolute path or one containing
`..` is refused. Its `private/` subfolder is served by the local host only
and never indexed into a committed index.

### `built`

Optional, for a plugin outside the repo: the plugin-relative path of its
browser part prebuilt as one ES module — `"built": "dist/index.js"`. The
stable host (the Homebrew install) ships no compiler and serves exactly
that file; the dev host prefers `index.tsx` beside it when both exist,
since that is what you are editing. How to produce it is §9. A repo
plugin never sets it: those are compiled into the page.

### `permissions` and `unstable`

`permissions` is a list of `{ name, reason }` — both non-empty strings. It
is DISCLOSURE: nothing is enforced at runtime, because plugins are trusted
in-process code with no sandbox. The list is what the trust prompt and the
plugins page show for a non-repo plugin (§9), so name what you actually do
("network", "reads the project folder") and say why.

`unstable: true` opts into `dd.unstable`, the raw app store. Reading
`dd.unstable` without the flag throws:

> `<id>: the unstable API is withheld; declare "unstable": true in manifest.json to opt in (every use is a signal the curated API is missing a method)`

The store has NO contract — its shape, its Solid 2.0 discipline and its
history rules are invisible in its types — so every use is a sign the
curated API is missing a method. Ask for the method. A manifest under
`plugins/` (first-party) may not set the flag at all.

---

## 3. The entry function

```ts
import type { DaydreamApi } from "@daydream/plugin-api";

export default function activate(dd: DaydreamApi): void {
  // register things
}
```

`PluginEntry` is `(dd: DaydreamApi) => void | Promise<void>`. It is called
ONCE, on activation, eagerly, in config order, one plugin at a time — so
registration order follows config order. A plugin that throws is reported and
skipped; the shell and the plugins after it are unaffected.

**Activation timing.** Plugins activate after the shell has mounted and
after host detection has answered, so `dd.storage` can be read in the entry
(§5.7). Nothing in the app waits for your entry: register early and let
reactive reads fill in later.

**The synchronous-prefix rule for async entries.** Only the code before the
first `await` runs under the plugin's own reactive root. Create reactive
state, effects and any `onCleanup` there. After an `await` there is no
ambient owner — which is exactly why `dd.on(...)` is safe to call late (the
kernel owns that subscription itself, however late it is created). Two
consequences worth knowing:

- WRITING a signal in the synchronous prefix throws
  (`[REACTIVE_WRITE_IN_OWNED_SCOPE]`, Solid 2.0): the prefix is an owned
  scope. Write from an event handler, a command's `run`, a hook handler or
  an effect's apply phase — or after the first `await`, as the example
  plugin does when it applies a stored value.
- Anything registered after the plugin was deactivated is disposed on the
  spot, so a slow entry can never leave a panel behind.

**Disposables and unload.** Every `register*` and `on` returns
`Disposable = { dispose(): void }` — an object, not a callable. The kernel
tracks each one on the plugin instance and disposes them in REVERSE
registration order on unload, along with the plugin's reactive root, so
every effect and memo created under it dies too. You only need to keep a
handle when you want to remove something earlier than that; disposing twice
is a no-op.

Unloading happens when the plugin is disabled in config, when
`core.reload-plugins` runs, and when the page goes away.

**A throw costs your contribution, never the app.** In Solid 2.0 an
error nothing catches halts every update in the app, so the kernel
catches yours where it mounts them. A panel, overlay or item renderer
that throws — while rendering, in a memo, in a JSX expression or in an
effect's apply phase — is replaced: a panel by one caption line under
its title (`This panel stopped: …`), an item by its placeholder naming
the kind and the error, an overlay by nothing; the other panels and the
canvas keep running. A `dd.on` handler that throws is switched off.
An effect or memo your entry created under the plugin's root that
throws unloads the whole plugin. Each is logged under your plugin's id
(`[plugins] <id>: …`), and nothing comes back until the plugin reloads.
An item kind's other functions (§5.8) are caught where the kernel calls
them and cost only that answer, asked again next time and logged once
per function: an item whose `payloadProblem` throws shows as a
placeholder that keeps its payload, a `name` that throws titles it with the kind's id, a `describe`
that throws gives none, a `normalize`
or `resize.onResize` that throws leaves the item as it was — a payload
whose `normalize` throws, or whose normalized copy your `payloadProblem`
then throws on, lands or is written exactly as it came, not normalized,
as a kind nothing registered would take it — an `editing`
that throws reads as not editing, and a `rename` that throws is refused
with nothing written.

---

## 4. The API, member by member

`dd` is a curated object, never the store. Each member below is marked:

- **accessor** — a Solid accessor (or the live store proxy): reading it
  inside a memo, an effect's compute phase or JSX SUBSCRIBES.
- **one-shot** — a plain call; reading it tracks nothing.
- **registration** — returns a `Disposable` the kernel tracks.

### 4.1 Identity, document and selection

| Member                     | Kind      | Contract                                                                                       |
| -------------------------- | --------- | ---------------------------------------------------------------------------------------------- |
| `dd.plugin`                | one-shot  | `{ id, manifest }` — this plugin's id and a frozen copy of its manifest.                        |
| `dd.document()`            | accessor  | The live, deeply read-only document — the open project's `daydream.json` (a fine-grained store proxy). Writes through it do nothing. |
| `dd.items()`               | accessor  | `document().canvases[0].items` — the shown canvas's items, in canvas order.                     |
| `dd.page(path)`            | accessor  | The open project's page at `path` — `{ path, html, sheets }` — or `undefined`.                    |
| `dd.selection()`           | accessor  | The selected element id, or `null`. The CSS-editor primary.                                     |
| `dd.itemSelection()`       | accessor  | Envelope ids of the selected canvas items; empty when the primary is an inner element or nothing. |
| `dd.select(id)`            | one-shot  | Select an element (or `null`). Not a document edit: never undoable. Replaces any item multi-selection. |

An item is `{ id, kind, position: {x, y}, frame?: {width, height?}, payload }`.
`kind` is `daydream.viewport` (payload `{ page, variant?, env? }` — a `ViewportPayload`,
decision #78: the page the viewport shows, by its path in the open
project, the variant of it shown instead of its file when there is one
(a `ViewportVariant`, below: the kernel's, read-only to a plugin), and the environment it simulates beyond
its frame; the item is a `DreamViewport`), or, with the optional Media plugin, `daydream.image` (payload
`{ src, label?, fit?, focalPoint? }`) / `daydream.video` (payload
`{ src, label? }`). `label` is the name the item's title bar shows and
renames, absent when it has none, never empty. Image `fit` is `"cover"` or
`"contain"`; `focalPoint` is a normalized `{ x, y }` crop position. Plugins
can register additional kinds through
`dd.registerItemKind`; the text plugin in the daydream-plugins repository
supplies plain canvas text as `mrbavio.text`.
An unknown kind, including a disabled plugin's items, is preserved verbatim and rendered as a
placeholder. The document itself is a
`DreamDocument`, `{ version, meta?, pages, canvases }`; `version` is 8,
`pages` lists the project's pages by path (`DreamPageEntry`), and each
of `canvases` (`DreamCanvas`, `{ id, name, items }`) is a canvas — the
canvas shows the first.

A PAGE (`DreamPage`) is an html file of the project: `{ path, html,
sheets }`, its markup as its file holds it and every stylesheet its
markup names, in document order, each a `PageSheet` `{ source, text,
readOnly, error?, unwritable?, variant? }` whose `source` (`SheetSource`) is
`{ file }` (a project file its markup links — `readOnly`, with an
`unwritable` sentence saying why, when the host would refuse every
write of it: a link, bytes that are not UTF-8), `{ style }` (its nth
`<style>` block, from 0) or `{ url }` (a remote sheet, `readOnly`: its
text as the host fetched it, or empty with an `error` saying why it
could not be, the page rendering without it); `variant` is `true` on
one sheet only, a VARIANT's own, in the page a variant's viewport renders
as (below). `sheets` is a superset of what
applies: a `disabled` link, a `<style>` of a type that is not css and
the like are listed and never apply. Which do, in what order and under
what media, is the browser's: `dd.pageStack` reads only those. Several
viewports of one page read one page: `dd.page(viewport.payload.page)`.
A page follows its files: when one changes on disk outside Daydream (an
editor, an agent, git), the page is read again and `dd.page` answers the
new text, reactively — a page gone answers `undefined`, while its
viewports stay on the canvas.

A page's vocabulary is the browser's: any element HTML has, any CSS —
comments, nesting, `!important`, at-rules. What cannot be made safe at
render time (`script`, `embed`, `object`, `frameset`, `base`, the executing
attributes) is removed from what renders, never from the file. A page's
elements are NOT in the document: the canvas parses `html` and mounts it,
with its sheets, in the viewport's shadow root, and stamps each element with a render-time id —
the `ElementId` the selection, `dd.geometry` and `dd.pageStack` take. It
is never stored, and a remount (a markup write, a document load) gives
the element a new one. To read an element, read its rendered node
(`dd.geometry.node`); to change its styling, write the page's text
(`dd.writePage`, §4.4).

**Selection is an element id inside a viewport's page, or an item's
envelope id.** The page an element sits in is `dd.pageStack(id)?.viewportId`
(null for an item or nothing). With nothing selected there is no viewport
to speak of, and what a panel shows then is the plugin's own choice. A
multi-selection of canvas items (Shift-click or a marquee) is
`dd.itemSelection()` — envelope ids; `dd.selection()` is the last-clicked
(primary) among them.

`dd.items()` types `payload` as `unknown`, because a kind's payload is that
kind's business. For viewports, `dd.core.viewportItems(doc)` gives the
typed list of viewports instead — reach for that rather than casting —
and `dd.page(viewport.payload.page)` the page each shows.

**Id namespaces.** A COMMAND id must start with `<pluginId>.`; a panel,
overlay or gate id is bare (`"palette"`, not `"daydream.palette.palette"`)
and unique within the plugin, since the config keys a gate's severity as
`gates[<pluginId>][<gateId>]`.

### 4.2 Writes (history-aware)

Each write is ONE history step. A page's text is written through
`dd.writePage` (§4.4), an item's envelope or payload through the item
writes below.

`dd.mutateItems(mutation)` passes a mutable working item array and commits the
write as one undo step. Push to insert, splice to remove, or edit an item's
payload/frame/position. Do not retain draft references. Removed items and
elements are pruned from the selection automatically, including in sessions;
cancel and undo restore the previous selection.
Invalid envelopes, duplicate/missing ids, changing an existing id's kind,
a viewport of a page the project does not list, a write that drops a
variant's viewport or adds, removes or changes a `payload.variant` (below),
and invalid changed payloads throw before any document/history write. Unchanged payloads remain opaque, so a
plugin's older dormant data cannot block another item's edit. Item writes
are generic: they can arrange or update another kind's items too, subject
to that kind's registered validator — a viewport's changed payload is held
to `{ page, variant?, env? }` — `variant` never yours to write — and one carrying a page's text (`html`, `css`) is
refused, with a pointer at `dd.createPage` below: a page's text is its
file's, never an item's (decision #78).
`dd.createPage(html, options?)` makes a new page of the open project:
a new html file, and a viewport of it on the canvas, as ONE undo step
(decision #78). What it is for: a paste of a page, a plugin that builds
one. The file is written as `html` is given — its `<style>` and `<link>`
stay in the markup, nothing is merged into a sheet, and nothing is
cleaned (the render walk leaves what would run off the canvas, as for
every page) — except that each remote image, video, audio, text track
and font file it names (a media attribute, a `style` attribute's or a
`<style>` block's `url()`) is downloaded by the host into the project's
`assets/`, under the guard every host fetch takes and one budget per
page, and named there. The host names the file: `index.html` in a
project with no page yet, else the page's `<title>` as the browser's
parse reads it, made file-safe (`Pricing & plans` → `pricing-plans.html`),
with `-2`, `-3` and on while the name is taken; always at the project's
root. `options` is `CreatePageOptions`: `position` (world px; default
free space right of what is on the canvas) and `frame` (default 1024
wide, full-page). It resolves to a `CreatedPage`, `{ path, viewportId,
unvendored }`: the new file's path, the viewport placed for it, and each
remote file that could not be downloaded — left as written in the file
(the canvas loads a page's own `https:` media) — with why, which is
yours to say. An undo takes the viewport off and leaves the file, listed
in `daydream.json`'s `pages`, so it stays off the canvas as a page whose
viewports were removed does: a made page's file is the host's write, not
an edit's, and no undo removes it. It rejects, writing nothing, with no
project open, no host, or options, a `position` or a `frame` that is no place; and, the file
written but nothing placed, when the project was read again or another
opened while the host wrote it, or your plugin was disabled meanwhile
(the page is placed when its project is read next). Capture nothing across it: what it answers is all there is.

A VARIANT is a copy of a page an agent built (`draft_open { copyOf }`)
and finalized into the project's `.daydream/variants/` — never into the
site — until it is accepted or discarded: `<page-stem>.<n>.html`, its
markup, and the `.css` beside it, holding its own css alone. It is shown
by a viewport of its page whose `payload.variant` names it, a
`ViewportVariant`, `{ file, base }`: `file` its markup's path, `base` the
sha-256 (hex) of the page's bytes it was copied from. It renders as if it
sat at its page's path — every relative url of its markup resolves as
the page's does — painted as the page its accept will leave, its rules
where the accept writes them (decision #81); its elements are not
selected, and removing its viewport is not how it ends.

Its own sheet is found by `variant: true` on it — `PageSheet.variant` in
the page it renders as, `PageStackSheet.variant` in `dd.pageStack` —
never by its place, since it is not always last. It is listed once,
right after the listing of the page's LAST local sheet that applies
wherever the page is shown (a live project file under no media query; a
later `disabled`, print or other-`title` listing of it is passed over),
the sheet its accept appends its rules to, so a `<style>` block or a
remote sheet after that one comes after it, as it will once they are
appended. A page with no such sheet has its rules appended to
`<page>.css`, linked at the end of its head: the variant's sheet comes
where that link would stand — after every sheet of the head, before
every sheet of the body — right after `<page>.css` itself when the
project holds one the markup does not list already (listed there
`readOnly`, with an `unwritable` sentence: the page does not link it
yet). Its own sheet is last only where its rules land nowhere: css with
nothing in it, or a page a sheet cannot be linked into (no `</head>`
tag, or a link that would not read back), whose accept is refused.

The list gives its rules one place; the canvas and the measurer
(`dd.measure`) PAINT the page as the accept will leave it: the file the
rules go to holding them after its own text at every listing of it — a
later listing under a media query that matches carries them too — and,
for a page with no local sheet, `<page>.css` linked at the end of its
head. So an at-rule that reads otherwise after another sheet's rules
(`@namespace`, `@import`), or a layer the file names first, reads on
the canvas as it will in the site. A variant of `blog/post.html` whose
markup is

```html
<head><link rel="stylesheet" href="../style.css"><style>.title { color: red }</style></head>
```

is a page whose `sheets` are, in order, `{ source: { file: "style.css" }
}`, `{ source: { file: ".daydream/variants/post.1.css" }, readOnly: true,
unwritable: "…", variant: true }` and `{ source: { style: 0 } }` — so the
`<style>` block's `.title` wins over a `.title` the variant sets, on the
canvas as in the site after the accept — and a variant of a page with
no local sheet, `<head><style>…</style></head><body><style>…</style>…`,
lists `{ style: 0 }`, `{ file: "blog/post.css" }` (only when the project
holds that file and the markup does not link it already), its own
sheet, then `{ style: 1 }`. Its viewport is the kernel's: it comes with the finalize and goes
with the accept or the discard, so an item write (`dd.mutateItems`,
`dd.updateItem`, a transaction's) that drops it, or that adds, removes or
changes a viewport's `payload.variant` — a new viewport carrying one, or
the page a variant's viewport is of, included — throws, in one sentence
naming `dd.acceptVariant` and `dd.discardVariant`; a move, a resize or
an `env` of it is an edit like any other. What it renders is not its
page's file: `dd.page(viewport.payload.page)` is the page's own file even
for a variant's viewport, never the variant. The element and rule doors
read it as it renders — `dd.pageFind`, `dd.pageElement`, `dd.pageStack`
(every rule and sheet `editable: false`, its own sheet `variant: true`)
and `dd.pageRuleMatches` are of the variant's markup and its own sheet
where it renders — and `dd.writePage` writes
nothing through it: a `style`, `remove`, `rule` or `add` edit there
answers a sentence naming `dd.acceptVariant`, since the variant is
scratch and its page's file is not what it shows. To read what it
renders as a whole, mount it: `dd.mountViewport(viewport)` and
`dd.measure` mount the variant, as the canvas shows it.
`dd.acceptVariant(viewportId)` accepts it: its markup is spliced
into the page's file (every byte it did not change is the file's own)
and its rules are appended to the page's last local stylesheet that
applies wherever the page is shown — every rule already there kept, so
a sheet other pages share keeps theirs — or to a new `<page>.css`,
linked, for a page with none; then its files are removed and its
viewport leaves the canvas. It resolves to an `AcceptedVariant`, `{ files,
kept, alsoRestyled }`: the project files written, any of the variant's
own files the host could not remove after (changed meanwhile, or not
removable), which stay — the variant is accepted all the same — and the
project's other pages that link the stylesheet its rules were appended
to, sorted by path, which it restyled too (decision #82; new in API 1.1).
A plugin's accept is not held back for them, as the canvas's Accept and
the agents' `resolve_variant` are until those pages are named: if your
plugin accepts on a gesture of its own, tell the user the pages its
answer names. It rejects, nothing
written, for a viewport of a page's own file, a variant whose files or
page are gone, a page that is not the bytes the variant was copied from
(make another from the page as it is), a file changed since the canvas
read it — the variant's own files included, changed outside Daydream
(the canvas reads it again) — or one whose change is still being
written, a stylesheet that ends inside a comment, a string or a block,
a variant a draft is reworking (finalize or discard the draft first),
and with no host. Its remote media stay as written: nothing is
downloaded. `dd.discardVariant(viewportId)` discards it: its files
removed and its viewport off the canvas, nothing else touched; it
rejects, the variant still there, while a draft reworks it and when a
file of it could not be removed, naming it. Neither is an undo step — the variant's files are in
`.daydream/`, which no undo writes — and the canvas's own Accept and
Discard in the variant's title bar, and the agents' `resolve_variant`
tool, take the same path; only they warn first of the other pages an
accept restyles. An agent's `draft_open { from }` on a
variant's viewport reworks the variant itself, its finalize writing the
variant's files, never the page.

Changed payloads must be JSON-compatible: cycles, non-finite numbers,
BigInts, functions and symbol keys are refused. Undefined object properties
retain the format's absent-optional meaning; the kind's validator still
checks their names and values.

`dd.updateItem(id, mutation)` updates just one existing item's working copy
as one undo step; its envelope id and kind cannot change. Missing ids are
no-ops. Its preparation never clones or serializes unrelated items. History
still captures the document for this undo step; for continuous edits use a
transaction's `update` below, with one snapshot at the start of the session.

`dd.beginItemTransaction({ onInterrupted? })` returns an `ItemTransaction`:
`mutate(items => ...)` applies batch edits, while `update(id, item => ...)`
copies and validates only that item. Both apply live and return false after
the session ends (`update` also returns false for a missing item).
`commit()` keeps them as one undo step, and `cancel()` restores the starting
document and selection. An unrelated write, undo/redo or document load ends
the session and calls `onInterrupted`; stale cancellation cannot overwrite
newer work. An active session is canceled automatically on plugin unload.
Starting another transaction commits and interrupts the previous one before
capturing the new session's starting state.
New item writes and selections from a deactivated plugin are ignored.

The session covers the pages' files too: `write(edit)` takes a `PageEdit`
exactly as `dd.writePage` (§4.4) does and answers as it does, and its
splices are the session's — with the item writes one undo step on
`commit()`, and none on `cancel()`, which puts the files back as they
stood when the session began (a rule or a sheet an `add` created goes
with it). What a drag that writes a rule on every frame needs: history's
typing burst would otherwise split the drag at every pause, and an Escape
after a pause would be a step of its own. A session whose writes net to
nothing records no step. A file the session wrote changed on disk ends it
as an outside write does, before the file's undo steps are forgotten; a
session that never wrote the file keeps going.

### 4.3 History and versions

| Member                  | Kind     | Contract                                                                                            |
| ----------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `dd.undo()`             | one-shot | Undo the last edit burst; no-op when empty.                                                          |
| `dd.redo()`             | one-shot | Redo the last undone burst; no-op when empty.                                                        |
| `dd.canUndo()`          | accessor | Whether undo has anything to do.                                                                     |
| `dd.canRedo()`          | accessor | Whether redo has anything to do.                                                                     |
| `dd.documentVersion()`  | accessor | Bumped by EVERY document mutation.                                                                   |
| `dd.historyVersion()`   | accessor | Bumped by undo, redo and document load ONLY — never by an edit. The "re-sync even mid-focus" trigger for an editor that holds its own text. |
| `dd.loadVersion()`      | accessor | Bumped only when a different document is loaded. |

### 4.4 `dd.geometry` — the geometry cache

Geometry is READ from the DOM and cached per invalidation state; nothing is
computed. `OverlayRect` is `{ x, y, width, height }` in overlay coordinates
— px from the canvas container's top-left, already scaled by zoom, the
space the `overlay.screen` slot draws in.

| Member                             | Kind     | Contract                                                                                                            |
| ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------- |
| `dd.geometry.rect(elementId)`      | accessor | The ELEMENT's border box in overlay coordinates, or `null` when it has no rendered node — including when you hand it an ITEM id, which is not an element id. Cached per state: a second call in the same state reads no layout. |
| `dd.geometry.itemRect(itemId)`     | accessor | The ITEM's window box: the box an item occupies on the canvas whatever its kind, the one the title bar and the resize handles track. This is what an overlay decorating items wants. Same cache, reactivity and phase rule as `rect`. |
| `dd.geometry.version()`            | accessor | The invalidation state's identity — changes on a pan, a zoom, a resize report, any document mutation, a scroll inside a viewport, or `invalidate()`. Reads no element layout, so a compute phase may call it. |
| `dd.geometry.resizeVersion()`      | accessor | The ResizeObserver trigger alone, never pan/zoom. For reads a transform cannot change (computed style).               |
| `dd.geometry.invalidate()`         | one-shot | Start a fresh invalidation state: every cached rect is dropped and every consumer re-reads synchronously.             |
| `dd.geometry.node(elementId)`      | one-shot | The renderer's rendered element (an `SVGElement` for an `svg` and what is inside it, decision #75; an `HTMLElement` otherwise), or `undefined`. For `getComputedStyle` reads the API does not wrap. Never write to it, never hold it past the current state. |
| `dd.geometry.camera()`             | accessor | `{ panX, panY, zoom }`; world → screen is `screen = pan + world × zoom`.                                              |

**The phase rule (decision #33), and it matters.** Call `rect`, `node`
and any computed-style read from an effect's APPLY phase or from an event
handler — never from a compute phase or from JSX. A compute phase runs
BEFORE the frame's render effects have written the DOM, so it would read
the previous layout and your overlay would trail every pan by one update.
Subscribe in compute, read in apply:

```ts
createEffect(
  () => {
    dd.geometry.version(); // subscribe: no layout read here
    return dd.selection();
  },
  (id) => {
    // apply: the DOM is this frame's
    const rect = id === null ? null : untrack(() => dd.geometry.rect(id));
    setBox(rect);
  },
);
```

**A drag writes the document every frame.** Resizing an item rewrites its
`frame`, and moving one rewrites its `position`, on every rAF tick of the
gesture — not once at the end — so anything keyed on `dd.geometry.version()`
or on the `document` hook follows a drag live. The whole gesture coalesces
into ONE history step (decision #20's burst), so a plugin never sees a
half-finished edit it has to debounce.

`dd.interactionVersion()` (accessor, tracks) is bumped when the browser's
answer to a state selector (`:hover`, `:focus-within`…) may have changed:
a hover, focus or press boundary crossed inside a viewport window — dense
while the user browses it (⌥ held), otherwise just the window's entry and
exit and a click — and browsing's own start and end. Never per-frame
pointer moves.

**A page's CSS, read and written as text** (decision #76). Which elements
a rule reaches, and which rules reach an element, are questions the
browser answers on the mounted page, not a second selector engine.
`dd.pageStack(elementId)` answers a `PageStack` for an element inside a
page — `viewportId`, the page's item; `sheets`, each a
`PageStackSheet` `{ source, editable, absent, variant? }`, every sheet the page
applies in cascade order, whether or not a rule of it reaches the
element (what an editor shows a section for, and an `add` names), with,
for a page with no sheet of its own that a save may write, the
`<page>.css` its first rule would link as `absent`, and, through a
variant's viewport, the variant's own sheet as `variant: true`; `name`, its `tag#id.class`; `own`,
its `style` attribute one declaration per line; `rules`, each a
`PageStackRule` whose `declarations` are exactly as written (comments and
repeated properties included, a nested rule cut out), from every sheet of
the page that applies (a `disabled` link's is not listed), most important first across them — by specificity, then scope
proximity, then the later sheet and the later rule — each naming its
`sheet` (a `SheetSource`, decision #78); a nested rule's `prelude` is its own as written (`&:hover`), with
the rules it sits inside as `parents`, its at-rules as `conditions` (its
sheet's own `media` first, when the sheet has one), its
`specificity` and `pseudo`, `editable` false when a save as one block
would move declarations written after a nested rule or its sheet is
read-only, and `active` false
when a `@media` (its sheet's own included) is false at the frame or a state is not in effect — and
an `@scope` that holds declarations of its own (outside the rules in
it) is a rule of its roots' stacks, its `prelude` the `@scope`'s, its
`declarations` those, at no specificity, saved by its `key` as any
rule's are; and
`ancestors`, each a `PageStackAncestor`, for the inherited section — or
null for anything not on a page. `dd.documentVersion()` and
`dd.interactionVersion()` are what can change the answer.
`dd.writePage(edit)` saves a `PageEdit`: a rule's declarations spliced
back by its `key` into its sheet, `{ kind: "rule", viewportId, key,
expected, declarations, nested? }` (refused when the rule no longer holds
`expected`), an element's `style`, `{ kind: "style", elementId, expected,
declarations }` (refused likewise when it no longer holds its `expected`,
the `own` shown), or a new rule into the `sheet` the `add` names, `{
kind: "add", viewportId, sheet, selector, declarations, after? }` (`after`
a rule's key to insert it after, else the sheet's end). Every save is guarded against a stray brace or an
unclosed comment or quote, and tidied in shape, not content; a refusal
comes back as a sentence. **Every edit writes the project's files, by
splice alone** (decision #78), and each names what it writes: a rule's
`key` its sheet, an `add` its `sheet`, an `html` its page's `path`, a
`style` and a `remove` their element's page. A rule's body is spliced
into its sheet's file — a `<style>` block's into the page's markup,
where the block is written — and a new rule into the sheet the `add`
names; every other byte of the file stays as written, comments and
formatting included. A rule of a remote sheet is read-only, and so is
every inline SVG's `<style>`, whose content the browser reads as markup,
not as a stylesheet's text. A page with no sheet of its own that a save
may write (no file of the project, no `<style>` block of its HTML, or
only ones that apply nothing) gains one with its first rule: an `add`
naming `<page>.css` (`blog/post.html` → `{ file: "blog/post.css" }`)
splices one `<link rel="stylesheet">` into the page's `<head>`, before
its `</head>` tag — the one change Daydream makes to markup on its own —
and writes the rule at that file's end, creating the file when the
project has none of that name. A file of that name already there — one
another page links, one the page linked before — gains the rule after
what it holds and is never replaced, and its undo gives back its text;
one on disk the tab has not read is refused when the host is asked to
create it, and the same `add` made again writes into it. Markup with no
`</head>` tag is refused, with the way forward. The edit is on the
canvas at once — every page linking a sheet it wrote re-renders — and
the host writes the files after, each naming the bytes it may replace;
a file that changed on disk since the tab read it wins: the edit is
dropped, the files it wrote are read again as the disk holds them, and
their undo steps are forgotten. A file the host never writes (a link,
bytes that are not UTF-8) drops the edit the same way, saying why; a
sheet the host listed so is `readOnly` from the start, and its edit is
refused at once. A style write changes the
markup, so the page remounts and the element's id changes; the selection
is carried to it.
The two edits that write the css — a `rule` save and an `add`, together
`CssPageEdit` — answer what they wrote, a `PageWritten`, and every other
edit answers null when it wrote, so tell a refusal by
`typeof answer === "string"`. A `PageWritten` holds the `key` of the rule
written (the new rule's, for an `add`); `nested`, the keys of the rules
its declarations nest as typed (`gap: 0; .cta { color: red }` writes
`.cta` nested, as typed); `declarations`, its declarations as the css
now holds them, those nested rules included; and `moved`, every other
rule whose key the write changed, old key to new — a rule after one it
added, or after declarations that now nest more rules or fewer. A rule is
saved by its key whether or not it reaches any element, so an editor
that remembers what it wrote can go on showing and saving a new rule
that reaches nothing selected: `dd.pageStack` shows only the rules that
reach the element, and remembers nothing. A later `rule` save of
declarations that hold nested rules passes their keys as `nested`, with
the `PageWritten.declarations` it showed as `expected`; the save
replaces them rather than writing them twice. Without `nested`, a save's
declarations are the rule's own, every rule nested in it cut out and
kept where it was. This is a change of shape: before it, every edit
answered null when it wrote, and a plugin that tests an `add` or a
`rule` save's answer against null reads a success as a refusal.
The `html` edit, `{ kind: "html", path, expected, html }`, is an
editor of the page's text saving the whole markup: stored exactly as
sent, never cleaned, and the page remounts. It is refused when the stored
markup is no longer `expected`, and refused, by name, when it brings in
anything the render walk takes out — a `<script>`, an `onclick`, a
`javascript:` url, a `<link rel="preload">`, a `url(http:…)` in a
`style` attribute, a `<style>` or a stylesheet `<link>` (whose rules
belong in the css) — since an editor must say why rather than strip what
the person is typing. Only what the edit brings in is refused: the
walk's findings in the new markup that `expected` does not already
have, an element told by its markup and an attribute by its element's
tag, its name and its value, each in its place — a template's content,
the head, or the rest of the page. A page that already holds such a
thing (a file as its author wrote it, edited on disk) stays editable around it, keeps it until an edit takes it out, and is
walked at render as always; a changed `<script>` or handler is a new
one, and refused, and so is one moved to another place (a handler out of
an inert `<template>` into the body, a script out of the head). The verdict is the renderer's own safety walk, the one every page
is rendered through. Like every `writePage` edit, it is its own
undo step (typed saves in quick succession join one, as every edit
burst does; several as one step by contract is an `ItemTransaction`'s
`write`, §4.2), and it is not part of an open `ItemTransaction`: a page
write commits the session first and calls its `onInterrupted`, as any
document write outside the session does.
The `remove` edit, `{ kind: "remove", elementId }`, takes a mounted
element out of the page: its span is cut from where it was written and
every other character of the markup stays as typed. The page's `html`,
`head` and `body` are refused. A `style` or `remove` edit that cannot be
made so is refused, with a sentence naming the way forward, and nothing
is written — never the page written back as the browser serializes it:
an element the parser supplied (an implied `<body>`, a `<tbody>`) has no
tag of its own in the file to write a style into or a span to cut
(`the page's file has no <body> tag of its own…; add the <body> tag to
the markup, then style it`), and a splice the browser would read back
otherwise than as the edit is not made.

**The text and the mount, both ways.** An editor of a page's text
carries its caret to the canvas and the canvas's selection back to the
text. `dd.pageElementAt(viewportId, offset)` is the innermost mounted
element whose span in the stored `html` holds `offset`
(`start <= offset < end`), by its render-time id.
`dd.pageSource(elementId)` is where a mounted element was written: a
`PageSourceRange`, `{ viewportId, start, end }`, from its start tag's `<`
to just past its end tag — or, for an element the parser closed (a `<p>`
or an `<li>` the next one ended), up to the tag it was closed at, the
text the parser gave it included. A range is one run of the text, so a
table's holds what the parser moved out in front of it (a `<div>`
written inside the `<table>`), which has its own range inside the
table's. Both are null for an element the
safety walk removed (a `<script>` has no mounted id) and for one the
parser supplied (an implied `<body>`, a `<tbody>`, which has no place in
the text), and for anything not in a mounted page. They read the
mounted page and the stored text, one-shot: after a markup write, ask
again once the page has remounted (`dd.documentVersion()` is the
trigger); an id from before the remount answers null.

**A page element, cheaply, and a selector's element.** A plugin that
only needs to know which page an element is in, or its parent, reads
`dd.pageElement(elementId)`: a `PageElement`, `{ viewportId, selector,
parentId }` — the page, the element's unique selector in the page's
STORED markup (exactly what `canvas_state` answers for it as
`selection.selector`, and what an agent would name it by; null when none
can be told), and its parent's render-time id (null for the page's
`<html>`). It reads the mount and the markup alone, with no rule
matching, so it is cheap where `dd.pageStack` is not, and it is read once
per mounted element and page text: asked again — on every selection,
geometry or document change — it answers from memory, so there is no
need to keep its answer yourself. Null for an item, nothing, or an id no
mount holds. The other way,
`dd.pageFind(viewportId, selector)` is the render-time id of the ONE
element a selector matches in that page, resolved against the stored
markup in standards mode, as the agent tools resolve one, and carried to
the mount — null for none, several, a selector the browser refuses, an
element the safety walk removed, or a page that is not mounted. Both are
one-shot reads, like `dd.pageSource`.
`dd.pageWinner(elementId, properties)` answers which declaration sets a
property on the element, as the cascade decides it — a `PageWinner`
`{ declaration, rule, layer }`: the winning `CssDeclaration` (its `range`
inside `rule.declarations`, or inside the element's `own` when `rule` is
null, the `style` attribute's), the `PageStackRule` holding it, and the
cascade `layer` it sits in (dotted when nested, null when unlayered). The
order is the cascade's: `!important` over normal; a declaration on the
element over a sheet's; layers as the page's sheets declare them, by
first declaration across the sheets in cascade order — a `@layer a, b;`
statement, a `@layer a { … }` block, an `@import … layer(a)` — a
later-declared layer winning for normal declarations and an earlier one
for important, unlayered normal ahead of every layered normal and behind
every layered important; then specificity, scope proximity and order of
appearance, as `rules` are ranked. Several names compete as one — a
longhand with the shorthands that set it, `["grid-template-columns",
"grid-template", "grid"]` — and inside one rule the last `!important`
declaration of them, else the last, is the rule's. Only rules `active`
now, and no pseudo-element's; null when nothing sets them, or the element
is not on a page. What a direct-manipulation plugin writes through,
rather than ranking the stack itself.

`dd.pageRuleMatches(viewportId, key)` is the reverse read: the element ids
the rule with that `PageStackRule.key` matches right now, in document
order, asked of the browser on the page's mounted tree with a nested rule
resolved against its parents — `[]` for anything but a mounted page, a
key the css no longer holds, or a rule an inactive `@media` excludes. It
reads the DOM: call it in an effect's apply phase, subscribed in compute
to the same two triggers; a pan or zoom never changes a selector match.

### 4.5 `dd.core` — the kernel's pure helpers

`dd.core.generateId()` creates a fresh local canvas-item id using the
kernel's alphabet, excluding the renderer's reserved `__` prefix.

Pure functions the renderer and every plugin share; none mutates, none
tracks (they are one-shots over whatever document you hand them — pass
`dd.document()` and read it inside a memo to stay reactive), and none
reads the canvas: the ones that take markup, css or an element work on
whatever you hand them — a page you parsed yourself, a gate's incoming
page, a `dd.mountViewport` copy. What an element, an attribute or a rule
may be is not among them: a page's vocabulary is the browser's.

| Member                                         | Contract                                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `dd.core.viewportKind`                         | A viewport item's `kind`, `"daydream.viewport"`: compare with it, or build an item with it, rather than spell it. |
| `dd.core.viewportItems(doc)`                   | The viewport items (`DreamViewport`) of the document's shown canvas, in canvas order.        |
| `dd.core.evaluateMediaCondition(prelude, env)` | Tri-state evaluation against a simulated window: `true`, `false`, `"unknown"`.               |
| `dd.core.viewportMediaEnvironment(viewport)`   | The window a viewport simulates (`{ width, height }`), or `null` when it has no frame.       |
| `dd.core.familyNames(value)`                   | The family names a `font-family` value lists, quotes removed, as written.                   |
| `dd.core.mediaPreludePxValues(prelude)`        | Every px-axis length a `@media` prelude names (em/rem at the initial font size).             |
| `dd.core.specificity(selector)`                | The selector's specificity as a `[ids, classes, types]` triple, selectors-4's counting; a list is its maximum. The count `PageStackRule.specificity` carries. |
| `dd.core.parsePage(html)`                      | A page's stored markup as the kernel parses it: a whole `Document`, in standards mode whatever its doctype says — the parse every selector the kernel answers or resolves is read against. Browser only. |
| `dd.core.uniqueSelector(element, root?)`       | The selector naming `element` and nothing else under `root` (its own document, shadow root or fragment by default): its `#id` when no other element carries it, else the shortest `>`-joined path of tag and class steps, `:nth-of-type` only where a same-looking sibling needs it. Over `parsePage(html)` it is the name `canvas_state`, `measure` and the draft tools give that element. Throws when `element` is not under `root`. Browser only. |
| `dd.core.cssBlocks(css)`                       | Every rule of a css text, nested as written: a `CssBlock`, `{ prelude, range, statement, declarations, children }`, its prelude with comments out as the tokenizer reads them (a comment joins what is on either side of it) and each declaration a `CssDeclaration`, `{ property, value, important, range }` — the property as the CSSOM keys it (escapes decoded, anything past ASCII kept, ASCII lower-cased but for a custom property), the value with its comments and `!important` out, the range what cutting removes the declaration and nothing else. The kernel's own scan of a page's css, the CSS editor's, which finds a rule's edges where the browser's parser does: strings, comments, escapes, urls and what a parenthesis or a bracket holds are never structure, `<!--` and `-->` between a sheet's rules are skipped, a stray `;` where the parser reads rules alone (the top level, and a `@media`, `@supports`, `@container`, `@layer`, `@starting-style` or `@keyframes` block no style rule encloses) ends no rule but is read into the next rule's prelude — which then holds the `;` (`; .b`), its range starting at it, as the browser reads it before refusing that rule — and a statement the text ends in without its `;` is kept. It judges nothing — a rule the browser refuses is still read, as written — and malformed text never throws. Every array it answers is the caller's own. |
| `dd.core.cssDeclarations(text)`                | The `CssDeclaration`s of a declaration list — a `style` attribute's text — read as `cssBlocks` reads a rule's. |

### 4.6 Measuring and mounting

| Member                                | Kind     | Contract                                                                                                      |
| ------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| `dd.measure(doc, options?)`           | one-shot | Render a document's viewports live at their own frames, each with its page of the open project, and read back per-element geometry and plain-words findings. Returns a `Promise<MeasureReport>`. Nothing changes. `options`, a `MeasureOptions` `{ viewportIds? }`, narrows it to the named viewports (an unknown id is an error). |
| `dd.mountViewport(viewport, options?)`| one-shot | One page mounted live and KEPT alive between reads, for a judgement that must read it more than once. Resolves once layout has settled. A gate mounts through `ctx.mountViewport` instead (below). |

A `MeasureReport` is `{ viewports: [{ id, frame, elements, findings }] }`;
each element carries `{ id, selector, tag, depth, display, position, box, flags }`
and each finding a `kind`, an `elementId` and a plain-words `message`.
A viewport is measured from its page's own text (`DreamPage`, decision
#78), which has no stored element ids, so each of its elements carries a `selector` — its
`#id` when the page gives it a unique one, else the shortest unique path
of tag, classes and `:nth-of-type` — and its `id`, and every finding's
`elementId`, hold that same selector; a message quotes it in backticks.
`querySelectorAll` on the page resolves a selector to exactly that
element.

A `MountedViewport` has `read()` (one synchronous read pass),
`document()` (the rendered `Document`, for reads the read pass does not
make — a node's computed style, the page's CSSOM; the mount is the
caller's alone, and nothing done to it is stored) and `dispose()`. ALWAYS
dispose, in a `finally` — a mount left behind is a leak the tests refuse.
A viewport mounts its project page as its own markup, made safe as the
canvas makes it, with each live sheet as a `<style>` of its own at the
end of its `<head>`, in cascade order, and every `@import` stripped; a viewport whose page the project does not hold
is refused. `MountOptions` are `{ width?, still?, bare? }`: another width
for a sweep, `still` to pin transitions and animations to none so a
write-then-read probe reads resting values (a sheet the document adopts,
never an element in its tree or one of its `document.styleSheets`), and
`bare` for the page alone — nothing the read pass adds for itself, no
stamp on an element and no container probe in the css, so the copy's
`<style>`s, one per live sheet in cascade order, are the page's sheets as
the face renders them and its tree is the page's, `still` or not. A bare mount is a `BareMountedViewport`:
`document()` and `dispose()`, and no `read()` —
`mountViewport(viewport, { bare: true })` is typed so. A page loads its
files as the canvas does, each relative url resolved from the page's own
folder in the project, under the host's `/api/project/files/` route.

Both show the project's page. A gate is handed the same two over the page
it is judging, in its `GateContext` (§5.5): `ctx.measure` and
`ctx.mountViewport`, which takes the same options, has the same overloads
and answers the same mounts, each viewport's page read through
`ctx.page`. At a draft's finalize that is the page about to be written —
a new page no file holds yet, a rework as it will be read — so a gate
that mounts through `dd.mountViewport` there judges the project's page as
it is, and a new page's mount is refused. A gate always mounts through
`ctx.mountViewport`; outside a gate, `dd.mountViewport` is the mount. A
gate still disposes each of its mounts; one it leaves open is disposed
when its run ends (answered, thrown or timed out), and a mount asked for
through its context after that is refused.

### 4.7 Storage, commands and the escape hatch

| Member                        | Kind     | Contract                                                                                                              |
| ----------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- |
| `dd.storage.get(key)`         | one-shot | `Promise<T \| undefined>`. Waits for host detection, so a read at activation sees what the last session saved.            |
| `dd.storage.set(key, value)`  | one-shot | `Promise<void>`, resolved once the host has written. Values must be JSON.                                                 |
| `dd.runCommand(id)`           | one-shot | Run a command by id — yours, core's or another plugin's — as a direct call (no scope resolution; its `when` still applies). True when it exists, is enabled and did not decline. |
| `dd.unstable`                 | one-shot | `{ store }`, the raw app store. Throws unless the manifest declares `"unstable": true`. No contract; ask for a method instead. |

### 4.7b The agent — `dd.agent`

The open project's conversation with the user's own agent (decision
#87): Claude Code, Codex, Gemini CLI or OpenCode, over the Agent Client
Protocol, started by the host in the project's folder and given
Daydream's MCP server. Daydream is a client and nothing more — no model,
no loop of its own — and the conversation is the HOST's and the
project's, never a tab's: every tab reads it whole and hears the same
events, and any tab may prompt or answer. What the agent sends is ACP's
own, as the host's ACP SDK parses it — a field its schema does not name
stripped, an update of a kind it does not know dropped: the types
(`AgentSessionUpdate`, `AgentToolCall`, `AgentToolCallContent`,
`AgentPlanEntry`, `AgentPermissionAsk`, …) are a typed subset of the
protocol's schema, and the host may pass fields and update kinds they do
not name — pass those over.

| Member                                   | Kind     | Contract                                                                                                     |
| ---------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `dd.agent.available()`                   | one-shot | `Promise<boolean>`: whether this host runs agents (a plain static build does not).                             |
| `dd.agent.agents()`                      | one-shot | `AgentAgents`: the known agents, each `{ id, name, installed, install, signIn }` (`AgentListing`), `project`, the agent of the open project's conversation, `last`, the one used last in any project, and `note`, a sentence to say quietly when the user's login shell did not answer and the agents were looked for on the app's own PATH. Show the project's first: `last` only seeds a project with no conversation. Daydream never installs one: show `install`. Finding them may run the user's login shell. |
| `dd.agent.start(agentId, { intent? })` | one-shot | Start a conversation with the agent of that id — the only thing a page names — as `intent` (`AgentStartIntent`) says, the host alone deciding what it does: absent, the project's conversation is opened — resumed when it is with that agent and the agent can (`session/load`), one already open with it kept, another agent's refused, a new one when there is none; `"new"`, a new conversation with that agent, the project's ended — switching agents is the user's choice, and one; `"resume"`, only the project's own conversation with that agent, when it has one and the agent is installed, and otherwise nothing changes — so a page that asks for a resume as the user opens a folder never starts an agent in one the user started none in. Answers the `AgentStatus`. Every call but `available` and the events is an `AgentConversation`'s, the same at every layer. |
| `dd.agent.prompt(blocks, { references? })` | one-shot | Send ACP content blocks (`AgentContentBlock`); `references` (`AgentPromptReferences`, `{ block, labels }`) names the text block carrying the canvas references and its chips' labels, which the host marks on that block in its transcript (`references` on the `user_message_chunk`). Refused while a turn runs (`status.busy`). Resolves once the agent took the prompt — its message enters the transcript then — and rejects, the transcript untouched, when it did not. An image goes inline to an agent that takes images (`status.images`), and as a link to a file under `.daydream/attachments/` to one that does not; the file goes when the conversation does. |
| `dd.agent.cancel()`                      | one-shot | `session/cancel`: what was said stays, every permission waiting is answered `cancelled`.                        |
| `dd.agent.answer(requestId, optionId)`   | one-shot | Answer an `AgentPermissionAsk` with one of the agent's own options. The first answer from any tab wins.         |
| `dd.agent.newConversation()`             | one-shot | End the conversation and forget it; the next starts fresh.                                                     |
| `dd.agent.setMode(modeId)`               | one-shot | The agent's mode (`status.modes`), passed through.                                                             |
| `dd.agent.setConfig(configId, value)`    | one-shot | One of the agent's settings (`status.configOptions`, ACP's `SessionConfigOption`), passed through.             |
| `dd.agent.authenticate(methodId)`        | one-shot | Sign in by one of the `agent` methods of `status.authMethods` — ones the agent carries out itself, with no secret from Daydream — then open the conversation. A `terminal` method is its `command` for the user to run, an `env_var` one its `vars` for them to set in their shell profile (`AgentAuthMethod`); with none, the user's sign-in is `AgentListing.signIn`, in a terminal. |
| `dd.agent.follow(handler)`              | registration | The conversation as it goes, kept whole by the kernel: first the whole of it, `{ type: "thread", thread }` (`AgentThread`, `{ status, updates, omitted, permissions }`: the host's last 2,000 updates, `omitted` how many earlier ones it let go, and the permissions waiting; an image the user sent comes back without its bytes, as a `resource_link` titled with its type and size, its `uri` the file, empty for one sent inline), then every change after it, in order and once (`AgentChange`): `status`, `update`, `permission`, `resolved`, `cleared`. Whenever part of it may have been missed — the host started over, the connection to it came back, a change was lost — the kernel reads it again and hands it over whole, another `thread`; a read that fails is tried again. `start`, `newConversation` and `authenticate` resolve once every follower has heard where they left it. Nothing without a host that runs agents. |

`AgentStatus` is a union on `phase`, each phase carrying
only what is true of it — switch on `phase` before reading the rest:
`idle` (`agentId`, the agent chosen for the next conversation, if any),
`starting` (`agentId`), `ready` (`agentId`, `sessionId`, `busy`, `note`,
`images`, `modes`, `configOptions` — a live session's alone: an agent
that stopped takes its modes and settings with it), `sign-in`
(`agentId`, `note`, `authMethods`) and `failed` (`agentId`, `note`, and
`install`, the line that installs the agent when it failed for not being
installed). `note` is a sentence for the user — why it failed, that it
started fresh because the agent cannot resume, why a sign-in did not
take. A retry (a start after `failed` or `sign-in`) reads the user's
shell environment again. The host's transcript joins a run of one
message's text chunks into one; every tab hears each chunk as it comes.
Every method but `available` rejects with the host's sentence, and
without a host that runs agents.

### 4.7c Screenshots — `dd.capture`

A screenshot of a viewport, which only the desktop app around the page
can take (decision #87); in a browser tab there is none. Its own
namespace: the agent panel sends one to the agent, but a screenshot is
the canvas's.

| Member                          | Kind     | Contract                                                                                                                         |
| ------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `dd.capture.available()`        | one-shot | Whether screenshots can be taken here: true in the desktop app alone. Hide a screenshot affordance otherwise.                     |
| `dd.capture.viewport(viewportId)` | one-shot | A `ViewportCapture` (`{ data, mimeType, width, height }`, a PNG in base64) of the viewport's page at its width, full height (capped), taken by the desktop app — or null anywhere else, or for anything but a viewport. Rejects with the app's sentence when it could not take one. |

### 4.8 Registration

Each returns a `Disposable`; each is refused with a thrown message when the
manifest does not declare it.

| Member                              | Registers                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------- |
| `dd.registerPanel(registration)`    | a panel in the user's panel stacks (`PanelRegistration`, §5.1)            |
| `dd.registerItemKind(registration)` | a plugin-owned canvas renderer and payload validator (`ItemKindRegistration`, §5.8) |
| `dd.registerOverlay(registration)`  | a drawing on the canvas (`OverlayRegistration`, §5.2)                     |
| `dd.registerCommand(command)`       | a named action (`Command`, §5.3)                                          |
| `dd.bindShortcut(commandId, keys)`  | a key chord for a command id — yours or anyone's (§5.3)                   |
| `dd.registerGate(registration)`     | a judge `lint` runs over the project's pages (`GateRegistration`, §5.5)    |
| `dd.registerTool(registration)`     | an MCP tool for connected agents (`ToolRegistration`, §5.6)               |
| `dd.on(hook, handler)`              | a subscription to `selection`, `document`, `geometry` or `items`, or a `leave` handler (§5.4) |

---

## 5. Extension points

### 5.1 Panels — `dd.registerPanel`

Each registered panel is a panel in a stack the user arranges (decision
#79). A new project has one stack, pinned full height to the right edge,
the panels of the plugins on at the start in config order (the first
enabled plugin's topmost). A plugin turned on later lands its panel
loose on the canvas, right of the items in view (at the view's right
edge, over them, when they fill it) and below any stack already there;
turned off and on again, its panel is back where it was. From there the arrangement is
the user's, remembered per project and canvas:
a stack is moved by its first panel's header, a panel pulled out of it by
its own header, stacks join end to end, and a stack is pinned to the
screen or left loose on the canvas, where it pans and zooms with the
work — so your body may be drawn scaled. Panels minimize, and their
lengths and the stack's width are set by dragging. A stack's headers
can sit on top, on the left or on the right; on a side the panels run
side by side, each header turned a quarter down its edge, and your body
is drawn beside it rather than under it — so keep it working in a
narrow, tall box as well as a wide one. None of it changes this API.
Each panel has a header — your `title` on one end, the kernel's icons on
the other — and a body, which is what `render` returns. There is no
close: a panel exists exactly as long as its registration.

```ts
dd.registerPanel({
  id: "example", // declared in contributes.panels
  title: "Example", // the header's caption; sentence case
  ariaLabel: "Example plugin", // the section's accessible name; defaults to title
  grow: 1, // optional: this panel wants space; a weight
  render: (context) => createPanel(dd, context),
});
```

`PanelRegistration` fields: `id`, `title`, `ariaLabel`, `render`, `grow`,
`styles` (the panel's CSS, mounted by the kernel — §6), `lands` and
`attention` (below).

- `render` is called ONCE per mount, as a component is, under the
  panel's owner: memos and effects created inside it live as long as the
  panel's body and die with it, and reactive reads in its JSX track as
  usual. Write it as a factory function that returns JSX, not a
  `<Component>` you instantiate yourself.
- `render` is given a `PanelContext`: what the panel is for. Its
  `selection()` and `itemSelection()` are accessors that read, today,
  exactly what `dd.selection()` and `dd.itemSelection()` do — the
  canvas's selection. Taking it is optional (`render: () => …` still
  renders), but a panel that reads its selection from the context rather
  than from `dd` will follow its panel should panels come to be bound to
  one item, with no change on your side. The context is new in API 1.2;
  API 1.0 and 1.1 call `render` with nothing, so a plugin that reads it
  declares `"api": "1.2"`. A panel moved to another stack
  (pulled out, or joined to one) keeps its body: the same owner and the
  same DOM, moved — where the browser can move a node without taking it
  out of the document (`moveBefore`), focus inside it stays; elsewhere it
  is lost with the move. A panel is made hidden and put in its stack
  just after: measure your body once it is shown (an effect over what
  you draw), not in the first `onSettled`. A minimized panel's body is
  UNMOUNTED, and mounted again when it opens: keep what must survive
  that — a draft, a scroll position, an editor's history — in your
  plugin's own state, not the body's.
- The body is a flex column: a root that should fill it takes
  `flex: 1 1 auto; min-height: 0`; one sized to its content keeps its
  height, and what is taller than the panel scrolls.
- `grow` says the panel wants space: in the default stack the growing
  panels share what the content-sized ones leave in proportion to their
  weights (`true` reads as 1; the CSS editor declares 2 and the HTML
  editor 1). A panel without `grow` starts at its content's height,
  measured once.
- Sizes and places are the user's: the header, the dividers between
  panels and a stack's edges are the kernel's chrome, and a panel has no
  say over its width, its length or where it sits — but for where it
  lands the first time: `lands: "right"` puts a panel the layout has never
  seen in a stack of its own pinned full height against the right edge,
  left of any stack pinned there, whether its plugin was on at the start
  (rather than joining the first stack) or turned on later (rather than
  loose beside the items). The agent panel is one.
- `attention` is an accessor: while the panel is minimized and it answers
  true, the header carries a dot after the title — a request waiting on
  the user, say. Nothing else: no sound, no system notification.

### 5.2 Overlays — `dd.registerOverlay`

Three slots. The first two are `pointer-events: none` — an overlay there
is drawn, never clicked; the third takes input. Each registration is wrapped in a
`<div data-plugin-overlay="<pluginId>">`, inside a slot container the
canvas marks `data-plugin-overlay-slot="<slot>"`; a test asserting which
slot an overlay landed in reads that attribute.
`OverlayRegistration` fields: `id`, `slot`, `render` (a zero-prop component
like a panel's, given nothing), `styles` (the overlay's CSS, mounted by the kernel — §6).

- `overlay.world` renders INSIDE the camera transform, anchored at the
  world origin, so what you draw pans and zooms with the items and a 1px
  stroke is 1 world px. Its box is a POINT — the world div is 0×0 with its
  items absolutely positioned — so a percentage size resolves to nothing:
  size your content explicitly from item positions, or draw with
  `overflow: visible`.
- `overlay.screen` renders in screen space, fixed over the canvas
  container, UNDER core's selection outline. Strokes, hatches and labels
  stay constant-size at any zoom. Position content from
  `dd.geometry.rect` (elements) or `dd.geometry.itemRect` (items), both of
  which already answer in this space.

- `overlay.interactive` (decision #67) renders in screen space ABOVE
  core's outline and the item chrome, and what you draw there RECEIVES
  pointer events — a picker beside the selection, a button on the canvas.
  Its wrapper is a 0×0 point at the canvas's top-left that opts back into
  input, so position every node absolutely from `dd.geometry.rect` /
  `itemRect` and size it explicitly; the empty canvas around what you
  draw is not covered. The canvas ignores input that starts inside the
  slot (no deselect, pan, marquee or zoom under your click), and keys
  typed into a field there resolve in `editor` scope. Close what you open
  yourself (Escape, a click outside — a window listener of your own).

All three slots are hidden (`display: none`, still mounted, effects still
running) while the user browses a viewport with ⌥ held — the page reads as
a page then, with no drawing over it — and shown again on release.

### 5.2b Item actions — `dd.registerItemAction`

One word in an item's TITLE BAR (decision #67), revealed when the bar
or the item's window is hovered — the seam for "do this to that item"
without drawing chrome of your own. `ItemActionRegistration` is `{ id,
title, when, run }`: `id` bare and declared in `contributes.itemActions`;
`title` a word, sentence case; `when(item)` decides which items carry it,
read on every render of the bar (a document change) — read the item,
track nothing; `run(item)` is the click, which starts no drag and selects
nothing. What `run` does is yours, through the write API — one undo step
each. A draft window carries no actions.

```ts
dd.registerItemAction({
  id: "adopt", // declared in contributes.itemActions
  title: "adopt",
  when: (item) => isVariant(item),
  run: (item) => dd.mutateItems((items) => adoptInto(items, item.id)),
});
```

### 5.3 Commands and shortcuts

One window key listener routes every key. A command is
`{ id, title, scope, when?, run, release? }`:

```ts
dd.registerCommand({
  id: "vendor.thing.toggle", // must start with "<pluginId>." and be declared
  title: "Toggle the thing", // sentence case
  scope: "canvas",
  when: (ctx) => somethingIsSelected(), // optional; re-evaluated per keypress
  run: (ctx) => {
    /* returning false means "did not handle": the key falls through */
  },
  release: (ctx) => {
    /* optional: called on the keyup of a held key, and on window blur */
  },
});
dd.bindShortcut("vendor.thing.toggle", "Mod+Shift+T");
```

`CommandContext` is `{ event: KeyboardEvent | null, source: "shortcut" | "call" }`.
A `when` or `run` that throws is logged and read as "not handled".

**Scopes**, tried in this order on a keypress; the first enabled command
that handles the key wins:

| Scope    | When it applies                                                                                                     |
| -------- | --------------------------------------------------------------------------------------------------------------------- |
| `drag`   | only while a canvas drag is live — and while one is, NOTHING outside this scope fires                                  |
| `editor` | the key was typed in a text field, or inside an element carrying `data-dd-editable` (how a plugin declares its own editor) |
| `canvas` | the key was typed anywhere else                                                                                        |
| `always` | regardless of where — undo, redo, save. Tried LAST, so an editor-scope command can take a key first                    |

Within a scope the most recently bound command wins, so a plugin can shadow
a core binding.

**Chord grammar.** `"Shift+Mod+Z"`, `"Escape"`, `"Delete"`, `"Space"`, or
the object form `{ key, mod?, meta?, ctrl?, shift?, alt? }`. Modifiers are
`Mod`, `Shift`, `Alt`, `Ctrl`, `Meta` (also spelled `Cmd`/`Command`,
`Control`, `Option`), then the key. `Mod` is ⌘ OR Ctrl on every platform;
naming `Mod` beside `Ctrl` or `Meta` is refused. Letters are
case-insensitive; `"Space"` and `" "` both name the space bar; a shifted
punctuation key also matches its unshifted binding (`Mod+/` fires for ⇧⌘/),
letters never do. A BARE modifier — `"Alt"`, `"Shift"`, `"Control"`,
`"Meta"` — binds that key's own keydown (with `release`, a held mode: core's
⌥ browse mode is one); the router never claims such a keydown, so the
modifier keeps composing characters and chording.

Two warnings worth heeding:

- **The typing claim.** An UNMODIFIED printable key bound to an `always` or
  `editor` command claims that character in every text field — the user can
  no longer type it. The router warns at bind time. Bind such keys in
  `canvas` scope.
- **Alt on macOS.** ⌥ composes the character (⌥K arrives as `˚`, ⌥\ as
  `«`), so an Alt chord is matched by the PHYSICAL key — `Alt+K` is the K
  key with ⌥ held, on every layout that has one. Name the key a US layout
  produces unmodified; a key that composes nothing (a function key, an
  arrow) matches as itself.

Core owns `core.undo` (`Mod+Z`), `core.redo` (`Shift+Mod+Z`), `core.save`
(`Mod+S`), `core.focus-mode` (`Mod+\`), `core.delete-item` (`Delete`,
`Backspace`), `core.duplicate-item` (`Mod+D`), `core.escape`, `core.pan-mode`
(`Space`), `core.cancel-drag`, and the unbound
`core.reload-plugins` and `core.trust-plugin`. Any of them can be run with
`dd.runCommand(id)`.

### 5.4 Hooks — `dd.on`

A handler runs on every change AFTER subscribing, never for the present
state. It runs in the apply phase of an effect the kernel owns, so DOM
reads in it are fresh — and the work must be bounded, because the
`geometry` hook fires per invalidation state (per frame while panning).
Anything the UI needs is better read reactively; hooks are for side effects
outside the reactive graph. One hook is no notification: `leave` is
called before the fact (below).

`HookPayloads` — the five hooks and what each handler receives:

| Hook        | Payload                                | Fires on                                                                                     |
| ----------- | -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `selection` | `{ elementId: ElementId \| null, itemIds: readonly string[] }` | the selected element or the canvas-item set changed (`null` / `[]`: nothing selected) |
| `document`  | `{ version: number, restored: boolean }` | any document mutation; `restored` is true for an undo, a redo or a load — never an ordinary edit |
| `geometry`  | `{ version: number }`                  | geometry was invalidated: a pan, a zoom, a resize, a mutation, a scroll or `invalidate()`       |
| `items`     | `{ added: string[], removed: string[] }` | the SET of canvas item ids changed. A move, a resize or a style edit changes no id and fires `document` only |
| `leave`     | none                                   | BEFORE the project is swapped for another (the mark's picker, `daydream <folder>`) or this plugin is deactivated (turned off, reloaded, stopped by an error) |

```ts
dd.on("selection", ({ elementId }) => {
  /* … */
});
```

`leave` is for what your plugin holds that is not written yet — typing
waiting on a save's debounce, most often — which the swap or the
deactivation would otherwise lose. The handler is CALLED, synchronously,
while your panels are still up and your API still writes: before
anything the plugin registered is disposed, and, for a swap, once the
swap is going ahead — after the outgoing project's pending layout write
has landed, right before the store changes (a swap that is refused never
calls it). The picker calls it before it opens, so the outgoing write
carries yours. What a call writes is saved, and the handler is
called again after that save, since typing may reach you while it is
written; the swap goes ahead once a call writes nothing. So a handler
MAY RUN MORE THAN ONCE PER SWAP and must be safe to repeat: a second
call finds nothing pending and writes nothing (one that writes at every
call refuses the swap after three saves). Read what you hold from its
own state — the editor's text, not an edit still on its way to you — and
write there, before returning: `dd.writePage`, `dd.mutateItems` and
`dd.updateItem` are synchronous, and the write lands in the outgoing
project and is saved with it; a promise the handler returns is not
awaited. It runs outside any owner, as a command does, so a write is
allowed. A handler that throws is logged under your plugin's id and,
unlike any other hook's, STAYS ON — it exists so that nothing is lost,
and one failed save must not cost every later one; the swap or the
deactivation goes on. Better still, catch your own failure and report it
as your plugin reports a failed save. The CSS editor saves its pending
typing here; a plugin's own editor (the HTML editor) does the same:

```ts
dd.on("leave", () => saveWhatIsTyped());
```

### 5.5 Gates — `dd.registerGate`

Core runs every registered gate on MCP `lint`, over the open project's
document and its pages, and at a draft's `draft_finalize`, over the page
it is about to write, before any file is: a blocking finding refuses the
finalize, and nothing is written (decision #78). `lint` writes nothing
either.
`GateRegistration` fields:
`id` (declared in `contributes.gates`, bare, no plugin prefix), `title`
(sentence case) and `run`.

```ts
dd.registerGate({
  id: "static",
  title: "Static lint",
  run: (doc, ctx) => findings, // Finding[] | Promise<Finding[]>
});
```

`run` receives a plain copy of the document judged (every viewport
showing a page by path, whose elements a finding names by selector, as
the measurer does) and a `GateContext` of `{ viewportIds?, page, measure,
mountViewport }` — `page(path)`, the page a viewport shows (`ctx.page(viewport.payload.page)`,
its markup and sheets), and core's measurer and live mount over those
pages (§4.6), because a gate that needs geometry uses core's rather than
owning one. On `lint` the document is the project's and `page` its
pages. At a finalize it is one viewport, the draft's window, showing the
page as it will be written — a new page's path, or the rework's page —
and `page` answers that page for its path and the project's for every
other: read, measure and mount through `ctx`, never through `dd.page`,
`dd.measure` or `dd.mountViewport`, which see the project as it is.
At a COPY's finalize (`draft_open { copyOf }`), and a rework of a
variant's viewport, the page judged is the VARIANT as it will render,
at its page's path: its markup, and its own css as a sheet of its own,
`variant: true`, in the cascade where its accept will write it (§4.2,
the variant paragraph) — find it by that, never as the last sheet. At a
rework or a new page's finalize the draft's css is no sheet of its own:
it is in the text of the sheet it is appended to, as it will be read.

A `Finding` is:

```ts
{
  tier: string,               // your gate's own source name is fine
  severity: "blocking" | "advisory",
  gate?: string,              // the runner stamps your gate id
  elementId?: string,         // on a page, the element's unique selector
  property?: string,
  message: string,            // a sentence the agent can act on, naming element and property
}
```

The AUTHOR declares each finding's severity: `blocking` or `advisory`,
which `lint` answers with each finding. The plugin config may override a
gate's severity in either direction (`gates[<pluginId>][<gateId>]`, the
user's or the open project's). Anything that is not
`"advisory"` reads as blocking. A gate that throws, times out (30s) or
answers with something that is not a list yields ONE blocking finding
naming it, whatever the config says — the override speaks for the gate's
opinions, and a crash is not one. The finding names your plugin, the
gate and the error, and says what ends it, e.g. `the acme.lint plugin's
gate "static" (Static lint) threw: dd.findParent is not a function — a
failed gate blocks until the plugin is fixed, updated or turned off
(⌥⌘P)`, so catch what your gate can recover from and let it throw only
for what it cannot judge.

### 5.6 MCP contributions

**Browser tools — `dd.registerTool`.** The bridge lists your tool to every
connected harness under its declared `name`, as it is, and forwards each
call into the tab, so `run` acts against the live canvas with everything
`dd` reaches. `ToolRegistration` fields: `name`, `title`, `description`
(what the model reads), `inputSchema`, `run` and, optionally,
`annotations` — the MCP tool hints (`ToolAnnotations`: `readOnlyHint`,
`destructiveHint`, `idempotentHint`, `openWorldHint`) a harness reads to
auto-allow a read or confirm a destructive call. Say what your tool does:
core marks every tool of its own, and a tool with no annotations is taken
by the protocol's defaults — may write, may destroy.

```ts
dd.registerTool({
  name: "list_swatches", // declared in contributes.tools, ^[A-Za-z0-9_-]{1,64}$
  title: "List swatches",
  description: "Every distinct colour used by the open document.",
  inputSchema: {
    type: "object",
    properties: { viewportId: { type: "string", description: "…" } },
    required: [],
  },
  annotations: { readOnlyHint: true }, // it only reads the document
  run: async (input) => ({ swatches: [] }), // object → structured content + text
});
```

The name may not be a core tool's (`canvas_url`, `canvas_state`,
`instructions`, `get_viewport`, `measure`, `lint`, `update_item`,
`remove_item`, the eight `draft_*` tools — `draft_open`, `draft_append`,
`draft_replace`, `draft_remove`, `draft_edit`, `draft_set`,
`draft_finalize`, `draft_discard` — `resolve_variant`, and the four
`knowledge_*` tools) — a manifest declaring one is refused, plugin and
all — and only one live tool may hold a name across all plugins —
collisions are refused at registration, never shadowed at connect
time. `inputSchema` is JSON Schema and MUST be an object schema (`type: "object"`); the bridge
validates every call against it before `run` sees the input (`$ref`,
`$defs` and `not` are not converted — keep the schema flat). A returned
object becomes the call's structured content and its text; a string is the
text as is; a throw is an error result carrying the message.

**Host parts — `bridge.ts`.** For anything that needs files or processes,
ship a host part: a file beside the manifest default-exporting
`(host: DaydreamHostApi) => void | Promise<void>`, imported from
`@daydream/plugin-api/host`. The dev-server host loads it under plain Node
— never the page — while the plugin is enabled.

`DaydreamHostApi` members:

| Member                              | Contract                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `host.plugin`                       | `{ id, dir, dataFile, manifest }` — `dir` is the absolute folder, how a host part finds its own assets without `import.meta`; `dataFile` the absolute path of the plugin's storage file (what the browser part's `dd.storage` writes, `<project>/.daydream/plugin-data/<id>.json`), for naming it to an agent — it names the file in the project open when you read it, so read it when you need it; it is `null` while no project is open, and the file may not exist before the first write. |
| `host.registerTool(registration)`   | An MCP tool: `{ name, title, description, inputSchema, annotations?, run }` where `inputSchema` is a zod RAW SHAPE (`{ id: z.string() }`), `annotations` the same `ToolAnnotations` a browser tool declares, and `run` returns `{ text, structured?, isError? }`. The name takes a browser tool's grammar, `^[A-Za-z0-9_-]{1,64}$`, and no core tool's (a manifest declaring another is refused). |
| `host.registerPrompt(registration)` | An MCP prompt: `{ name, title, description, argsSchema?, build }`; arguments are zod STRING schemas (the protocol's rule), and `build` is read at request time. The name may not be `dream-author`, the kernel's own workflow prompt (a manifest declaring it is refused). |
| `host.registerResource(registration)` | One document at a fixed URI: `{ uri, name, title?, description?, mimeType, read }`.                          |
| `host.instructions(text)`           | Replace the manifest's `contributes.instructions` for guidance that needs a file or a computation.             |
| `host.knowledgeDir(path)`           | Declare (or move) the knowledge folder the core knowledge tools serve, plugin-relative (the folder's contract is below). |
| `host.tab`                          | The connected canvas tab: `state()`, `measure({ id?, viewportIds? })` and `lint({ viewportIds? })` over the open project, and `tool(name, input)` — a BROWSER tool by its declared name, run in the tab (decision #72): how a host part takes what only the page can produce and does with it what only Node can, in one call. Nothing that writes — a host part changes a page as any agent does, by its files (decision #78). Each rejects when no canvas tab is connected. |

**A knowledge folder.** What `contributes.knowledge` (or
`host.knowledgeDir`) names is served by the core `knowledge_*` tools
while the plugin is enabled, under paths prefixed with the plugin id
(`<id>/procedures.md`, `<id>/examples/cards.md`). Markdown files with
YAML frontmatter, each in one of four tiers:

```
---
topic: sticky-sidebar          # unique across every enabled plugin
title: Sticky sidebar
tier: example                  # procedure | format | example | reference
tags: [layout, sticky]         # optional list
summary: A sidebar that stays put while the article scrolls.
intent: a sticky sidebar       # examples only: what the document answers
---
```

`topic`, `title`, `tier` and `summary` are required; a file that lacks
one is a loader problem, not served. `format` is core's tier alone
(`knowledge/format.md`); a plugin serves `procedure` (at most one file,
short — about 1,200 tokens — read once per task), `example` (an intent
and a worked example, which `knowledge_bundle` picks by keyword) and
`reference` (longer synthesis, read on demand). The loader reads an
example's frontmatter only, never its body. The first-party corpora's
examples are still format-7 samples — one fenced `json` block holding a
whole `.dream` document, the page's markup and css inline — until the
plugins repo ports them: under format 8 (decision #78) a page is the
project's html file and the stylesheets it links, and `daydream.json`
names it by path and never holds its text, so such a sample is read for
its page, never opened or written as a project. A `private/` subfolder is served by the local host only
and never indexed into a committed file. `pnpm knowledge:index <folder>`
from a Daydream checkout writes the folder's `INDEX.md` for readers; the
host renders the index live from the files, so the committed one is for
people, and a test in a checkout keeps it current.

Nothing here returns a disposable: the bridge owns the lifetime and drops
the whole registration when the plugin is disabled or reloaded. Node's own
loader runs the file with type stripping, so write ERASABLE TypeScript (no
enums, no parameter properties) and give every relative import its `.ts`
extension. `bridge.ts` is re-imported on every reload, but a helper it
imports from `bridge/` stays in Node's module cache for the life of the dev
server — restart the dev server after editing a helper. Read files at
request time and a data edit needs neither.

### 5.7 Storage — `dd.storage`

One JSON object per plugin id, written to the open project's
`.daydream/plugin-data/<id>.json` through the host's storage capability,
and held in memory for the page's life when there is no host. A plugin's
state belongs to the project it is about, and is gitignored: the host
writes a `.gitignore` excluding `plugin-data/` when it makes the
project's `.daydream/`. With no project open a `get` reads nothing and a
`set` rejects with the host's sentence. The object is the project's it
was read from, and each `set` writes it there or nowhere: once the host
has opened another project (another tab's picker, `daydream <folder>`),
a `set` in a tab still showing the first one rejects, and the other
project's file is never written, until the tab reloads to it. A
`.daydream/`, `plugin-data/` or data file that is a symbolic link is
refused, never followed. Never inside the project's own pages: a page
must render identically whatever a plugin remembered.

```ts
const width = await dd.storage.get<number>("width");
await dd.storage.set("width", 420);
```

- `get` waits for host detection, so a read in the entry sees the last
  session's value — this is what lets a panel appear at its remembered size
  rather than jumping.
- Writes are serialized and the whole object is saved each time; a `set` is
  visible to the next `get` at once, before the write lands.
- A read that fails (a corrupt file, a dead bridge) starts the plugin EMPTY
  and logs — it never rejects your activation. Handle `undefined` and a
  value of the wrong shape; validate what you read.
- The object is loaded ONCE per page. Two tabs on the same project each
  hold their own copy, and the last write wins — do not use storage as a
  channel between tabs.

### 5.8 Canvas item kinds and input — `dd.registerItemKind`, `dd.canvas`

Declare the dotted `kind` in `contributes.itemKinds`. It must equal your
plugin id or begin with `<pluginId>.`; an existing core or plugin kind is
refused, never replaced. Repo plugins may share the reserved `daydream.`
namespace; external plugins may claim only their own namespace.
Register an `ItemKindRegistration` with a
`payloadProblem(raw, where)` validator and a `render({ item })` component.
The item is a live deeply readonly view; change it through the item writes
above. The renderer owns its DOM, typography and editing. Unloading removes
its validator and renderer but never deletes its document items: they
become ordinary unknown-kind placeholders until the plugin returns.
Parsing a saved document never runs custom validators or normalizers. The
renderer validates an enabled plugin's payload and shows unsupported
older/newer data as a placeholder, preserving it. Changed payload writes
(an item write, `update_item`) are validated against the enabled plugin's
contract before they are stored.

A manifest may declare `contributes.itemAssets`, mapping declared item kinds
onto their top-level payload asset fields and MIME families (`image`, `video`
or `font`), e.g. `{ "vendor.card": { "preview": "image" } }`. It is still
validated, so a manifest that declares it loads, but nothing reads it: it
told the format-7 host which payload fields to download into a document,
and a project (decision #78) has no such path. An item's payload is never
traversed or rewritten; `update_item` keeps a remote url as written, and a
file dropped on the canvas is copied into `assets/` by `dd.vendorFile`,
which names it. Leave it out of a new manifest.

Optional registration members:

- `normalize(payload)` fills optional payload fields after validation.
- `describe(item)` returns an agent-readable summary or null.
- `name(item)` supplies the title bar text; `rename(item, name)` updates a
  working item when the user renames it. Core commits through validated item
  writes in one undo step. Rejected results leave the editor open with a
  native validation error, without modifying the document. Without `rename`,
  the title is read-only.
- `title` defaults to true; false suppresses the core title bar.
- `resize` declares `min`, `max` world-pixel bounds and `reset` to allow
  double-clicking a resize handle to remove the explicit frame. Its optional
  `onResize(item, context)` mutates plugin-owned payload state inside the same
  live resize write; `context` reports the measured start/current sizes and
  whether Shift is constraining the gesture. Cancellation restores the payload
  snapshot along with the frame. Every item's resize preserves its starting aspect ratio while Shift
  is held. Set `freeform: true` when an ordinary horizontal side drag should
  materialize both frame axes instead of retaining automatic height, and
  `handles: "all"` to opt into the same eight-handle model viewports use.
- `editing(id)` hides core resize chrome during plugin editing. A plugin
  rendering drafts in an overlay suppresses its own duplicate item renderer.
- `styles` is the kind's CSS as a string, mounted by the kernel inside the
  item's root wrapper (`<div data-plugin-item="<pluginId>">`, laid out as
  `display: contents`, so your node still positions against the world) in
  the plugin layer — §6. Never a `<style>` in the item's JSX.

`dd.canvas.bindItemNode(id, node, { canDrag?, canMove?, draggable? })` registers the node as the
item's window for geometry, standard multi-item dragging and click/Shift-click
selection, and reports hover for the title-bar dimensions. Dispose the returned handle on component cleanup; the host also
tracks it for unload. Return false from `canDrag()` while editing to leave
pointer and click handling to your editor. Return false from `canMove(event)`
to suppress only the standard move for a particular press. Set
`draggable: false` for a
selection-only surface, such as a native video player; it remains selectable
without taking over playback controls. Double-click editing is yours.

`dd.canvas.bindDrag(node, handlers)` gives plugin-owned handles the same
primary-button pointer capture, world/screen coordinates, animation-frame
coalescing, terminal-click suppression, and Escape/blur cancellation as core
drags. Use `shouldStart(event)` to claim only the intended presses, then handle
`onStart`, `onMove`, and `onEnd`; the end context's `canceled` flag tells you
whether to restore or commit an editing transaction. Every context's `moved`
flag applies the standard click/drag threshold. Use `movementAxes()` when only
one rendered axis can move so inactive-axis motion does not count. `shiftKey`
reports Shift at the latest pointer event, including changes during a drag.

`dd.canvas.panMode()` and `optionMode()` are reactive; `center()` returns the
visible canvas center in world coordinates, and
`screenToWorld(clientX, clientY)` converts window coordinates without a new
layout read. Input subscriptions return tracked disposables:

- `onEmptyDoubleClick((event, position) => ...)` receives only unmodified
  primary double-clicks on empty canvas, excluding pan and drag gestures.
- `onPointerDown((event, { empty }) => ...)` runs at window
  capture phase, even outside the canvas. Call `event.preventDefault()` while
  finishing an editor to keep an empty-canvas press from clearing selection.
- `onActivity(() => ...)` reports canvas pointerdown, wheel and drop events,
  including interactions that change no document, selection or camera state.
  Use document/selection/geometry hooks for actual state changes and suppress
  your own operations explicitly when a gesture sequence must survive them.
- `onPaste(event => ...)` and `onCopy(event => ...)` exclude editable controls
  and already-claimed events. Use `event.preventDefault()` to claim an event
  and prevent later plugin handlers from also processing it. The same claim
  rule applies to `onEmptyDoubleClick`. `onPaste` accepts an optional
  `{ priority }` second argument (default 0, higher first). Rich clipboard
  handlers can claim a transfer before a plain-text fallback; ties use
  registration order.

- `onDragOver(event => ...)` accepts canvas transfers with `preventDefault()`.
- `onDrop(event => ...)` receives canvas drops. Claim synchronously with `preventDefault()` before awaiting uploads
  to stop later handlers. Core always suppresses browser navigation, even
  when no plugin claims the drop or a handler throws. Handler failures are
  logged and do not prevent subsequent unclaimed handlers from running.

`dd.vendorFile(file)` copies an image or a video file's bytes into the
open project's `assets/` folder, named by its bytes (`gen-<hash>.<ext>`,
so the same file dropped twice is one file), and resolves to `{ src,
pageSrc }`, `pageSrc` the project-relative name an item stores
(`assets/<file>`; `src` the same, deprecated) — what a media file
dropped on the canvas becomes (decision #78). It rejects with no project
open, for any other type (only images and videos the host serves) or a
file over 32 MB, and on plugin unload. Capture `dd.loadVersion()` before
awaiting it and check again before writing to avoid landing an item in a
different project.

`dd.assetUrl(name, from?)` is where a file of the open project is served
now: `name` resolved as a url in the page at `from` resolves — from that
page's folder, or from the project's root for `/…` — or, without `from`,
from the project's root, as an item's `assets/<file>` is; so an item's
renderer sets `src={dd.assetUrl(payload.src)}`. A url that names no
project file (an `https:` url, a fragment) comes back as it was. A kind
that stores a URL judges it itself, in its `payloadProblem` and before it
renders one: the Media plugin holds a `src` to a file of the project's,
`assets/<file>`, or an `https://` URL.

These subscriptions attach only while the canvas exists. They install no
keyboard listeners: register commands and shortcuts through the one router.

---

## 6. Styling

A plugin ships NO CSS files (§7). Ship CSS as a string and hand it to the
registration's `styles` field — a panel's, an overlay's or an item kind's;
the kernel mounts it as ONE `<style>` element, first inside that plugin
root, wrapped in `@layer dream-plugin`:

```ts
// styles.ts
export const classPrefix = (pluginId: string): string =>
  pluginId.replace(/[^A-Za-z0-9_-]/g, "-");

export const css = (p: string): string => `
.${p}-panel { font-size: 11px; color: #85858c; }
`;
```

```tsx
const p = classPrefix(dd.plugin.id); // "vendor.thing" → "vendor-thing"
dd.registerPanel({
  id: "thing",
  title: "Thing",
  styles: css(p),
  render: () => <div class={`${p}-panel`}>{/* … */}</div>,
});
```

The layer is why the field exists (decision #71): the app's cascade is
`@layer dream-app, dream-plugin` — plugin CSS sits above the app's own
chrome, in a layer of its own. A page on the canvas is out of its reach
entirely: it renders in its own shadow root (decision #76), which no rule
of the app's or a plugin's crosses, so `p { color: red }` in your string
restyles your panel and never a page. A `<style>` element you render
yourself is unlayered, and an unlayered rule beats every layered one —
the app's chrome and every other plugin's CSS included; the kernel
disables such a sheet and logs one problem under your plugin id. So does
a `}` in your string that closes the layer early: the kernel reads its
own emitted sheet back, and disables it unless it holds exactly the one
layer block. Your CSS still reaches the app's
chrome — the field is disclosure of the layer, not a sandbox — so keep to
your own class names.

Derive every class name — and every SVG `id`, like a `<pattern>` — from
`dd.plugin.id` this way. A copy of your folder under another id then styles
its own nodes and references its own defs, and never another plugin's.
Chrome text is small and sentence case, never uppercase or letter-spaced.

---

## 6b. The repo's own lint applies to your plugin

A plugin under `plugins/` is linted with the repo's rules, not just the
boundary ones. The two that bite first:

- **`solid/prefer-for` is an error.** Render lists with Solid's `<For>`;
  a `.map()` in JSX is refused. Solid 2.0 has no `Index` export.
- **`solid/reactivity`** warns when a reactive read escapes a tracked
  scope. Read signals inside JSX, a memo, or an effect's compute.

Solid 2.0 also refuses a signal write from inside an owned scope
(`REACTIVE_WRITE_IN_OWNED_SCOPE`): write from an event handler or from a
`dd.on` handler, never from your entry's synchronous body.

## 7. Boundary rules

These are enforced by lint in the repo (`daydream/plugin-boundary` in
eslint.config.js) so that a plugin written under `plugins/` survives the
move to a user folder unchanged. A runtime-loaded plugin is served and
transpiled from its own folder, so NOTHING OUTSIDE THAT FOLDER EXISTS for
it. The exact refusals:

- **No CSS files.** No `.module.css`, no `import "./x.css"`.

  > `` No CSS files in plugins ("./x.css"): ship CSS as a string through the registration's `styles` field (docs/plugin-authoring.md, Boundary rules). ``

- **No `import.meta`.** Neither `import.meta.url` nor `import.meta.glob`:
  the loader imports a runtime plugin from a served URL, not a file.

  > `No import.meta in plugins: runtime loading imports a served URL, not a file (docs/plugin-authoring.md, Boundary rules).`

- **Never `src/`.** The kernel is reached through `@daydream/plugin-api`
  and the `dd` object alone.

  > `Plugins never import src/ ("../../src/core/document"): use @daydream/plugin-api (docs/plugin-authoring.md, Boundary rules).`

- **No repo-relative imports**, and never another plugin's files.

  > `Import "../other/thing" leaves plugins/vendor.thing/: a plugin imports only packages and its own files — no repo-relative imports (docs/plugin-authoring.md, Boundary rules).`

- **Only packages your own `package.json` declares** (in `dependencies` or
  `peerDependencies`). `devDependencies` may be imported by `*.test.*`
  files, and by `*.test-support.*` files — what several of your tests
  share (§8) — only.

  > `Package "lodash" is not declared in plugins/vendor.thing/package.json (dependencies or peerDependencies).`
  > `Package "vitest" is a devDependency in plugins/vendor.thing/package.json: only *.test.* and *.test-support.* files may import it; a plugin ships with its dependencies and peerDependencies alone.`

- **Only a test imports a test's files.** A file that is neither a
  `*.test.*` nor a `*.test-support.*` file never imports one (§8): what
  the tests share may import your `devDependencies` and never ships. The
  kernel's own files are held to the same rule.

  > `Only a test imports "./media.test-support": a *.test.* or *.test-support.* file is what the tests share, and never ships (docs/plugin-authoring.md, Boundary rules).`

- **No Node modules in the browser part.** Only the host part (`bridge.ts`,
  `bridge/`) may import `node:*`.

  > `No Node modules in plugins ("node:fs"): the browser part runs in the page; only the host part (bridge.ts, bridge/) runs under Node.`

The mirror rule holds on the other side: files under `src/` never import
`plugins/` — the loader's `import.meta.glob` is the one door.

A repo plugin's `package.json` looks like this (`solid-js` and
`@solidjs/web` are PEERS, so the app's single Solid instance is shared):

<!-- embed: plugins/daydream.example/package.json -->

```json
{
  "name": "@daydream/plugin-example",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "dependencies": {
    "@daydream/plugin-api": "workspace:*"
  },
  "peerDependencies": {
    "@solidjs/web": "2.0.0-rc.9",
    "solid-js": "2.0.0-rc.9"
  },
  "devDependencies": {
    "@daydream/plugin-testing": "workspace:*",
    "vitest": "^4.1.11"
  }
}
```

---

## 8. Testing a plugin

Tests live beside the plugin's code, and two vitest projects pick them up
by filename:

| Filename                | Project   | Environment                                                              |
| ----------------------- | --------- | ------------------------------------------------------------------------ |
| `*.test.ts` / `.tsx`    | `unit`    | Node. The server build of Solid — effects and memos DO NOT run there.     |
| `*.browser.test.ts` / `.tsx` | `browser` | Real Chromium via Playwright. Everything reactive or DOM-bound goes here. |

What several test files share — a mount, a fixture builder, a gesture —
goes in a `*.test-support.ts` (or `.tsx`) file beside them, and each test
imports it. It may import your `devDependencies` as a test does, no
project collects it as a test, no install ships it, and only a test (or
another test-support file) may import it; a helper file of any other
name is a plugin file, held to the boundary rules (§7). A hook (`afterEach`) goes
in a function each test file calls at its top, so every file registers
its own (`cleanUpAfterEach()` in
`plugins/daydream.media/media.test-support.tsx`).

`@daydream/plugin-testing` is the harness — the one package allowed to
reach into the kernel on a plugin's behalf. Add it as a `devDependency`.

| Export                              | What it gives you                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `coreApi()`                         | `dd.core` alone — no kernel, no store. For pure-function tests; its `parsePage` and `uniqueSelector` need the browser project. |
| `createTestKernel(options?)`        | `{ dd, store, registry, commands, host, dispose }`: a real API object for a synthetic instance. Options: `project` (a `LoadedProject`: the document, its pages and the project; `testProject` builds one), `manifest`, `host`. The manifest is admitted as `mountPlugin`'s is, so one the runtime refuses — a name it may not declare, an API this Daydream does not have — throws the reason instead of making a kernel. |
| `mountPlugin(options)`              | The LOADER SEAM: the real Shell with your plugin enabled by config and activated through the real loader, found where the runtime would find it — a `daydream.` id in the repo's `plugins/`, any other in your user folder, trusted — so the origin rules apply as they will (`unstable` is yours to set, a first-party plugin's not). A plugin admission refuses rejects the mount at once with the reason. Browser only. |
| `mountShell(options?)`              | The whole app, with whatever plugins the test names — what `mountPlugin` is sugar over. Each mount starts from a fresh workspace (no remembered panel layout or camera); `keepWorkspace: true` keeps it, for a test of that memory. Browser only. |
| `forgetWorkspaces()`                | Forget every remembered panel layout and camera, as a mount does by default.                                                |
| `mountPanels(kernel)`               | The real panel layer over a test kernel's panels, without the canvas. Async: `await` it for `{ host, dispose }`. Browser only. |
| `renderViewport(store)`             | Renders the store's first viewport, so anything reading the browser's verdict has a real DOM. Browser only.                 |
| `pageFixtureProject()`              | A one-page project: html › body › `.grid` of `.header`, `.aside`, `.footer`, its css the page's one linked sheet, 960px frame; a fresh item id per call. |
| `loadPageFixtureProject()`          | That project loaded into the app store, and `{ itemId, title }` (the title bar reads the page's path).                      |
| `pageShadow(itemId)`, `pageNode(itemId, selector)`, `pageElementId(itemId, selector)` | The shadow root a mounted page renders in, the element a selector names there, and the render-time id the store selects it by — null until the page has mounted. |
| `fakeProjectHost(options?)`         | `{ host, stored, made }`: a host whose project copies a dropped file (`assets/dropped-<n>`, an image or a video only; `options.storeAsset` answers otherwise) and makes a page (`dd.createPage`, named as the host names one, with no sheets) in memory, recording each in `stored` (a refused file not) and `made`; its `read` rejects, so `loadOpenProject` fails over it. For a drop or a paste without a real host; a test of the host's own naming, downloads or sheets opens a real project. |
| `loadOpenProject()`                 | The project session's load of the host's open project, as a start and the mark's picker run it — for a test of a `leave` handler. Needs a host with the project capability (`overrideHostForTests`). Browser only. |
| `createFileHost(files?, options?)`, `FileHost`, `FileRequest` | The host's files routes faked at HTTP over a folder in memory (path → text, a leading `\ufeff` a byte order mark), answered as the host answers them — a write lands only over the hash it names (`null`: no file yet), else a 409 in the host's words sent with `code: "file-changed"` (`FILE_CHANGED_CODE`), and one to a file made a link, a folder, or under a file, a 409 with `code: "file-unwritable"` (`FILE_UNWRITABLE_CODE`), one naming bytes no UTF-8 reads by their hash a 422, `.git` and `.daydream` neither read nor written and `daydream.json` not written, and one `refuse`d answered the status and sentence given — for `overrideHostForTests({ project: host.project })`: `requests`, `writes()`, `text(path)`, `files()`, `change(path, text)` behind the tab (text, bytes in another encoding, or `null` to remove it), `link(path)`, `refuse(path, status, error, code?)`, `failNext(method, path)`, `hold()`, `openAnother(root, files)` (the host opens another project in this one's place: those files now, none a link, refused or failing); each request records the project it named (`project`). It serves one project, `options.root` (`TEST_PROJECT`'s by default; `null` serves any, for a host that holds one project and then another under the same tab), and refuses every request naming another, a read too, with the host's 409 with no code. `options.project` is what its `read` answers. Asserts which file received which text, byte for byte. That it answers as the host does is proven against the host's own routes, one table run against both, in the kernel's tests. |
| `gateContext({ page, viewportIds? })` | A gate's `GateContext` as core builds it, for a test that calls a gate's `run` itself: `page` is `ctx.page`, and `ctx.measure` and `ctx.mountViewport` are core's live measurer and mount showing each viewport's page as `page` answers it — so a test can judge a page the project does not hold, as a finalize does (a new page, a rework as it will be written). Its mounts live as long as the test, as a gate's live as long as its run: one the gate leaves open is disposed when the test finishes, and one asked for after is refused. Never `{ measure: kernel.dd.measure, mountViewport: kernel.dd.mountViewport }`: those see the project as it is. Browser only for the measure and the mount. |
| `unusedProject`                     | A host project every member of which rejects as the test's mistake: the base a test's own fake host project is made on, with what it uses put over it (`{ ...unusedProject, saveManifest }`) — a host project has no optional member. |
| `unusedProjectFiles`                | `unusedProject`'s file members (`readFile`, `readPage`, `writeFile`, `deleteFile`). |
| `createPageItem(texts, init?)`, `testProject(entries, init?)`, `TEST_PROJECT`, `fixturePage(project)`, `PAGE_FIXTURE_HTML`, `PAGE_FIXTURE_CSS`, `viewportItems`, `flush` | Building a viewport and its page, a project of them, the project a test's document belongs to, the fixture's viewport, its two texts, the typed viewport list, and Solid's flush for assertions after a write. |

`mountPlugin` returns `{ host, store, pluginHost, kernel, framed, panel(pluginId?), overlay(pluginId?), dispose() }`
and resolves once every enabled plugin is active and each one that declares
panels or overlays has them in the DOM. `framed` settles once the canvas
has its opening view in place — framed, or the saved one applied: await
it before measuring where anything is on screen, or a position taken
under the camera before it will be wrong. `panel()` is the panel's whole
section: the kernel's header — your title and its icon buttons — sits in it
above what your `render` drew, so find your own controls by what they say
or by your own class, not as the first `button`. Assert what a user
observes — DOM and API — never registry internals or component structure.

`createTestKernel` hands you `dd` and does NOT run your plugin: call your
own entry with `kernel.dd` yourself, then assert. It is the seam for
everything that needs the API but not the loader.

The page fixture is a real page, not an empty one: its css gives the
boxes backgrounds and a height, and the grid its tracks. Assert on what
your plugin does with them, not on an exact list you cannot see from here
— read `PAGE_FIXTURE_CSS` in the test if you need to know.

A page's elements have ids only once it has MOUNTED, and a fresh set on
every mount (§4.1): after `mountPlugin` or `mountShell`, wait for the one
you need —

```ts
const { itemId } = loadPageFixtureProject();
const mounted = await mountPlugin({ entry: activate, manifest });
let grid: string | null = null;
await vi.waitFor(() => {
  grid = pageElementId(itemId, ".grid");
  expect(grid).not.toBeNull();
});
mounted.store.setSelectedId(grid);
```

— and ask again after anything that remounts the page. A click dispatched
into a page must be `composed: true` to leave its shadow root.
`createPageItem({ html, css? }, init?)` makes a `TestPage` — a
`daydream.viewport` item with a `position` and an optional `frame`, and
the page it shows (`<id>.html` by default, its css its one linked sheet
`<id>.css` when not empty) — and `testProject([page, item, …])` a project
of them: build one when the fixture's page is not the one your test
needs.

There is no documented way to drive the camera from a test. To exercise a
pan or a zoom path, call `dd.geometry.invalidate()` — it starts the same
fresh invalidation state a camera move does, which is what your overlay
reacts to.

`mountShell` is the same mount without a plugin of your own to enable:
`document` loads a document first, `available` and `config` name the
plugins outright, `compiled` names compiled-in ones by id (appended to
`available`, and enabled by default), `host` injects the app host
(decision #35), `onHost` / `onKernel` capture what the shell creates,
and `waitFor` holds until that CSS selector matches inside the mount. It
returns `{ host, store, pluginHost, kernel, dispose() }`.

Every DOM mount disposes itself when the test finishes, so teardown is not
yours to remember; call `dispose()` only to unmount EARLY — to mount a
second shell under another config inside one test.

The kernel is built over the APP-WIDE store (the geometry cache and element
registry are singletons keyed on it), so pass a `project` — or call
`loadPageFixtureProject()` — to isolate a test from the previous one.

Run one file while iterating with `pnpm vitest run <path>`, then
`pnpm lint` and `pnpm test`.

---

## 9. Loading and trust

Plugins in the repo's `plugins/` folder are compiled into the build and
discovered by a glob. Plugins in `~/.daydream/plugins/` or the host's
own `<host>/.daydream/plugins/` are discovered by the host from disk and
served to the page as `/@fs/<dir>/index.tsx`: the dev server transpiles
them with the app's own Solid plugin and resolves `solid-js` and
`@solidjs/web` from the app's root, so ONE Solid instance is shared by
construction and the folder needs no `node_modules` for them. Run
`pnpm install` (or npm/yarn) inside the folder only if your plugin has
dependencies of its own; bare imports resolve from the folder upward.

**On the stable host** (the Homebrew install, `daydream serve`) there is
no compiler, so a plugin outside the repo runs its browser part from a
PREBUILT module: one ES file the manifest names as `built`. Build it from
a Daydream checkout —

```
pnpm plugin:build ~/.daydream/plugins/acme.swatches
```

— which writes `dist/index.js` with Vite in library mode and the
checkout's own Solid plugin: `solid-js` and `@solidjs/web` stay bare
imports, everything else (your own dependencies, resolved from your folder
upward) is bundled in, and CSS was a string already. Or run the same build
yourself, with `vite` and `@solidjs/vite-plugin` in your own repo:

```ts
// vite.config.ts in the plugin folder
import { defineConfig } from "vite";
import solid from "@solidjs/vite-plugin";

const ROOTS = new Set(["solid-js", "@solidjs/web"]);

export default defineConfig({
  plugins: [
    {
      name: "refuse-solid-subpaths",
      enforce: "pre",
      resolveId(id) {
        if (/^(solid-js|@solidjs\/web)\//.test(id)) {
          throw new Error(`${id}: import from solid-js or @solidjs/web`);
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
```

The page carries an import map that points `solid-js` and `@solidjs/web`
(the roots only: a subpath such as `solid-js/store` has no entry, so the
build above refuses it, as `pnpm plugin:build` does) at its own re-export modules, so the built file runs against the ONE Solid
instance the page runs, on either host. Then declare it in the manifest
(`"built": "dist/index.js"`), put the folder under `~/.daydream/plugins/`
or the host's own `<host>/.daydream/plugins/`, trust it (below — on the
stable host, `daydream trust <id>`), and turn it on from the plugins page
— or let one command do the three:

```
daydream plugin install ~/dev/my-plugins/plugins/acme.swatches
```

which links the folder into `~/.daydream/plugins/<id>` and records the
trust (printing what the manifest declares first). It leaves the plugin
OFF: turn it on from the plugins page, or install with `--enable`. A
plugin already on stays on, so run it again after a rebuild (the hash
changed, so the trust is recorded again) and nothing else moves; the
running host sees the config change and every tab picks it up.
`daydream plugin uninstall <id>` removes the link, the trust and the
enabled entry.
The host part (`bridge.ts`) needs no build: the host runs it under Node as
it is. Types come from `@daydream/plugin-api`, which is types only and
erased from the build, so a plugin builds without it installed.

`core.reload-plugins` (a command with no shortcut) tears every plugin down,
re-discovers and re-activates without a page reload, and asks the host to
reassemble host parts too. A change to either `plugins.json` itself
full-reloads the page in dev, so the loader and the gate runner always read
one config.

**Trust.** Plugins are trusted in-process code — there is no sandbox
(decision #48). A plugin discovered outside the repo does not run until
your `~/.daydream/plugins.json` records its folder hash under
`trusted[<id>].hash`: the mark's status line says a plugin is held, and
the plugins page (⌥⌘P) shows a caption naming the source folder and the manifest's declared `permissions` (with reasons —
disclosure, not enforcement), and the `core.trust-plugin` command records
the hash through the host after printing the same disclosure — as does
`daydream trust <id>` from a terminal, the way on the stable host. The hash is
sha256 over the folder's sorted file list and each file's content, with
`node_modules` and VCS folders excluded; a symbolic link in the folder is
hashed as where it points and, when that is a file, its content. A
project plugin's trust is recorded with its folder, under
`trusted[<id>].dirs`, and holds in that folder alone: the same plugin in
another project asks again. Trusting it there adds that folder beside
the first, so a plugin trusted in two worktrees of one project stays
trusted in both, each held back when its own copy changes. A change to ANY
file of a trusted plugin changes the hash: the plugin is held back
again, the caption says "updated since trusted" and lists the changed
files, and trusting it again acknowledges them. An untrusted plugin's code is never even fetched, and
its `bridge.ts` never runs. Repo plugins are exempt from both rules.
Trust is only ever the user's: a project's `.daydream/plugins.json` can
turn a plugin on, but a `trusted` block in it is ignored, so a cloned
project that turns on a plugin you have not trusted shows it waiting for
trust and runs none of it.

**The plugin API version** (decision #85). The API has a version of its
own, `major.minor` (`PLUGIN_API_VERSION` in `src/core/pluginApiVersion.ts`,
today `1.3`), apart from Daydream's release version: a release that
leaves the API alone leaves it alone too. The MINOR moves when something
is added, the MAJOR when a member is removed or its meaning changes.
Declare in `api` the version you built and tested against; a plugin runs
on a Daydream whose API has the same major and a minor at least its own.
Anything else is REFUSED before anything of it is imported, trusted or
not, wherever it comes from: no panel, no overlay, no item kind, no gate,
no command, no hook, and its `bridge.ts` never runs — no MCP tool, no
instructions, no knowledge. The plugins page (⌥⌘P) shows it grey, with
one line under the tiles, e.g. `CSS author 0.1.4: needs plugin API 1.4,
and this Daydream's is 1.3; update Daydream`, or, for an older major,
`built for plugin API 1.4, and API 2.0 took away …; update it`; the
host's `GET /api/plugins` listing carries the same sentence as
`refused`, and the host logs it when the plugin is enabled.

A manifest from before the API had a version says `minCore` and no
`api`. Its `minCore` is read as the API its release carried — 0.1.44,
0.1.45 and 0.1.46 are 1.0, 1.1 and 1.2 — so such a plugin runs as it
did, and the listing shows its manifest with that `api`. One from
before 0.1.44 reads as API 0.0 and is refused (`built for Daydream
before plugin API 1.0, and API 1.0 took away …; update it`). A `minCore`
of a later release is no release that read it, and the manifest is
refused. Replace the key with `api` when you next touch the plugin:
the version of the newest addition it uses. A manifest with both keys is
refused.

| API | First in Daydream | What changed                                                                                       |
| --- | ----------------- | -------------------------------------------------------------------------------------------------- |
| 1.0 | 0.1.44            | a project is any folder; a viewport shows a page by path (decision #78) — the break, below         |
| 1.1 | 0.1.45            | added `AcceptedVariant.alsoRestyled` (decision #82)                                                 |
| 1.2 | 0.1.46            | added a panel's `PanelContext` (decision #79)                                                       |
| 1.3 | 0.1.49            | added `dd.agent`, `dd.capture` and a panel's `lands` and `attention` (decision #87)            |

The types cannot move without the version. A test
(`tools/plugins/apiReport.test.ts`) emits the package's declarations,
comments removed, and its `exports`, for this checkout and for main's
sources of the package alike, with the same TypeScript, and fails when
they differ under main's version, or when a line of main's is gone or
changed under main's major: an addition is a minor, and anything else
the types show — a member removed, narrowed or moved into another
declaration, a parameter added, a declaration moved — a major. `pnpm plugin:api-report` refuses the
same and writes the surface to `packages/plugin-api/api-report.txt`
under the version — what a review reads to see what a change did to the
API; a test fails while it is behind. A meaning changed under the same
types is a major too, and only its author can see it.

**Breaking notes.** What each major took out, for a port. API 1.0
(Daydream 0.1.44) took a viewport's page out of its payload (decision #78):
a viewport's payload is `{ page, env? }`, where `payload.html` and
`payload.css` were, and a page is `{ path, html, sheets }`, read through
`dd.page(path)` (and a gate's `GateContext.page`); `DreamDocument` is a
project's `daydream.json`, `{ version: 8, meta?, pages, canvases }`,
where `items` was, and `dd.items()` the shown canvas's; `PagePayload` is
gone. `DreamPage` CHANGED MEANING: it was the viewport item, and is now
the page, `{ path, html, sheets }` — so a port's `dd.core.viewportItems(doc)
as DreamPage[]` no longer type-checks, the two types sharing no field: a
viewport is `DreamViewport`, and its page `dd.page(viewport.payload.page)`.
A viewport's own
`payload.meta` (its `title`, `notes` and `sourceUrl`) is gone and is
refused as not a viewport field, with no replacement on the viewport: a
page's provenance is `daydream.json`'s `pages[].meta.sourceUrl`
(`DreamPageEntry.meta`, a `DreamPageMeta`), where `DreamMeta.sourceUrl`
moved to — `DreamMeta` is the project's `{ title?, notes? }`. A
`PageStackRule` names its `sheet` and its key is its sheet's; an `add`
edit names its `sheet` and an `html` edit its page's `path`;
`MeasureOptions` and `MountOptions` lost `assetBase`; `dd.assetUrl`
resolves from a page's path; `dd.vendorFile` copies into the open
project's `assets/`, and `dd.writePage` writes the project's files by
splice, refusing what it cannot write narrowly rather than writing back the
page as the browser serializes it. `dd.cleanPage` is removed, with
`CleanedPage` and `CleanPageOptions`: it cleaned a page's `{ html, css }`
and folded every `<style>` and linked stylesheet into one css, which a
page of the project never is (its `sheets` stay apart, a remote one
read-only), and there is nowhere to store a page made on the canvas. An
item kind's `prepare` and `measure` are removed: nothing called them once
the landing paths retired. On the host part, `host.tab.measure` and
`host.tab.lint` lost their `dream` input — they read the open project,
`measure` taking `{ id?, viewportIds? }` and `lint` `{ viewportIds? }` —
and `host.plugin.dataFile` is `string | null`, null while no project is
open. And the testing exports became `pageFixtureProject`,
`loadPageFixtureProject`, `testProject` and `loadOpenProject`, with
`createTestKernel`, `mountShell` and `mountPlugin` taking a `project`
where their `document` and `slug` options were, and `openSlug` removed.
Before it, 0.1.38 removed the element tree (decision #76: `findElement`,
`findParent`, a viewport payload's `root`), and with it
`MeasuredElement.label` (a measured element is named by its `selector`,
which its `id` repeats) and seven `@daydream/plugin-testing` fixture
exports: `fixtureDocument`, `fixtureRoot`, `FixtureIds`,
`loadFixtureDocument`, `createFixtureDocument`, `createElement` and
`createViewportItem`, whose page-shaped replacements are the project
fixtures and `createPageItem` (§8). Decision #77 (0.1.40) left it there: the tree's types it took out
were on the `./document` subpath, core's alone, `Finding.layer` is a
field a gate writes and nothing reads, and `dd.vendorFile` keeps its
shape, its deprecated `src` now the same `assets/<file>` as `pageSrc`.
0.1.44 also adds `dd.createPage` (§4.2), `GateContext.mountViewport`
(§4.6) and a variant (Phase 9): `payload.variant` (`ViewportVariant`),
`dd.acceptVariant` and `dd.discardVariant` (§4.2), with a variant's own
sheet marked `PageSheet.variant` and `PageStackSheet.variant` (§4.2,
§4.4; decision #81); and it runs the gates
at a draft's finalize (§5.5). A test that
builds a `GateContext` by hand to call a gate's `run` must now give it
`mountViewport` too: `gateContext({ page })` from
`@daydream/plugin-testing` (§8) builds the whole context core builds,
over any page lookup.

---

## 10. A complete example plugin

`plugins/daydream.example/` is a working plugin that uses every extension
point an author meets first: a panel that shows the selected element's tag,
a badge drawn in the `overlay.screen` slot at the selection's top-left, one
command with a shortcut, one hook, and a toggle remembered through
`dd.storage`. It is a workspace member with a passing browser test, and it
is DISABLED in the committed `.daydream/plugins.json` — it exists to be
read. The blocks below are the files, verbatim (a test asserts they equal
what is on disk).

### `manifest.json`

<!-- embed: plugins/daydream.example/manifest.json -->

```json
{
  "id": "daydream.example",
  "name": "Example",
  "version": "0.1.0",
  "api": "1.2",
  "contributes": {
    "panels": ["example"],
    "overlays": ["tag-badge"],
    "commands": ["daydream.example.toggle-badge"],
    "shortcuts": { "Mod+Shift+E": "daydream.example.toggle-badge" }
  }
}
```

### `icon.svg`

A 24×24 viewBox, simple geometry, and the plugin's own colours. Icons
render at 40px; use a clear silhouette and details that survive that size.
The page drains them to grey when the plugin is off, so choose colours
that read in both states. Keep the background transparent. The file is inlined at build time for a repo plugin.

<!-- embed: plugins/daydream.example/icon.svg -->

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <path d="M9 6a3.5 3.5 0 1 1 6 0h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4.5a3.5 3.5 0 1 0 0-6V8a2 2 0 0 1 2-2h4Z" fill="#80ddec"/>
</svg>
```

### `index.tsx`

<!-- embed: plugins/daydream.example/index.tsx -->

```tsx
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
```

### `styles.ts`

<!-- embed: plugins/daydream.example/styles.ts -->

```ts
// The plugin's CSS as a string (decision #48: plugins ship no CSS
// files — runtime loading serves a folder, not a bundler's graph). Handed
// to `registerPanel` and `registerOverlay` as `styles` (index.tsx): the
// kernel mounts it once per root, inside the dream-plugin layer (decision
// #71); it can never restyle a document, which renders in its own shadow
// root (decision #76). Class names carry a prefix DERIVED from
// `dd.plugin.id` (`daydream.example` → `daydream-example-…`), so a copy of
// this folder under another id styles its own nodes and never this one's.

/** The class prefix for a plugin id: dots (and anything else a class name
 * cannot carry) become dashes. */
export const classPrefix = (pluginId: string): string =>
  pluginId.replace(/[^A-Za-z0-9_-]/g, "-");

export const css = (p: string): string => `
.${p}-panel {
  padding: 6px 14px 12px;
  font-size: 11px;
  line-height: 1.55;
  color: #85858c;
}

.${p}-tag {
  color: #b8b8c0;
  font-weight: 600;
}

.${p}-toggle {
  margin-top: 8px;
  padding: 2px 8px;
  font: inherit;
  color: #b8b8c0;
  background: #26262b;
  border: 1px solid #3a3a41;
  border-radius: 4px;
  cursor: pointer;
}

/* Screen space (overlay.screen): the badge sits at the selection's
   top-left in canvas px and stays the same size at any zoom. */
.${p}-badge {
  position: absolute;
  transform: translateY(-100%);
  padding: 1px 5px;
  font-size: 10px;
  line-height: 1.4;
  color: #0d0d10;
  background: #4c9aff;
  border-radius: 3px;
  white-space: nowrap;
}
`;
```

### `example.browser.test.tsx`

<!-- embed: plugins/daydream.example/example.browser.test.tsx -->

```tsx
// The plugin through the loader seam (decision #48, testing
// decisions; docs/plugin-authoring.md, "Testing a plugin"): mounted into
// the real shell by @daydream/plugin-testing and asserted from the DOM —
// what a user sees. Nothing here fakes the API, so the API can grow
// without touching this file.
import { afterEach, describe, expect, test, vi } from "vitest";

import type { PluginManifest } from "@daydream/plugin-api";
import {
  flush,
  loadPageFixtureProject,
  mountPlugin,
  pageElementId,
  TEST_PROJECT,
  type Host,
  type MountedPlugin,
} from "@daydream/plugin-testing";

import activate, {
  BADGE_KEY,
  LAST_SELECTION_KEY,
  TOGGLE_COMMAND,
} from "./index";
import rawManifest from "./manifest.json";

const manifest = rawManifest as PluginManifest;

let mounted: MountedPlugin | null = null;

afterEach(() => {
  mounted?.dispose();
  mounted = null;
});

/** A host whose storage knows plugin data alone, over an in-memory map —
 * what `.daydream/plugin-data/` is to the bridge. A read answers the
 * project it was read from: the one the fixture opens. */
function fakeHost(files: Record<string, Record<string, unknown>> = {}) {
  const host = {
    storage: {
      loadPluginData: vi.fn(async (id: string) => ({
        data: files[id] ?? {},
        root: TEST_PROJECT.root,
      })),
      savePluginData: vi.fn(async (id: string, data: unknown) => {
        files[id] = structuredClone(data) as Record<string, unknown>;
      }),
    },
  } as unknown as Host;
  return { host, files };
}

const badge = (): HTMLElement | null =>
  mounted!.overlay()!.querySelector(".daydream-example-badge");

/** Mount the plugin over the page fixture (`host` for `dd.storage`) and
 * wait for the page: the runtime id of its `.grid`, a `div`, which the
 * store selects it by. */
async function mountOnPage(host?: Host): Promise<string> {
  const { itemId } = loadPageFixtureProject();
  mounted = await mountPlugin({
    entry: activate,
    manifest,
    ...(host === undefined ? {} : { host }),
  });
  let grid: string | null = null;
  await vi.waitFor(() => {
    grid = pageElementId(itemId, ".grid");
    expect(grid).not.toBeNull();
  });
  return grid!;
}

/** The plugin's data as the fake host holds it. A `dd.storage.set` made
 * from a command resolves on its own schedule (the writes are serialized
 * behind the load), so a wait for the expected value — with a deadline —
 * is the honest read of a write in flight. */
async function stored(
  files: Record<string, Record<string, unknown>>,
  expected?: [key: string, value: unknown],
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + 2000;
  while (
    expected !== undefined &&
    files[manifest.id]?.[expected[0]] !== expected[1] &&
    Date.now() < deadline
  ) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  return files[manifest.id] ?? {};
}

describe("daydream.example", () => {
  test("the manifest declares everything the entry registers", () => {
    expect(manifest.id).toBe("daydream.example");
    expect(manifest.api).toMatch(/^\d+\.\d+$/);
    expect(manifest.contributes?.panels).toEqual(["example"]);
    expect(manifest.contributes?.overlays).toEqual(["tag-badge"]);
    expect(manifest.contributes?.commands).toEqual([TOGGLE_COMMAND]);
    expect(manifest.contributes?.shortcuts).toEqual({
      "Mod+Shift+E": TOGGLE_COMMAND,
    });
    expect(manifest.unstable).toBeUndefined();
  });

  test("the panel follows the selection and the badge sits at its top-left", async () => {
    const grid = await mountOnPage();
    const panel = mounted!.panel()!;
    expect(panel.getAttribute("aria-label")).toBe("Example plugin");
    expect(panel.textContent).toContain("Nothing selected.");
    expect(badge()).toBeNull();

    mounted!.store.setSelectedId(grid);
    flush();
    expect(panel.textContent).toContain("Selected: div");
    // The screen slot, under core's outline, at the element's rect.
    const slot = mounted!
      .overlay()!
      .closest("[data-plugin-overlay-slot]")!
      .getAttribute("data-plugin-overlay-slot");
    expect(slot).toBe("overlay.screen");
    const it = badge();
    expect(it).not.toBeNull();
    expect(it!.textContent).toBe("div");
    // Positioned from dd.geometry.rect — overlay coordinates, already the
    // screen space this slot draws in.
    expect(it!.style.left).toMatch(/px$/);
    expect(it!.style.top).toMatch(/px$/);
    // One <style> — the kernel's, from `styles`, in the plugin layer; the
    // class names prefixed from the plugin id.
    const styles = mounted!.overlay()!.querySelectorAll("style");
    expect(styles).toHaveLength(1);
    expect(styles[0]!.textContent).toMatch(/^@layer dream-plugin \{/);
    expect(styles[0]!.textContent).toContain(".daydream-example-badge");
    expect(getComputedStyle(it!).backgroundColor).toBe("rgb(76, 154, 255)");
  });

  test("the command toggles the badge, from the key and from the panel, and the toggle is remembered", async () => {
    const { host, files } = fakeHost();
    const grid = await mountOnPage(host);
    mounted!.store.setSelectedId(grid);
    flush();
    expect(badge()).not.toBeNull();

    // The declared chord, dispatched as the browser would: the shell's one
    // key router resolves it in canvas scope.
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "E",
        code: "KeyE",
        metaKey: true,
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    flush();
    expect(badge()).toBeNull();
    expect(await stored(files, [BADGE_KEY, false])).toMatchObject({
      [BADGE_KEY]: false,
    });

    // The panel's button runs the same command through dd.runCommand
    // (found by its words: the header's icons are buttons too).
    Array.from(mounted!.panel()!.querySelectorAll("button"))
      .find((button) => button.textContent === "Show the badge")!
      .click();
    flush();
    expect(badge()).not.toBeNull();
    expect(await stored(files, [BADGE_KEY, true])).toMatchObject({
      [BADGE_KEY]: true,
    });

    // A session that stored "hidden" comes back hidden, before the first
    // paint of the badge.
    mounted!.dispose();
    files[manifest.id] = { [BADGE_KEY]: false };
    const again = await mountOnPage(host);
    mounted!.store.setSelectedId(again);
    flush();
    expect(badge()).toBeNull();
  });

  test("the selection hook fires on changes after subscribing", async () => {
    const { host, files } = fakeHost();
    const grid = await mountOnPage(host);
    // Nothing yet: a hook reports changes, never the state at activation.
    expect(await stored(files)).not.toHaveProperty(LAST_SELECTION_KEY);

    mounted!.store.setSelectedId(grid);
    flush();
    expect(await stored(files, [LAST_SELECTION_KEY, grid])).toMatchObject({
      [LAST_SELECTION_KEY]: grid,
    });
  });
});
```

To run it: turn it on from the plugins page, or add `"daydream.example"`
to `enabled` in `~/.daydream/plugins.json` (or a project's
`.daydream/plugins.json`) and reload. To start your own, copy the folder,
rename it to your id (`vendor.name`, folder name included), change
`manifest.id`, `package.json`'s `name`, and the command id's prefix — the
class names follow `dd.plugin.id` on their own.
