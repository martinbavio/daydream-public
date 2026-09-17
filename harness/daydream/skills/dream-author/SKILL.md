---
name: dream-author
description: Author a playable .dream document for Daydream and land it on the user's canvas, or refine and rework a viewport already on the canvas. Use whenever the user shares layout source material (a URL, article, or CSS snippet), asks to transcribe or replicate a technique into their library, names a pattern to play with ("Holy Grail layout", "RAM pattern"), asks for a layout playground built from scratch ("make me a three-column grid to poke at"), wants a design they have open in Paper turned into something editable, asks to change, fix or rework a viewport that is already open, or asks to have a viewport on the canvas explained ("what makes this layout work?") — even if they don't say ".dream" or "Daydream".
---

# dream-author

Turn layout knowledge into playable `.dream` documents. The output is a
learning artifact: the user opens it in Daydream, selects elements, and plays
with the layout via the style panel. Optimize for _instructive to
manipulate_, not for visual fidelity to the source.

Five ways in, one format, one landing (explain lands nothing):

- **Transcribe** — a URL, article, or CSS snippet.
- **From intent** — "a three-column grid playground", no source.
- **Paper → Daydream** — a design open in Paper, read via its MCP.
- **Rework** — a viewport already on the canvas, reopened as a draft,
  changed, finalized.
- **Explain** — a viewport already on the canvas, read and explained; the
  one mode that lands nothing.

This file is Daydream's own workflow (decisions.md #65): the Daydream MCP
server serves its marked section as the `dream-author` prompt, so a
client with no skills gets the same steps. The format rules are core's
(`knowledge/format.md` — the server's own instructions on every
connection), the gates are the enabled plugins', and the layout
procedures are a lint plugin's, served through the knowledge tools while
it is on. Nothing here restates any of them.

## Check first

Look at your tool list for the Daydream server (usually `daydream`). If
its tools are not listed at all, the MCP server is not connected — STOP
and tell the user. Installed Daydream: start the host (`daydream`, or
`brew services start daydream`) and register it with this harness
(`daydream connect`), then reconnect. A Daydream checkout: the project's
`.mcp.json` / `.cursor/mcp.json` / `.codex/config.toml` name the dev host
(`daydream-dev`); `pnpm dev` starts it. Do not author a document from
memory.

<!-- workflow:start -->

## Workflow

The tool discipline — what a landing answers with, how a finding is
treated, what the reply is made of — is the server's instructions (the
"Core tools" section, on every connection) and is not restated here; this
workflow adds the steps. One rule of its own holds through every step:

- **Parallel first turn.** When a step names two calls, call them in the
  SAME turn (parallel tool calls); do not wait for one to plan the other.

### Step 0 — Open the draft and sync with truth (one turn, never skip)

Every viewport you author is a DRAFT the user watches grow, group by
group — never a finished page revealed at the end. The user's first
signal that work started is the empty frame on their canvas, so
`draft_open` is the FIRST call you make — before the bundle, before any
resource or knowledge file, before you plan the page. It needs nothing
you have to read for: for a fresh document (transcribe, from intent,
Paper) the first turn holds TWO calls, in parallel, the open first:

- `draft_open` — `frame` (the source's width, else 960), the `title` in
  `meta`, the `fonts`, and `root`: the `html › body` skeleton carrying the
  root-level styles only (page background, font, colour) and no content
  yet. The page background is NOT optional: the format rules put it on
  `html`; send it in this first call and keep it through every later
  change of the root — a page that declares none paints whatever the
  canvas shows through, and reads as a page with no background while it
  builds. Its answer is the draft id and the skeleton with its ids; hold
  both, every later call addresses them. Give it an `outline` — the
  section names you will append, short, in order — and name the matching
  `section` on each `draft_append`: that is what the canvas shows the
  user as progress. Each answer's `next` goes back as `token` on your
  following write, so a write you had to send twice lands once. Plan the
  sections AFTER it answers, and append the first one as soon as it is
  written — do not hold a finished page back to append it all at once.
- `knowledge_bundle {query}` — when the knowledge tools are listed — the
  task in a few words ("card grid", "sticky sidebar") — returns in ONE
  call `format.md` (the .dream v6 shape and the rules the gates enforce)
  and the example nearest the task; `examples: 2` or `3` when the task
  spans techniques. Read the procedures the enabled plugins serve from
  the same call or from `knowledge_read` (the index names them): which
  formatting context, whether a declaration is needed at all, where in
  the cascade it goes. If no `knowledge_*` tool is listed, no enabled
  plugin has an opinion about layout: nothing but the format gate will
  judge your landing, and no procedures exist for you to read. Say so
  to the user once, then go on by the format rules alone — the first
  turn is then `draft_open` by itself.

`canvas_state` is needed only for a rework, an explanation, or placing
relative to existing content — then it joins that first turn beside the
bundle, and the rework's `draft_open` follows once the id is known. The
format rules come with the server's instructions on every connection —
do not read them again. The format file cites `src/core/types.ts` and
`src/core/content.ts` as the model; if the code and the file disagree,
**the repo wins** — report the drift. `knowledge_index` /
`knowledge_search` / `knowledge_read` are for more (reference files,
another example; paths are `<plugin id>/<file>`), not for Step 0.

Without an MCP server: read `knowledge/format.md` and, from an enabled
plugin's knowledge folder (`~/.daydream/plugins/<id>/knowledge/`, or the
served project's `.daydream/plugins/<id>/knowledge/`), its procedures and
one example in the neighborhood of the task.

### Step 1 — Gather the source, by mode

- **Transcribe.** Fetch the article or snippet. Identify the declarations
  that carry the lesson and the minimum structure that makes them work;
  strip decoration. How many viewports the source becomes is `format.md`'s
  call (its authoring guidance) — apply it, do not decide it here; each
  is its own draft. Several unrelated techniques: ask which, unless the
  user said "all of it". Keep the source's conditions verbatim, record
  the URL as `sourceUrl`, and skip `canvas_state` — the kernel picks
  free space for the draft.
- **From intent.** No source, no `sourceUrl`, no `canvas_state`. Pick the
  smallest document in which the idea is manipulable: which knob is the
  point, what to drag first, what should visibly break. Tell the user in
  your final reply, not in the document.
- **Paper → Daydream.** Read the design through Paper's MCP, never off a
  screenshot: `get_guide({topic: "paper-mcp-instructions"})` once per
  session, then `get_basic_info`, `get_selection`, `find_nodes` /
  `get_tree_summary`, and `get_node_info` + `get_computed_styles` (or
  `get_jsx`) for exact values; resolve `get_tokens` to real CSS — .dream has
  no variables layer. Translate, don't transfer: absolute canvas positions
  become real grid/flex with the same visual result, the artboard width
  becomes `frame.width`. Name the Paper file in the viewport `title`.
- **Rework.** `canvas_state` (same turn as the bundle) for the viewport
  ids, titles and the selection; then `draft_open {from: id}` for the one
  to change — its answer is that viewport's complete document, ids
  included, so `get_viewport` is not needed, and from then until Step 3
  the canvas displays your draft where that viewport stood. Change only
  what was asked; keep the rest verbatim, ids included.
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
card, the row that holds the cards, the footer — each under its parent id
(`before` a sibling when it belongs ahead of one); never the whole page
in one call, and no group before the procedures (when you have them)
have judged it. The
answer lists the ids the kernel minted for the subtree: use those as the
parents of what comes next. Root-level things — frame, meta, fonts, the
root's style map (sent whole, never merged) — go through `draft_set`. In
a rework, `draft_replace {target}` swaps the subtree you were asked to
change, `draft_append` inserts what is missing, `draft_remove` deletes
what goes — and everything else stays as pulled. A call the kernel refuses
with a finding (a bad element, an id already used) is repaired and sent
again; the gates do not judge the draft until Step 3.

### Step 3 — Finalize (the gates run there)

When the draft is complete, `draft_finalize {draft}` — always: a draft is
on the canvas only as a draft until then, and nothing else lands it. Its
answer is what you report from. Everything about a landing — refusals and
severities, the report it answers with, when `measure` or `lint` is worth
a call — is in the server's instructions, as they say it, not here. After
the format gate, the enabled plugins' gates judge the finalize; each
plugin's own section of the server's instructions says what its gates
look for. A refusal changes nothing in the draft: repair what the
findings name (`draft_replace` on those elements) and call
`draft_finalize` once more. No plugin gate runs without the canvas open
in a browser (`canvas_url`) — open it there if it is not. Reference media
(images, videos) still land through `ingest`, one item per call, each as
it is ready — beside the draft, never inside it.

### Step 4 — Land without the MCP server

- **A host running:** find it — `curl -s --max-time 2
http://127.0.0.1:37326/api/ping` (an installed Daydream; a checkout's dev
  host answers on `localhost:5173`, or read `.daydream/host.json`) answers
  `{"modules":[…,"agent"]}` — then `curl -s -X POST
http://127.0.0.1:<port>/api/ingest -H 'content-type: application/json'
-d '{"dream": …, "position"?: {"x","y"}}'`:
  `200 {"landed":true,"report":…,"text":…}` is on the canvas, with the
  same measure report; `422 {"landed":false,"findings"}` is the same
  refusal as the tool — fix every finding and POST again; `503` means no
  canvas tab is connected — open the app and retry.
- **No host at all:** write `library/<slug>.dream` (pretty JSON; slug
  `[A-Za-z0-9_-]`, 64 chars max, from the technique's name). Positions are
  honored here. Tell the user the path: a brand-new file is opened through
  "Open…" or by starting the host and landing it live.

A live landing appends to the open document (one undo step), remaps every
id, re-places every viewport and drops canvas-level meta; the open document
autosaves, so do not also write the file.

### Step 5 — Report

Technique captured, how many viewports, what to drag or change first, how it
landed (finalize, curl or file path) and what the landing's measure report
says about it, any fidelity compromises (stripped decoration, unsupported
features, source ambiguities), and any drift found in Step 0.
<!-- workflow:end -->

## Degraded inputs

- Article paywalled or unfetchable: say so, ask for a paste.
- Paper MCP unavailable or the file not open: say so; never guess values
  from a screenshot.
- The technique depends on runtime behavior Daydream cannot show (JS-driven
  layout, scroll-driven animation): transcribe the static skeleton and say
  what is lost in your reply.
- No canvas connected and no host: land as a file and say why.
