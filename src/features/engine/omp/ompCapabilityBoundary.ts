import type {
  CustomCommandOption,
  CustomPromptOption,
  SkillOption,
} from "../../../types";

/** OMP manifest 中可声明但不会默认获得的宿主权限。 */
export type OmpManifestPermission =
  | "filesystem.read"
  | "filesystem.write"
  | "network"
  | "plugin.install"
  | "secret.access";

// 词汇与 design Decision 6 / OmpCapabilityState 对齐：degraded 表示协议有面但宿主无法完整投影。
export type OmpBoundaryState =
  | "supported"
  | "compat-input"
  | "unsupported"
  | "degraded"
  | "unknown";

export type OmpManifestKind = "skill" | "rule" | "extension" | "plugin";

export type OmpManifest = Readonly<{
  manifestVersion: 1;
  id: string;
  name: string;
  version: string;
  kind: OmpManifestKind;
  description?: string;
  entrypoint?: string;
  permissions: readonly OmpManifestPermission[];
}>;

export type OmpManifestScope = Readonly<{
  workspaceId: string;
  profileId: string;
}>;

/**
 * OMP extension 的 catalog 记录。现有 catalog 类型没有 extension 桶（11.3），
 * 这里做最小化定义；ui 标记是否声明 extension_ui_request 贡献。
 */
export type OmpExtensionOption = {
  name: string;
  path: string;
  description?: string;
  entrypoint?: string;
  ui?: boolean;
};

/** 复用现有 catalog discovery 记录，不为 OMP 复制一套 skill/rule 类型。 */
export type OmpDiscoveryEntry =
  | Readonly<{ kind: "skill"; item: SkillOption }>
  | Readonly<{
      kind: "rule";
      item: CustomPromptOption | CustomCommandOption;
    }>
  | Readonly<{ kind: "extension"; item: OmpExtensionOption }>;

export type OmpPermissionRecord = Readonly<{
  state: OmpBoundaryState;
  enabled: boolean;
  requiresApproval: boolean;
}>;

export type OmpPermissionProjection = Readonly<
  Record<OmpManifestPermission, OmpPermissionRecord>
>;

export type OmpManifestAudit = Readonly<{
  action: "manifest.project" | "manifest.enable" | "manifest.disable";
  manifestId: string;
  workspaceId: string;
  profileId: string;
  redactedSecrets: true;
}>;

export type OmpManifestProjection = Readonly<{
  scope: OmpManifestScope;
  manifest: OmpManifest;
  discovery: OmpDiscoveryEntry | null;
  state: "disabled" | "enabled";
  permissions: OmpPermissionProjection;
  audit: OmpManifestAudit;
}>;

export type OmpManifestValidation = Readonly<{
  valid: boolean;
  manifest: OmpManifest | null;
  errors: readonly string[];
}>;

const MANIFEST_ID_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/;
const MANIFEST_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const RELATIVE_ENTRYPOINT_PATTERN = /^[^/\\][^:]*$/;
const PERMISSIONS = [
  "filesystem.read",
  "filesystem.write",
  "network",
  "plugin.install",
  "secret.access",
] as const satisfies readonly OmpManifestPermission[];
const KINDS = ["skill", "rule", "extension", "plugin"] as const;

const isManifestPermission = (
  value: unknown,
): value is OmpManifestPermission =>
  typeof value === "string" &&
  (PERMISSIONS as readonly string[]).includes(value);

const isManifestKind = (value: unknown): value is OmpManifestKind =>
  typeof value === "string" && (KINDS as readonly string[]).includes(value);

const ownString = (value: Record<string, unknown>, key: string): string | null =>
  typeof value[key] === "string" ? value[key].trim() : null;

const isSafeRelativeEntrypoint = (value: string): boolean => {
  if (!RELATIVE_ENTRYPOINT_PATTERN.test(value)) {
    return false;
  }
  return !value.split(/[\/\\]/u).some((segment) => segment === "..");
};

