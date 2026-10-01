# Daydream

Design tool for the web where real HTML/CSS is the grain. This plugin connects your agent harness to the Daydream host running on your machine: its MCP tools (see, arrange, draft, measure, lint) and the `dream-author` skill.

## Prerequisites

Daydream must be installed and running:

```
brew install martinbavio/daydream/daydream
```

(Homebrew asks to trust the tap the first time; answer yes, or run `brew trust martinbavio/daydream` beforehand.)

then `daydream` (or `brew services start daydream` to keep it running across logins). It serves on `127.0.0.1:37326`, with the last project you opened open again (`daydream <folder>` opens a folder; a click on the Daydream mark picks one). The canvas must be open in a browser pane for the canvas tools to answer; the agent gets the URL from `canvas_url`.

## Install

- Claude Code: `claude plugin marketplace add martinbavio/daydream-public` then `claude plugin install daydream@daydream`
- Codex: `codex plugin marketplace add martinbavio/daydream-public` then `codex plugin add daydream@daydream`
- Cursor: through its marketplace once published; until then `daydream connect`
- Or, instead of the plugin: `daydream connect` registers the host with every harness on this machine it knows (Claude Code, Codex, Cursor, OpenCode, Pi, VS Code) and links the skill. One or the other per harness — both would register the same server twice. `connect` is also the one way to register a host started with `--token`, since this plugin's `mcp.json` is a static copy and cannot carry a secret.
- Any other agent that can run shell commands: `daydream tool` lists Daydream's tools and `daydream tool <name> key=value …` calls one; the dream-author skill tells it how. An agent that speaks MCP can also be pointed at `http://127.0.0.1:37326/mcp` by hand.

## What you get

The seventeen core tools (`canvas_url`, `canvas_state`, `instructions`, `get_viewport`, `measure`, `lint`, `update_item`, `remove_item`, the eight `draft_*` tools and `resolve_variant`), every tool the enabled plugins add, the knowledge tools when a plugin serves a corpus, and the `dream-author` skill: how to author a page of the open project, or rework a viewport already on the canvas.
