export const MANIFEST_VERSION = 1 as const;

export const PLATFORM_IDS = [
  "darwin-arm64",
  "darwin-x64",
  "windows-x64",
  "windows-arm64",
  "linux-x64",
  "linux-arm64",
] as const;

export type PlatformId = (typeof PLATFORM_IDS)[number];
export type TrustTier = "system" | "verified" | "local";
export type EntryKind = "worker" | "process" | "ui" | "migration";
export type UiMode = "declarative" | "sandbox" | "trusted-react";
export type ActivationEventType =
  | "onView"
  | "onCommand"
  | "onEngine"
  | "onWorkspace"
  | "onSettings"
  | "onStartup";

export const ENTRY_KINDS: readonly EntryKind[] = [
  "worker",
  "process",
  "ui",
  "migration",
];

export const ACTIVATION_EVENT_TYPES: readonly ActivationEventType[] = [
  "onView",
  "onCommand",
  "onEngine",
  "onWorkspace",
  "onSettings",
  "onStartup",
];

export const MOSSX_CAPABILITIES = [
  "mossx.workspace.read",
  "mossx.workspace.write",
  "mossx.git.read",
  "mossx.git.write",
  "mossx.network.fetch",
  "mossx.process.spawn",
  "mossx.storage.readwrite",
  "mossx.notifications.publish",
  "mossx.engine.provider",
  "mossx.search.provider",
  "mossx.context.provider",
  "mossx.command",
  "mossx.tool",
  "mossx.ui.view",
  "mossx.ui.panel",
  "mossx.ui.slot.workspace.main",
  "mossx.ui.slot.workspace.rightPanel",
  "mossx.ui.slot.sidebar.secondary",
  "mossx.ui.slot.composer.toolbar",
  "mossx.ui.slot.conversation.attachmentRenderer",
  "mossx.ui.slot.settings.plugin",
  "mossx.ui.slot.status.lowFrequency",
  "mossx.settings.page",
  "mossx.status.item",
] as const;

export const EXACT_CONTRIBUTION_TYPES = [
  "mossx.ui.view",
  "mossx.ui.panel",
  "mossx.command",
  "mossx.engine.provider",
  "mossx.settings.page",
] as const;

export const TEMPLATE_ELIGIBLE_TYPES = [
  "mossx.tool",
  "mossx.search.provider",
  "mossx.context.provider",
  "mossx.status.item",
] as const;

export const PLUGIN_ID_RE =
  /^[a-z][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*){1,15}$/;
export const ENTRY_ID_RE = /^[a-z][a-z0-9-]{0,63}$/;
export const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.(0|[1-9]\d*))?$/;
