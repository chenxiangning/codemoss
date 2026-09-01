import type { OmpManifestScope } from "./ompCapabilityBoundary";

/**
 * OMP workspace add-dir 授权域（8.4）。
 * 语义镜像 Rust 侧 engine/session_directory_grant.rs：纯词法归一化、
 * 敏感根识别、once/session/workspace 三级 scope。前端只做 grant 记录/撤销/审计投影；
 * 真实 canonicalize（symlink 解析）与进程级 allowlist 由 Rust runtime owner 执行。
 */

export type OmpDirectoryGrantScope = "once" | "session" | "workspace";

export type OmpWorkspaceGrant = Readonly<{
  root: string;
  scope: OmpDirectoryGrantScope;
  sensitive: boolean;
}>;

export type OmpWorkspaceGrantAudit = Readonly<{
  action: "grant.record" | "grant.revoke";
  root: string;
  scope: OmpDirectoryGrantScope;
  sensitive: boolean;
  workspaceId: string;
  profileId: string;
  redactedSecrets: true;
}>;

export type OmpWorkspaceGrantRegistry = Readonly<{
  scope: OmpManifestScope;
  grants: readonly OmpWorkspaceGrant[];
  audit: readonly OmpWorkspaceGrantAudit[];
}>;

const GRANT_SCOPE_RANK: Readonly<Record<OmpDirectoryGrantScope, number>> = Object.freeze({
  once: 0,
  session: 1,
  workspace: 2,
});

export function parseOmpDirectoryGrantScope(raw: unknown): OmpDirectoryGrantScope | null {
  return raw === "once" || raw === "session" || raw === "workspace" ? raw : null;
}

const WINDOWS_DRIVE_PATTERN = /^[A-Za-z]:$/;

/**
 * 词法归一化：必须是绝对路径（POSIX `/` 或 Windows 盘符），折叠 `.`/`..`，
 * 禁止逃逸到文件系统根之外。不触碰 fs，与 Rust normalize_path_lexically 对齐。
 */
export function normalizeOmpGrantRoot(rawPath: unknown): string | null {
  if (typeof rawPath !== "string") {
    return null;
  }
  const trimmed = rawPath.trim();
  if (!trimmed) {
    return null;
  }
  const unified = trimmed.replace(/\\/g, "/");
  const isWindows = /^[A-Za-z]:\//.test(unified);
  if (!unified.startsWith("/") && !isWindows) {
    return null;
  }
  const segments = unified.split("/");
  const out: string[] = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      const top = out.at(-1);
      if (top === undefined || (out.length === 1 && WINDOWS_DRIVE_PATTERN.test(top))) {
        return null;
      }
      out.pop();
      continue;
    }
    out.push(segment);
  }
  if (isWindows) {
    const drive = out[0];
    if (!drive || !WINDOWS_DRIVE_PATTERN.test(drive)) {
      return null;
    }
    return out.length === 1 ? `${drive}/` : out.join("/");
  }
  return `/${out.join("/")}`;
}

/** 与 Rust is_sensitive_grant_root 对齐：.ssh、整 home、系统根一律敏感。 */
export function isOmpSensitiveGrantRoot(root: string, homeDir?: string | null): boolean {
  const lower = root.toLowerCase();
  if (lower.endsWith("/.ssh") || lower.includes("/.ssh/")) {
    return true;
  }
  if (homeDir) {
    const normalizedHome = normalizeOmpGrantRoot(homeDir);
    if (normalizedHome && root === normalizedHome) {
      return true;
    }
  }
  return (
    lower === "/" ||
    lower === "c:/" ||
    lower === "/system" ||
    lower === "/etc" ||
    lower === "/private/etc"
  );
}

/** 参照 Rust suggest_grant_root：file 目标取父目录，directory 目标取自身。 */
export function suggestOmpGrantRoot(
  path: string,
  kind: "file" | "directory",
): string | null {
  const normalized = normalizeOmpGrantRoot(path);
  if (!normalized) {
    return null;
  }
  if (kind === "directory") {
    return normalized;
  }
  if (normalized === "/" || WINDOWS_DRIVE_PATTERN.test(normalized.slice(0, 2))) {
    return normalized;
  }
  const parent = normalized.slice(0, normalized.lastIndexOf("/"));
  return parent || "/";
}

export function createOmpWorkspaceGrantRegistry(
  scope: OmpManifestScope,
): OmpWorkspaceGrantRegistry | null {
  const workspaceId = scope.workspaceId.trim();
  const profileId = scope.profileId.trim();
  if (!workspaceId || !profileId) {
    return null;
  }
  return Object.freeze({
    scope: Object.freeze({ workspaceId, profileId }),
    grants: Object.freeze([]),
    audit: Object.freeze([]),
  });
}

const auditEntry = (
  registry: OmpWorkspaceGrantRegistry,
  action: OmpWorkspaceGrantAudit["action"],
  grant: OmpWorkspaceGrant,
): OmpWorkspaceGrantAudit =>
  Object.freeze({
    action,
    root: grant.root,
    scope: grant.scope,
    sensitive: grant.sensitive,
    workspaceId: registry.scope.workspaceId,
    profileId: registry.scope.profileId,
    redactedSecrets: true,
  });

