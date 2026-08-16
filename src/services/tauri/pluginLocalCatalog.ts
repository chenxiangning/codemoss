export type LocalCatalogPackage = {
  pluginId: string;
  displayName: string;
  packageDir: string;
  ownerClass: "pilot" | "later-plugin";
  kind: "engine" | "feature";
  installed: false;
  remote: false;
};

type CatalogSeed = {
  pluginId: string;
  displayName: string;
  packageDir: string;
  ownerClass: "pilot" | "later-plugin";
  kind: "engine" | "feature";
};

const CATALOG_SEEDS: CatalogSeed[] = [
  {
    pluginId: "com.mossx.engine.claude",
    displayName: "Claude Engine",
    packageDir: "packages/plugin-engine-claude",
    ownerClass: "pilot",
    kind: "engine",
  },
  {
    pluginId: "com.mossx.notes",
    displayName: "Notes",
    packageDir: "packages/plugin-notes",
    ownerClass: "pilot",
    kind: "feature",
  },
  {
    pluginId: "com.mossx.kanban",
    displayName: "Kanban",
    packageDir: "packages/plugin-kanban",
    ownerClass: "later-plugin",
    kind: "feature",
  },
  {
    pluginId: "com.mossx.project-map",
    displayName: "Project Map",
    packageDir: "packages/plugin-project-map",
    ownerClass: "later-plugin",
    kind: "feature",
  },
  {
    pluginId: "com.mossx.browser",
    displayName: "Browser",
    packageDir: "packages/plugin-browser",
    ownerClass: "later-plugin",
    kind: "feature",
  },
  {
    pluginId: "com.mossx.intent-canvas",
    displayName: "Intent Canvas",
    packageDir: "packages/plugin-intent-canvas",
    ownerClass: "later-plugin",
    kind: "feature",
  },
  {
    pluginId: "com.mossx.engine.codex",
    displayName: "Codex Engine",
    packageDir: "packages/plugin-engine-codex",
    ownerClass: "later-plugin",
    kind: "engine",
  },
  {
    pluginId: "com.mossx.engine.gemini",
    displayName: "Gemini Engine",
    packageDir: "packages/plugin-engine-gemini",
    ownerClass: "later-plugin",
    kind: "engine",
  },
  {
    pluginId: "com.mossx.engine.grok",
    displayName: "Grok Engine",
    packageDir: "packages/plugin-engine-grok",
    ownerClass: "later-plugin",
    kind: "engine",
  },
  {
    pluginId: "com.mossx.engine.kimi",
    displayName: "Kimi Engine",
    packageDir: "packages/plugin-engine-kimi",
    ownerClass: "later-plugin",
    kind: "engine",
  },
  {
    pluginId: "com.mossx.engine.opencode",
    displayName: "OpenCode Engine",
    packageDir: "packages/plugin-engine-opencode",
    ownerClass: "later-plugin",
    kind: "engine",
  },
  {
    pluginId: "com.mossx.engine.pi",
    displayName: "Pi Engine",
    packageDir: "packages/plugin-engine-pi",
    ownerClass: "later-plugin",
    kind: "engine",
  },
  { pluginId: "com.mossx.about", displayName: "About", packageDir: "packages/plugin-about", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.agent-catalog", displayName: "Agent Catalog", packageDir: "packages/plugin-agent-catalog", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.client-documentation", displayName: "Client Documentation", packageDir: "packages/plugin-client-documentation", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.client-ui-visibility", displayName: "Client Ui Visibility", packageDir: "packages/plugin-client-ui-visibility", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.code-annotations", displayName: "Code Annotations", packageDir: "packages/plugin-code-annotations", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.collaboration", displayName: "Collaboration", packageDir: "packages/plugin-collaboration", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.commands", displayName: "Commands", packageDir: "packages/plugin-commands", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.computer-use", displayName: "Computer Use", packageDir: "packages/plugin-computer-use", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.context-ledger", displayName: "Context Ledger", packageDir: "packages/plugin-context-ledger", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.debug", displayName: "Debug", packageDir: "packages/plugin-debug", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.dictation", displayName: "Dictation", packageDir: "packages/plugin-dictation", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.email", displayName: "Email", packageDir: "packages/plugin-email", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.git-history", displayName: "Git History", packageDir: "packages/plugin-git-history", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.governance", displayName: "Governance", packageDir: "packages/plugin-governance", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.live-edit-preview", displayName: "Live Edit Preview", packageDir: "packages/plugin-live-edit-preview", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.models", displayName: "Models", packageDir: "packages/plugin-models", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.multi-agent", displayName: "Multi Agent", packageDir: "packages/plugin-multi-agent", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.operation-facts", displayName: "Operation Facts", packageDir: "packages/plugin-operation-facts", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.plan", displayName: "Plan", packageDir: "packages/plugin-plan", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.prompt-distill", displayName: "Prompt Distill", packageDir: "packages/plugin-prompt-distill", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.prompts", displayName: "Prompts", packageDir: "packages/plugin-prompts", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.quick-switcher", displayName: "Quick Switcher", packageDir: "packages/plugin-quick-switcher", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.runtime-log", displayName: "Runtime Log", packageDir: "packages/plugin-runtime-log", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.shared", displayName: "Shared", packageDir: "packages/plugin-shared", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.shared-session", displayName: "Shared Session", packageDir: "packages/plugin-shared-session", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.skills", displayName: "Skills", packageDir: "packages/plugin-skills", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.spec", displayName: "Spec", packageDir: "packages/plugin-spec", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.status", displayName: "Status", packageDir: "packages/plugin-status", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.subagent-ui", displayName: "Subagent Ui", packageDir: "packages/plugin-subagent-ui", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.tasks", displayName: "Tasks", packageDir: "packages/plugin-tasks", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.terminal", displayName: "Terminal", packageDir: "packages/plugin-terminal", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.vendors", displayName: "Vendors", packageDir: "packages/plugin-vendors", ownerClass: "later-plugin", kind: "feature" },
  { pluginId: "com.mossx.web-service", displayName: "Web Service", packageDir: "packages/plugin-web-service", ownerClass: "later-plugin", kind: "feature" },
];

export const LOCAL_PLUGIN_CATALOG: LocalCatalogPackage[] = CATALOG_SEEDS.map((item) => ({
  ...item,
  installed: false,
  remote: false,
}));

export function listLocalPluginCatalog(): LocalCatalogPackage[] {
  return LOCAL_PLUGIN_CATALOG;
}