/**
 * 只验证并规范化 metadata；这里不读取 manifest 文件，也不启动 OMP plugin runtime。
 */
export function validateOmpManifest(input: unknown): OmpManifestValidation {
  if (
    typeof input !== "object" ||
    input === null ||
    Array.isArray(input)
  ) {
    return { valid: false, manifest: null, errors: ["manifest must be an object"] };
  }
  const inputRecord = input as Record<string, unknown>;

  const errors: string[] = [];
  const id = ownString(inputRecord, "id");
  const name = ownString(inputRecord, "name");
  const version = ownString(inputRecord, "version");
  const kind = inputRecord.kind;
  const entrypoint = ownString(inputRecord, "entrypoint");
  const description = ownString(inputRecord, "description");
  const manifestVersion = inputRecord.manifestVersion ?? 1;

  if (!id || !MANIFEST_ID_PATTERN.test(id)) {
    errors.push("manifest id must be a lowercase identifier");
  }
  if (!name || name.length > 128) {
    errors.push("manifest name must be non-empty and at most 128 characters");
  }
  if (!version || !MANIFEST_VERSION_PATTERN.test(version)) {
    errors.push("manifest version must be semantic version x.y.z");
  }
  if (!isManifestKind(kind)) {
    errors.push("manifest kind is unsupported");
  }
  if (manifestVersion !== 1) {
    errors.push("manifest version must be 1");
  }
  if (entrypoint && !isSafeRelativeEntrypoint(entrypoint)) {
    errors.push("manifest entrypoint must be a relative path");
  }
  if (description && description.length > 512) {
    errors.push("manifest description is too long");
  }

  const rawPermissions = inputRecord.permissions ?? [];
  if (!Array.isArray(rawPermissions)) {
    errors.push("manifest permissions must be an array");
  }
  const permissions: OmpManifestPermission[] = [];
  if (Array.isArray(rawPermissions)) {
    for (const permission of rawPermissions) {
      if (!isManifestPermission(permission)) {
        errors.push(`manifest permission is unsupported: ${String(permission)}`);
      } else if (!permissions.includes(permission)) {
        permissions.push(permission);
      }
    }
  }

  if (errors.length > 0 || !id || !name || !version || !isManifestKind(kind)) {
    return { valid: false, manifest: null, errors };
  }

  return {
    valid: true,
    manifest: Object.freeze({
      manifestVersion: 1,
      id,
      name,
      version,
      kind,
      ...(description ? { description } : {}),
      ...(entrypoint ? { entrypoint } : {}),
      permissions: Object.freeze(permissions),
    }),
    errors: Object.freeze([]),
  };
}

const scopeOrNull = (scope: OmpManifestScope): OmpManifestScope | null => {
  const workspaceId = scope.workspaceId.trim();
  const profileId = scope.profileId.trim();
  return workspaceId && profileId
    ? Object.freeze({ workspaceId, profileId })
    : null;
};

const defaultPermission = (
  permission: OmpManifestPermission,
): OmpPermissionRecord =>
  Object.freeze({
    state: permission === "secret.access" ? "unsupported" : "unknown",
    enabled: false,
    requiresApproval: true,
  });

const defaultPermissions = (): OmpPermissionProjection =>
  Object.freeze(
    Object.fromEntries(
      PERMISSIONS.map((permission) => [permission, defaultPermission(permission)]),
    ) as OmpPermissionProjection,
  );

const audit = (
  action: OmpManifestAudit["action"],
  manifest: OmpManifest,
  scope: OmpManifestScope,
): OmpManifestAudit =>
  Object.freeze({
    action,
    manifestId: manifest.id,
    workspaceId: scope.workspaceId,
    profileId: scope.profileId,
    redactedSecrets: true,
  });

