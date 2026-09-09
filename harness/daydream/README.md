# Daydream

Design tool for the web where real HTML/CSS is the grain. This plugin connects your agent harness to the Daydream host running on your machine: its MCP tools (see, land, arrange, draft) and the `dream-author` skill.

## Prerequisites

Daydream must be installed and running:

```
brew tap martinbavio/daydream https://github.com/martinbavio/daydream-public
brew install daydream
```

then `daydream` (or `brew services start daydream` to keep it running across logins). It serves `~/Daydream` on `127.0.0.1:37326`. The canvas must be open in a browser pane for the landing tools to answer; the agent gets the URL from `canvas_url`.

## Install

- Claude Code: `claude plugin marketplace add martinbavio/daydream-public` then `claude plugin install daydream@daydream`
- Codex: `codex plugin marketplace add martinbavio/daydream-public` then `codex plugin add daydream@daydream`
- Cursor: through its marketplace once published; until then `daydream connect`
- Or, instead of the plugin: `daydream connect` registers the host with every harness on this machine and links the skill. One or the other per harness — both would register the same server twice. `connect` is also the one way to register a host started with `--token`, since this plugin's `mcp.json` is a static copy and cannot carry a secret.

## What you get

The sixteen core tools (`canvas_url`, `canvas_state`, `get_viewport`, `replace_viewport`, `ingest`, `measure`, `lint`, `update_item`, `remove_item` and the seven `draft_*` tools), every tool the enabled plugins add, the knowledge tools when a plugin serves a corpus, and the `dream-author` skill: how to author a `.dream` document and land it, or rework a viewport already on the canvas.
