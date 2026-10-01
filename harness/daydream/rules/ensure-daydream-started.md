---
description: Guidelines for using the Daydream MCP server
---

Before using any Daydream MCP tool, ensure Daydream is running on the user's machine: the Daydream app open (it runs the host, and its window is the canvas), or the host alone (`daydream`, or `brew services start daydream` to keep it running). If a connection to the Daydream MCP server fails, tell the user to open the Daydream app first, or to install it: the app's DMG, or `brew install martinbavio/daydream/daydream` (Homebrew asks to trust the tap the first time; `brew trust martinbavio/daydream` answers it). The canvas must be open for the canvas tools to answer: with the app open it is; otherwise call `canvas_url` and open it in a browser pane.
