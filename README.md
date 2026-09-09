# Daydream

A design tool for the web where real HTML/CSS is the grain: a canvas of viewports your agent reads, lands into and reworks through MCP. The host runs on your machine; nothing leaves it.

This repository is Daydream's public face: the releases, the Homebrew formula and the agent-harness plugin. The source lives elsewhere.

## Install

```
brew tap martinbavio/daydream https://github.com/martinbavio/daydream-public
brew install daydream
```

Then start the host once with `daydream`, or keep it running across logins with `brew services start daydream`. It serves `~/Daydream` on `127.0.0.1:37326`. Upgrades: `brew upgrade daydream`.

## Connect your agent

`daydream connect` registers the host with every agent harness on this machine — Claude Code, Codex, Cursor, VS Code — and links the `dream-author` skill. Or install the plugin through a harness's own marketplace:

- Claude Code: `claude plugin marketplace add martinbavio/daydream-public` then `claude plugin install daydream@daydream`
- Codex: `codex plugin marketplace add martinbavio/daydream-public` then `codex plugin add daydream@daydream`

The canvas must be open in a browser pane for the landing tools to answer; the agent gets the URL from `canvas_url`.
