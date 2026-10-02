# Daydream

A design tool for the web where real HTML/CSS is the grain: a canvas of viewports your agent reads, builds and reworks through MCP. The host runs on your machine; nothing leaves it.

This repository is Daydream's public face: the releases, the Homebrew formula and the agent-harness plugin. The source lives elsewhere.

## Install

```
brew install martinbavio/daydream/daydream
```

Homebrew asks to trust the tap the first time; answer yes (or run `brew trust martinbavio/daydream` beforehand).

Then open a project with `daydream <folder>`: a project is any folder of html files, opened in place, and `daydream` alone reopens the last one. Keep the host running across logins with `brew services start daydream`. It listens on `127.0.0.1:37326`. Upgrades: `daydream update` (it runs brew for you and restarts the service).

### The Mac app

Each release also carries the app, `Daydream-<version>.dmg` (Apple silicon, macOS 13.5 or later): the same host in a window of its own. It is not yet signed with a Developer ID, so the first time it opens macOS asks you to allow it in System Settings > Privacy & Security. It asks once whether to check for new versions by itself, and offers each one when it is out.

### Logs

The Homebrew service logs to `$(brew --prefix)/var/log/daydream.log`; the app's host logs to `~/Library/Logs/Daydream/host.log`.

## Connect your agent

`daydream connect` registers the host with every agent harness on this machine it knows — Claude Code, Codex, Cursor, OpenCode, Pi, VS Code — and links the `dream-author` skill. Any other agent with a shell reaches the same tools as commands: `daydream tool` lists them. Or install the plugin through a harness's own marketplace:

- Claude Code: `claude plugin marketplace add martinbavio/daydream-public` then `claude plugin install daydream@daydream`
- Codex: `codex plugin marketplace add martinbavio/daydream-public` then `codex plugin add daydream@daydream`

The canvas must be open in a browser pane for the tools to answer; the agent gets the URL from `canvas_url`.
