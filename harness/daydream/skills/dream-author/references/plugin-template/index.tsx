// acme.template — the smallest plugin that builds and runs: one panel
// that names the selected element. Rename the folder, the manifest's `id`
// and the `package.json` name, then replace the panel.
//
// Read references/plugin-authoring.md (§3, §4, §5) before adding to it:
// this is Solid 2.0, where `createEffect` takes TWO functions (compute,
// then apply) and a reactive WRITE inside a plugin's synchronous prefix is
// refused.

import type { DaydreamApi } from "@daydream/plugin-api";

export default function activate(dd: DaydreamApi): void {
  dd.registerPanel({
    id: "selection",
    title: "Selection",
    render: () => <p>{dd.selection() ?? "Nothing selected"}</p>,
  });
}
