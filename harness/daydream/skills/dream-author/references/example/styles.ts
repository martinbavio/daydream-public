// The plugin's CSS as a string (decision #48: plugins ship no CSS
// files — runtime loading serves a folder, not a bundler's graph). Handed
// to `registerPanel` and `registerOverlay` as `styles` (index.tsx): the
// kernel mounts it once per root, inside the dream-plugin layer (decision
// #71); it can never restyle a document, which renders in its own shadow
// root (decision #76). Class names carry a prefix DERIVED from
// `dd.plugin.id` (`daydream.example` → `daydream-example-…`), so a copy of
// this folder under another id styles its own nodes and never this one's.

/** The class prefix for a plugin id: dots (and anything else a class name
 * cannot carry) become dashes. */
export const classPrefix = (pluginId: string): string =>
  pluginId.replace(/[^A-Za-z0-9_-]/g, "-");

export const css = (p: string): string => `
.${p}-panel {
  padding: 6px 14px 12px;
  font-size: 11px;
  line-height: 1.55;
  color: #85858c;
}

.${p}-tag {
  color: #b8b8c0;
  font-weight: 600;
}

.${p}-toggle {
  margin-top: 8px;
  padding: 2px 8px;
  font: inherit;
  color: #b8b8c0;
  background: #26262b;
  border: 1px solid #3a3a41;
  border-radius: 4px;
  cursor: pointer;
}

/* Screen space (overlay.screen): the badge sits at the selection's
   top-left in canvas px and stays the same size at any zoom. */
.${p}-badge {
  position: absolute;
  transform: translateY(-100%);
  padding: 1px 5px;
  font-size: 10px;
  line-height: 1.4;
  color: #0d0d10;
  background: #4c9aff;
  border-radius: 3px;
  white-space: nowrap;
}
`;
