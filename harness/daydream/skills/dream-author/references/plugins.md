# Writing a Daydream plugin

Read this when the user wants Daydream itself to do something new: a panel,
something drawn over the canvas, a new kind of canvas item, a check on
their pages, a tool or command of their own. A page of their project is
not a plugin; that is the workflow in SKILL.md.

A plugin is a folder of TypeScript the user's own Daydream loads. It is
trusted, in-process code with no sandbox, so what you write runs with the
user's own permissions. Say what it does before you install it.

## What is in this folder

Paths are relative to this file.

- `plugin-authoring.md`: the whole contract. Read §1 to §5 before writing,
  and §9 before installing. Where a rule is enforced, it gives the exact
  message.
- `plugin-api/*.ts`: the API's types, with their comments. `index.ts` is
  the main one. They are the authority: when this guide and the types
  disagree, the types are right.
- `example/`: a worked plugin using a panel, an overlay, a command with a
  shortcut, a hook and storage.
- `plugin-template/`: a plugin that builds as it is. Start from it.

## The loop

1. Pick the extension point: a panel (`registerPanel`), an overlay
   (`registerOverlay`), a canvas item kind, a gate (`lint`), a command
   or shortcut, an MCP tool for agents (`registerTool`, or a host part,
   `bridge.ts`). `plugin-authoring.md` §4 lists them all. If the need
   fits none, say so.
2. Make the folder anywhere the user keeps code, named for its id,
   `<author>.<name>` (the `daydream.` prefix is Daydream's own), by copying
   `plugin-template/`. Change the `id` in `manifest.json` and the name in
   `package.json`.
3. Write it. Declare everything it contributes under `contributes` in the
   manifest. Set `api` to the plugin API version of the newest member
   you use (`plugin-authoring.md` §9; `"1.3"` while writing this).
4. Build it: `npm install`, then `npm run build`. This writes
   `dist/index.js`, which the installed Daydream serves, since it has no
   compiler. The host part (`bridge.ts`) needs no build.
5. Tell the user what the plugin will do and what the manifest declares,
   then run `daydream plugin install <folder>`. It links the folder into
   `~/.daydream/plugins/<id>`, records the user's trust and leaves the
   plugin off. The user turns it on from the plugins page (⌥⌘P), or you
   install with `--enable` once they have said so. After a change, build
   and install again: the hash changed, so trust is recorded again, and
   the running Daydream picks it up.
6. Check it on the canvas (`canvas_url`). The plugin's panel or overlay
   should be there with a project open and something selected. If the
   plugins page shows it grey, the line under it says why (an `api` newer
   than this Daydream's, a manifest problem, trust).

## What the types cannot tell you

- This is Solid 2.0, not React and not Solid 1.x. `createEffect` takes a
  compute function and an apply function; read the DOM in apply, and do
  not write a signal inside the plugin's synchronous prefix (the code
  before the first `await` in `activate`).
- A plugin imports only `@daydream/plugin-api` (types, erased by the
  build), `solid-js` and `@solidjs/web`, plus its own files and
  dependencies. It never imports Daydream's source, and it reaches the
  app only through `dd`.
- CSS is a string handed to the registration's `styles` option, with class
  names prefixed from `dd.plugin.id`. A `<style>` element of its own is
  unlayered, and Daydream disables it.
- Every command id, resource and overlay it registers is namespaced by its
  own id and declared in the manifest.
- State that must outlive the page goes through `dd.storage`.
- Writes to the user's project go through the API (`dd.writePage`,
  `dd.beginItemTransaction`), never by editing their files from the
  plugin.
- `@daydream/plugin-testing`, which the plugin authoring doc describes
  for tests, only exists inside Daydream's own checkout. Without it,
  verify on the canvas.

## Trust is the user's

Never edit `trusted` in `~/.daydream/plugins.json` yourself, and never
install a plugin the user has not seen described. A project's own
`.daydream/plugins.json` can turn a plugin on but cannot trust one.