export type OmpWorkspaceGrantDecision = Readonly<{
  granted: boolean;
  reason:
    | "granted"
    | "invalid-root"
    | "invalid-scope"
    | "approval-required"
    | "sensitive-root-unacknowledged";
  root: string | null;
  sensitive: boolean;
  registry: OmpWorkspaceGrantRegistry;
}>;

/**
 * 记录一条 add-dir grant。高风险路径（未显式 approve / 敏感根未确认）一律 fail-closed，registry 原样返回；
 * 同一 root 重复 grant 时取更宽 scope（workspace > session > once）。
 */
export function grantOmpWorkspaceDirectory(
  registry: OmpWorkspaceGrantRegistry,
  request: Readonly<{
    path: string;
    scope: OmpDirectoryGrantScope;
    approved?: boolean;
    sensitiveAcknowledged?: boolean;
    homeDir?: string;
  }>,
): OmpWorkspaceGrantDecision {
  const root = normalizeOmpGrantRoot(request.path);
  if (!root) {
    return Object.freeze({
      granted: false,
      reason: "invalid-root",
      root: null,
      sensitive: false,
      registry,
    });
  }
  const scope = parseOmpDirectoryGrantScope(request.scope);
  if (!scope) {
    return Object.freeze({
      granted: false,
      reason: "invalid-scope",
      root,
      sensitive: false,
      registry,
    });
  }
  const sensitive = isOmpSensitiveGrantRoot(root, request.homeDir ?? null);
  if (request.approved !== true) {
    return Object.freeze({
      granted: false,
      reason: "approval-required",
      root,
      sensitive,
      registry,
    });
  }
  if (sensitive && request.sensitiveAcknowledged !== true) {
    return Object.freeze({
      granted: false,
      reason: "sensitive-root-unacknowledged",
      root,
      sensitive,
      registry,
    });
  }

  const existing = registry.grants.find((grant) => grant.root === root);
  const mergedScope: OmpDirectoryGrantScope =
    existing && GRANT_SCOPE_RANK[existing.scope] > GRANT_SCOPE_RANK[scope]
      ? existing.scope
      : scope;
  const grant: OmpWorkspaceGrant = Object.freeze({
    root,
    scope: mergedScope,
    sensitive,
  });
  const grants = existing
    ? registry.grants.map((current) => (current.root === root ? grant : current))
    : [...registry.grants, grant];
  return Object.freeze({
    granted: true,
    reason: "granted",
    root,
    sensitive,
    registry: Object.freeze({
      ...registry,
      grants: Object.freeze(grants),
      audit: Object.freeze([...registry.audit, auditEntry(registry, "grant.record", grant)]),
    }),
  });
}

export type OmpWorkspaceRevokeDecision = Readonly<{
  revoked: boolean;
  reason: "revoked" | "grant-not-found" | "invalid-root";
  registry: OmpWorkspaceGrantRegistry;
}>;

/** 撤销是显式动作：未知 root 与非法 root 都不产生审计伪影。 */
export function revokeOmpWorkspaceDirectory(
  registry: OmpWorkspaceGrantRegistry,
  rawRoot: string,
): OmpWorkspaceRevokeDecision {
  const root = normalizeOmpGrantRoot(rawRoot);
  if (!root) {
    return Object.freeze({ revoked: false, reason: "invalid-root", registry });
  }
  const existing = registry.grants.find((grant) => grant.root === root);
  if (!existing) {
    return Object.freeze({ revoked: false, reason: "grant-not-found", registry });
  }
  return Object.freeze({
    revoked: true,
    reason: "revoked",
    registry: Object.freeze({
      ...registry,
      grants: Object.freeze(registry.grants.filter((grant) => grant.root !== root)),
      audit: Object.freeze([
        ...registry.audit,
        auditEntry(registry, "grant.revoke", existing),
      ]),
    }),
  });
}

const isWindowsRoot = (root: string): boolean =>
  WINDOWS_DRIVE_PATTERN.test(root.slice(0, 2));

const containsPath = (candidate: string, root: string): boolean => {
  const normalizedRoot = root.endsWith("/") && root !== "/" && !isWindowsRoot(root)
    ? root.slice(0, -1)
    : root;
  if (candidate === normalizedRoot) {
    return true;
  }
  const prefix = normalizedRoot === "/" ? "/" : `${normalizedRoot}/`;
  return candidate.startsWith(prefix);
};

/** 词法包含检查；Windows 盘符根大小写不敏感，POSIX 保持大小写敏感。 */
export function isOmpWorkspacePathGranted(
  registry: OmpWorkspaceGrantRegistry,
  rawCandidate: string,
): boolean {
  const candidate = normalizeOmpGrantRoot(rawCandidate);
  if (!candidate) {
    return false;
  }
  return registry.grants.some((grant) => {
    if (isWindowsRoot(grant.root)) {
      return containsPath(candidate.toLowerCase(), grant.root.toLowerCase());
    }
    return containsPath(candidate, grant.root);
  });
}