/** 无效 manifest、无效 scope 或 discovery 与 manifest kind 不一致一律不产生 projection。 */
export function projectOmpManifest(
  input: unknown,
  scope: OmpManifestScope,
  discovery: OmpDiscoveryEntry | null = null,
): OmpManifestProjection | null {
  const validation = validateOmpManifest(input);
  const normalizedScope = scopeOrNull(scope);
  if (!validation.valid || !validation.manifest || !normalizedScope) {
    return null;
  }
  if (discovery && discovery.kind !== validation.manifest.kind) {
    return null;
  }
  return Object.freeze({
    scope: normalizedScope,
    manifest: validation.manifest,
    discovery,
    state: "disabled",
    permissions: defaultPermissions(),
    audit: audit("manifest.project", validation.manifest, normalizedScope),
  });
}

/**
 * 仅允许 manifest 自己声明且用户明确批准的非 secret 权限；plugin install 永远不在此边界内执行。
 */
export function enableOmpManifest(
  projection: OmpManifestProjection,
  approvedPermissions: readonly OmpManifestPermission[],
): OmpManifestProjection {
  const declared = new Set(projection.manifest.permissions);
  const approved = new Set(approvedPermissions);
  const permissions = Object.fromEntries(
    PERMISSIONS.map((permission) => {
      const allowed =
        declared.has(permission) &&
        approved.has(permission) &&
        permission !== "secret.access" &&
        permission !== "plugin.install";
      return [
        permission,
        Object.freeze({
          state: allowed ? "supported" : defaultPermission(permission).state,
          enabled: allowed,
          requiresApproval: !allowed,
        }),
      ];
    }),
  ) as OmpPermissionProjection;

  return Object.freeze({
    ...projection,
    state: "enabled",
    permissions: Object.freeze(permissions),
    audit: audit("manifest.enable", projection.manifest, projection.scope),
  });
}

/** 禁用是完整 rollback：清除所有 grants，且 secret/plugin install 仍不可用。 */
export function disableOmpManifest(
  projection: OmpManifestProjection,
): OmpManifestProjection {
  return Object.freeze({
    ...projection,
    state: "disabled",
    permissions: defaultPermissions(),
    audit: audit("manifest.disable", projection.manifest, projection.scope),
  });
}

export function isOmpManifestPermissionEnabled(
  projection: OmpManifestProjection,
  permission: OmpManifestPermission,
): boolean {
  return projection.permissions[permission].enabled;
}

/** 宿主形态：desktop WebView 有 UI surface；headless（ACP/RPC 无 UI）没有。 */
export type OmpHostUiMode = "desktop-webview" | "headless";

export type OmpExtensionUiPolicy = Readonly<{
  state: OmpBoundaryState;
  enabled: boolean;
  rationale: string;
}>;

/**
 * extension UI 能力投影（11.3）。
 * headless 宿主收到 extension_ui_request 也无法渲染 → 显式 degraded 且 enabled=false；
 * desktop WebView 按 manifest grant 投影；无 extension projection 时 fail-closed。
 */
export function evaluateOmpExtensionUiPolicy(
  mode: OmpHostUiMode,
  projection: OmpManifestProjection | null,
): OmpExtensionUiPolicy {
  if (!projection || projection.manifest.kind !== "extension") {
    return Object.freeze({
      state: "unknown",
      enabled: false,
      rationale: "no extension manifest projected; extension UI capability not proven",
    });
  }
  if (mode === "headless") {
    return Object.freeze({
      state: "degraded",
      enabled: false,
      rationale:
        "headless ACP/RPC host has no UI surface; extension_ui_request frames are recorded but never rendered",
    });
  }
  if (projection.state !== "enabled") {
    return Object.freeze({
      state: "unknown",
      enabled: false,
      rationale: "extension manifest grant is off; UI projection stays fail-closed",
    });
  }
  return Object.freeze({
    state: "supported",
    enabled: true,
    rationale: "desktop WebView host renders extension UI per manifest grant",
  });
}
