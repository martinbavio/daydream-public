---
name: dream-author
description: Author a playable page for Daydream — an html file (and its stylesheet) in the open project, shown on the user's canvas — or refine and rework a viewport already on the canvas. Use whenever the user shares layout source material (a URL, article, or CSS snippet), asks to transcribe or replicate a technique into their project, names a pattern to play with ("Holy Grail layout", "RAM pattern"), asks for a layout playground built from scratch ("make me a three-column grid to poke at"), wants a design they have open in Paper turned into something editable, asks to change, fix or rework a viewport that is already open, or asks to have a viewport on the canvas explained ("what makes this layout work?") — even if they don't say "page" or "Daydream".
---

# dream-author

Turn layout knowledge into playable pages: html files of the open
project, with their stylesheets. The output is a learning artifact: the
user sees it on the Daydream canvas, selects elements, and plays
with the layout via the style panel. Optimize for _instructive to
manipulate_, not for visual fidelity to the source.

Six ways in, one format, one project (explain writes nothing):

- **Transcribe** — a URL, article, or CSS snippet.
- **From intent** — "a three-column grid playground", no source.
- **Paper → Daydream** — a design open in Paper, read via its MCP.
- **Rework** — a viewport already on the canvas: its page's files
  changed, directly or through a draft that writes back only what
  changed.
- **Variants** — alternatives of a viewport already on the canvas, each
  a copy kept beside it until the user picks one.
- **Explain** — a viewport already on the canvas, read and explained; the
  one mode that writes nothing.

This file is Daydream's own workflow (decision #65): the Daydream MCP
server serves its marked section as the `dream-author` prompt, so a
client with no skills gets the same steps. The format rules are core's
(`knowledge/format.md` — the server's own instructions on every
connection), the gates are the enabled plugins', and the layout
procedures are a lint plugin's, served through the knowledge tools while
it is on. Nothing here restates any of them.

## Check first

