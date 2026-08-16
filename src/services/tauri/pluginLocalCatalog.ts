export type LocalCatalogPackage = {
  pluginId: string;
  displayName: string;
  packageDir: string;
  ownerClass: "pilot" | "later-plugin";
  kind: "engine" | "feature";
  installed: false;
  remote: false;
};

export const LOCAL_PLUGIN_CATALOG: LocalCatalogPackage[] = [
  {
    pluginId: "com.mossx.engine.claude",
    displayName: "Claude Engine",
    packageDir: "packages/plugin-engine-claude",
    ownerClass: "pilot",
    kind: "engine",
    installed: false,
    remote: false,
  },
  {
    pluginId: "com.mossx.notes",
    displayName: "Notes",
    packageDir: "packages/plugin-notes",
    ownerClass: "pilot",
    kind: "feature",
    installed: false,
    remote: false,
  },
  {
    pluginId: "com.mossx.kanban",
    displayName: "Kanban",
    packageDir: "packages/plugin-kanban",
    ownerClass: "later-plugin",
    kind: "feature",
    installed: false,
    remote: false,
  },
  {
    pluginId: "com.mossx.project-map",
    displayName: "Project Map",
    packageDir: "packages/plugin-project-map",
    ownerClass: "later-plugin",
    kind: "feature",
    installed: false,
    remote: false,
  },
  {
    pluginId: "com.mossx.browser",
    displayName: "Browser",
    packageDir: "packages/plugin-browser",
    ownerClass: "later-plugin",
    kind: "feature",
    installed: false,
    remote: false,
  },
  {
    pluginId: "com.mossx.intent-canvas",
    displayName: "Intent Canvas",
    packageDir: "packages/plugin-intent-canvas",
    ownerClass: "later-plugin",
    kind: "feature",
    installed: false,
    remote: false,
  },
  {
    pluginId: "com.mossx.engine.codex",
    displayName: "Codex Engine",
    packageDir: "packages/plugin-engine-codex",
    ownerClass: "later-plugin",
    kind: "engine",
    installed: false,
    remote: false,
  },
  {
    pluginId: "com.mossx.engine.gemini",
    displayName: "Gemini Engine",
    packageDir: "packages/plugin-engine-gemini",
    ownerClass: "later-plugin",
    kind: "engine",
    installed: false,
    remote: false,
  },
  {
    pluginId: "com.mossx.engine.grok",
    displayName: "Grok Engine",
    packageDir: "packages/plugin-engine-grok",
    ownerClass: "later-plugin",
    kind: "engine",
    installed: false,
    remote: false,
  },
  {
    pluginId: "com.mossx.engine.kimi",
    displayName: "Kimi Engine",
    packageDir: "packages/plugin-engine-kimi",
    ownerClass: "later-plugin",
    kind: "engine",
    installed: false,
    remote: false,
  },
  {
    pluginId: "com.mossx.engine.opencode",
    displayName: "OpenCode Engine",
    packageDir: "packages/plugin-engine-opencode",
    ownerClass: "later-plugin",
    kind: "engine",
    installed: false,
    remote: false,
  },
  {
    pluginId: "com.mossx.engine.pi",
    displayName: "Pi Engine",
    packageDir: "packages/plugin-engine-pi",
    ownerClass: "later-plugin",
    kind: "engine",
    installed: false,
    remote: false,
  },
];

export function listLocalPluginCatalog(): LocalCatalogPackage[] {
  return LOCAL_PLUGIN_CATALOG;
}
