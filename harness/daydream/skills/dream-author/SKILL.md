---
name: dream-author
description: Author a playable .dream document for Daydream and land it on the user's canvas, or refine and rework a viewport already on the canvas. Use whenever the user shares layout source material (a URL, article, or CSS snippet), asks to transcribe or replicate a technique into their library, names a pattern to play with ("Holy Grail layout", "RAM pattern"), asks for a layout playground built from scratch ("make me a three-column grid to poke at"), wants a design they have open in Paper turned into something editable, asks to change, fix or rework a viewport that is already open, or asks to have a viewport on the canvas explained ("what makes this layout work?") — even if they don't say ".dream" or "Daydream".
---

# dream-author

This skill is a POINTER. The workflow, the layout procedures and the format
rules reach you over MCP, from the Daydream server and its css-author
plugin (decisions.md #48) — nothing is restated here.

## Check first

Look at your tool list for the Daydream server (usually `daydream`). You
need BOTH:

- the knowledge tools — `knowledge_bundle`, `knowledge_index`,
  `knowledge_read`, `knowledge_search`: core's facility, listed whenever an
  enabled plugin declares a knowledge folder; here they serve css-author's
  corpus — and
- the `dream-author` prompt (or, where prompts are hidden, the resource
  `plugin://daydream.css-author/procedures.md`).

If the Daydream tools are not listed at all: the MCP server is not
connected — STOP and tell the user. Installed Daydream: start the host
(`daydream`, or `brew services start daydream`) and register it with this
harness (`daydream connect`), then reconnect. A Daydream checkout: the
project's `.mcp.json` / `.cursor/mcp.json` / `.codex/config.toml` name
the dev host (`daydream-dev`); `pnpm dev` starts it. Do not author a
document from memory.

If the core tools are listed but the knowledge tools and the prompt are
not: the `daydream.css-author` plugin is not enabled — STOP and tell the
user to enable it (`"daydream.css-author"` under `enabled` in the served
root's `.daydream/plugins.json` — `~/Daydream/` for an installed
Daydream) and reconnect. Without it nothing judges a landing beyond the
format gate, and the procedures that prevent the usual mistakes are not
in your context.

## First, the frame

One thing before the prompt, because it must come before everything:
call `draft_open` first — frame, `title`, the `html › body` root with
its page background — so the user's canvas shows the frame within
seconds. The prompt says the rest.

## Then

Invoke the `dream-author` prompt (pass the user's intent as `intent`) and
follow it beside the server's instructions: the prompt carries the layout
procedures and the whole author → land → fix workflow, the instructions
the .dream format rules and the tool discipline. Nothing here adds to
either.
