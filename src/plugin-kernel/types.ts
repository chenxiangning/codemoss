import type {
  ActivationEventType,
  EntryKind,
  PlatformId,
  TrustTier,
  UiMode,
} from "./catalog";

export type ManifestErrorCode =
  | "invalid-json"
  | "unknown-field"
  | "unsupported-manifest-version"
  | "invalid-plugin-id"
  | "invalid-semver"
  | "invalid-channel"
  | "unbounded-core-api"
  | "unknown-kind"
  | "unknown-event"
  | "unknown-capability"
  | "dangling-entry-id"
  | "cyclic-depends-on"
  | "migration-in-unit"
  | "on-startup-not-allowlisted"
  | "trusted-react-not-system"
  | "template-type-forbidden"
  | "template-key-prefix"
  | "template-overlap"
  | "foreign-private-capability"
  | "missing-platform"
  | "invalid-budget"
  | "invalid-storage"
  | "hash-conflict"
  | "schema";

export interface ManifestError {
  code: ManifestErrorCode;
  path: string;
  message: string;
}

export interface ParseManifestOptions {
  trustTier: TrustTier;
  currentPlatform: PlatformId;
  coreContract: string;
  startupAllowlist: string[];
  artifactHash?: string;
  knownHashes?: Record<string, string>;
}

export interface ManifestDependsOn {
  entryId: string;
  criticality: "required" | "optional";
}

export interface ManifestEntry {
  id: string;
  kind: EntryKind;
  criticality: "required" | "optional";
  dependsOn: ManifestDependsOn[];
  path?: string;
  runtime?: "quickjs";
  platforms?: Partial<Record<PlatformId, string>>;
  mode?: UiMode;
  slot?: string;
  trustedReact?: boolean;
  fromSchema?: number;
  toSchema?: number;
  destructive?: boolean;
}

export interface ManifestActivationEvent {
  type: ActivationEventType;
  viewId?: string;
  commandId?: string;
  engineId?: string;
  reason?: "open" | "grant";
  pageId?: string;
}

export interface ManifestActivationUnit {
  id: string;
  entries: string[];
  events: ManifestActivationEvent[];
}

export interface ManifestContribution {
  id: string;
  type: string;
  entryId: string;
  slot?: string;
  mode?: UiMode;
  commandId?: string;
  engineId?: string;
}

export interface ManifestTemplate {
  id: string;
  type: string;
  entryId: string;
  keyPrefix: string;
  scopes: string[];
  maxInstances: number;
}

export interface ManifestCapability {
  id: string;
  role: "provider" | "consumer";
  scopes?: string[];
}

export interface ValidatedManifest {
  pluginId: string;
  version: string;
  manifestVersion: 1;
  channel: "stable" | "beta";
  displayName?: string;
  entries: ManifestEntry[];
  activationUnits: ManifestActivationUnit[];
  contributions: ManifestContribution[];
  contributionTemplates: ManifestTemplate[];
  capabilities: ManifestCapability[];
  requiredClosureByUnit: Record<string, string[]>;
}

export interface ParseManifestResult {
  ok: boolean;
  manifest?: ValidatedManifest;
  errors: ManifestError[];
}