Look at your tool list for the Daydream server. Inside a Daydream
checkout (the Daydream repository itself) it is the dev host's,
`daydream-dev`, which the project's `.mcp.json` / `.cursor/mcp.json` /
`.codex/config.toml` name; anywhere else it is `daydream`. If its tools
are not listed but you can run shell commands, run `daydream tool`: it
lists the same tools, and each one is a command (Step 4). In a checkout,
give it the dev host's port — `daydream tool --port <port>` (or `pnpm
host tool --port <port>` after `pnpm host:build`), the `port` in the
checkout's `.daydream/host.json`, there while `pnpm dev` runs — never
its default port, which is the installed app's host, not this one. If
neither works, Daydream is not reachable — STOP and tell the user. A
checkout: `pnpm dev` starts the dev host. Installed Daydream: open the
Daydream app, or start the host (`daydream`, or `brew services start
daydream`), and register it with this harness (the app's Daydream >
Connect Agents…, or `daydream connect`), then reconnect. Do not author a
document from memory.

<!-- workflow:start -->

## Workflow

The tool discipline — what a tool answers with, how a finding is
treated, what the reply is made of — is the server's instructions (the
"Core tools" section, on every connection) and is not restated here; this
workflow adds the steps. One rule of its own holds through every step:

- **Parallel first turn.** When a step names two calls, call them in the
  SAME turn (parallel tool calls); do not wait for one to plan the other.

### Step 0 — Open the draft and sync with truth (one turn, never skip)

Two ways reach the project's files: a DRAFT, which the user watches grow
group by group on the canvas until `draft_finalize` writes it, and your
own file tools, for a change you can make in a few exact edits. A NEW page
is always built in a draft: never a finished page revealed at the end,
and never a half-built file sitting in the user's site. The user's first
signal that work started is the empty frame on their canvas, so
`draft_open` is the FIRST call you make — before the bundle, before any
resource or knowledge file, before you plan the page. It needs nothing
you have to read for: for a fresh page (transcribe, from intent, Paper)
the first turn holds TWO calls, in parallel, the open first:

- `draft_open` — `frame` (the source's width, else 960), the `title` in
  `meta`, `html`: the page's skeleton, an empty `<body>` and no content
  yet, and `css`: the page-level rules only (the `html` background, the
  font stack, colour, any `@font-face`). The page background is NOT
  optional: send it in this first call and keep it through every later
  change — a page that declares none paints whatever the canvas shows
  through, and reads as a page with no background while it builds. Its
  answer is the draft id; every later call names elements by CSS
  selector (`body` for the first section). Give it an `outline` — the
  section names you will append, short, in order — and name the matching
  `section` on each `draft_append`: that is what the canvas shows the
  user as progress. Each answer's `next` goes back as `token` on your
  following write, so a write you had to send twice lands once. Plan the
  sections AFTER it answers, and append the first one as soon as it is
  written — do not hold a finished page back to append it all at once.
- `knowledge_bundle {query}` — when the knowledge tools are listed — the
  task in a few words ("card grid", "sticky sidebar") — returns in ONE
  call `format.md` (a project's shape, format 8, and the rules the
  renderer and the gates enforce)
  and the example nearest the task; `examples: 2` or `3` when the task
  spans techniques. Read the procedures the enabled plugins serve from
  the same call or from `knowledge_read` (the index names them): which
  formatting context, whether a declaration is needed at all, where in
  the cascade it goes. If no `knowledge_*` tool is listed, no enabled
  plugin has an opinion about layout: nothing but the format gate will
  judge your pages, and no procedures exist for you to read. Say so
  to the user once, then go on by the format rules alone — the first
  turn is then `draft_open` by itself.

`canvas_state` is needed only for a rework, an explanation, or placing
relative to existing content — then it joins that first turn beside the
bundle, and the rework's `draft_open` follows once the id is known. The
format rules come with the server's instructions on every connection —
do not read them again. The format file cites `src/core/types.ts` and
`src/core/pagePayload.ts` as the model; if the code and the file disagree,
**the repo wins** — report the drift. `knowledge_index` /
`knowledge_search` / `knowledge_read` are for more (reference files,
another example; paths are `<plugin id>/<file>`), not for Step 0.

Without an MCP server: read `knowledge/format.md` and, from an enabled
plugin's knowledge folder (`~/.daydream/plugins/<id>/knowledge/`, or the
host's own folder's `.daydream/plugins/<id>/knowledge/` — never the open
project's, which holds no plugins), its procedures and one example in the
neighborhood of the task.

### Step 1 — Gather the source, by mode

- **Transcribe.** Fetch the article or snippet. Identify the declarations
  that carry the lesson and the minimum structure that makes them work;
  strip decoration. How many viewports the source becomes is `format.md`'s
  call (its authoring guidance) — apply it, do not decide it here; each
  is its own draft. Several unrelated techniques: ask which, unless the
  user said "all of it". Keep the source's at-rules (`@media`,
  `@container`, `@supports`) verbatim, record the URL as `sourceUrl`,
  and skip `canvas_state` — the kernel picks free space for the draft.
- **From intent.** No source, no `sourceUrl`, no `canvas_state`. Pick the
  smallest document in which the idea is manipulable: which knob is the
  point, what to drag first, what should visibly break. Tell the user in
  your final reply, not in the document.
- **Paper → Daydream.** Read the design through Paper's MCP, never off a
  screenshot: `get_guide({topic: "paper-mcp-instructions"})` once per
  session, then `get_basic_info`, `get_selection`, `find_nodes` /
  `get_tree_summary`, and `get_node_info` + `get_computed_styles` (or
  `get_jsx`) for exact values; resolve `get_tokens` to real CSS — the
  page's css may keep them as custom properties. Translate, don't transfer: absolute canvas positions
  become real grid/flex with the same visual result, the artboard width
  becomes `frame.width`. Name the Paper file in the viewport `title`.
- **Rework.** `canvas_state` (same turn as the bundle) for the viewport
  ids, the page each shows and the selection. A change you can make in a
  few exact edits you may make in the page's files directly; anything
  the user should watch take shape goes through `draft_open {from: id}`
  — from then until Step 3 the canvas displays your draft where that
  viewport stood. Its answer is `seeded`, not the text: read it with
  `get_viewport {id}` (one section by selector with `element`). Change
  only what was asked; keep the rest verbatim.
- **Variants.** When the user asks for alternatives of a page or a
  section to compare — several directions, not one rework — open one
  `draft_open {copyOf: id}` per direction, back to back, each at a
  position beside the source, then write each copy as a rework is
  written. Its finalize leaves the site alone: each lands beside its
  source for the user to judge. To refine one, `draft_open {from: id}`
  on the variant's own viewport: it reworks the variant, never its page.
  End them with `resolve_variant` as the server's instructions say
  ("Core tools", DRAFTS).
- **Explain.** `canvas_state` (same turn as the bundle) to find the
  viewport (the selection, or the one the user named), `get_viewport {id}`
  for its exact document, `measure` for the browser's geometry and
  findings. Explain from those facts: which formatting context does the
  work, which declarations are load-bearing, what to drag or change first
  and what will visibly happen. Land nothing; the explanation is your
  reply. Skip Steps 2–4.

### Step 2 — Author, into the draft

Follow the format rules (`format.md`, in the bundle and in the server's
instructions) for the shape, the meta (`title`, `sourceUrl`; no written
notes) and the authoring rules — and, when Step 0 gave you procedures,
those for every judgment: which formatting context, whether a
declaration is needed at all, where in the cascade it goes. Without
them, the format rules are the whole of the law.

Build in the draft, one visual group per `draft_append` — the header, one
card, the row that holds the cards, the footer — its markup under its
`parent` selector (`before` a sibling when it belongs ahead of one) and
its rules as `css` in the same call; never the whole page in one call,
and no group before the procedures (when you have them) have judged it.
The answer names each element it added by a selector: give a group an
`id` or a class of its own, and address it by that from then on. In a
rework, `draft_edit` changes the markup in place (an attribute, a
text), `draft_replace {target}` swaps an element you were asked to
rebuild, `draft_append` inserts what is missing (its `css` the rules to
add), `draft_remove` deletes what goes — and everything else stays as
pulled. A call the kernel refuses with a finding (a selector matching
none or several, css left open) is repaired and sent again; the gates
do not judge the draft until Step 3.

### Step 3 — Write the files, then check them on the canvas

Once every group is in, call `draft_finalize` on the whole page. On a
blocking finding, repair what it names in the draft and finalize again;
any other refusal says what to do next. Report from its answer.

An edit you made directly in the files is checked the same way: the
canvas follows the files, so a moment after you write one, what you check
is what you wrote. `lint` runs the enabled plugins' gates over the
project's pages and `measure` reports the browser's geometry; repair what
their findings name in the files, and check again. No plugin gate runs
without the canvas open — the Daydream app's window, or `canvas_url` in a
browser — so open it if it is not.

### Step 4 — Without the MCP server

Every tool this skill names is also a command, for an agent with a shell
and no MCP client: `daydream tool` lists them, `daydream tool <name>
--help` shows one's inputs, and `daydream tool <name> key=value …` calls
it and prints its result — `daydream tool canvas_state`, `daydream tool
lint`, `daydream tool get_viewport id=<id>`. A value is read by the
tool's inputs: text for a string, JSON for a number, a list or an
object; `--input '<json>'` gives the whole argument object. Exit 1 is
the tool's own error, as the MCP tool would answer it; exit 2 is
anything else, said in one line on stderr — most often no Daydream
running (ask the user to open the Daydream app). Use it wherever this
skill says to call a tool.

Without the command either, write the page's files into the project
folder yourself, and tell the user their paths: the host shows them on
the canvas once the folder is opened (a click on the mark, or `daydream
<folder>`), and follows each change to them after.

### Step 5 — Report

Technique captured, how many pages and viewports, what to drag or change
first, which files you wrote (the finalize names them) and what the
finalize, `measure` and `lint` said about them, any fidelity compromises (stripped decoration, unsupported features,
source ambiguities), and any drift found in Step 0.
<!-- workflow:end -->

## Degraded inputs

- Article paywalled or unfetchable: say so, ask for a paste.
- Paper MCP unavailable or the file not open: say so; never guess values
  from a screenshot.
- The technique depends on runtime behavior Daydream cannot show (JS-driven
  layout, scroll-driven animation): transcribe the static skeleton and say
  what is lost in your reply.
- No canvas connected and no host: write the files and say why.
