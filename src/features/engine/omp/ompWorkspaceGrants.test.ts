import { describe, expect, it } from "vitest";
import {
  createOmpWorkspaceGrantRegistry,
  grantOmpWorkspaceDirectory,
  isOmpSensitiveGrantRoot,
  isOmpWorkspacePathGranted,
  normalizeOmpGrantRoot,
  revokeOmpWorkspaceDirectory,
  suggestOmpGrantRoot,
} from "./ompWorkspaceGrants";

const scope = { workspaceId: "workspace-1", profileId: "profile-1" };

describe("OMP workspace add-dir grants (8.4)", () => {
  it("normalizes grant roots lexically and rejects non-absolute or escaping paths", () => {
    expect(normalizeOmpGrantRoot("/data/project/../shared")).toBe("/data/shared");
    expect(normalizeOmpGrantRoot("/data/./shared/")).toBe("/data/shared");
    expect(normalizeOmpGrantRoot("data/shared")).toBeNull();
    expect(normalizeOmpGrantRoot("/../escape")).toBeNull();
    expect(normalizeOmpGrantRoot("  ")).toBeNull();
    expect(normalizeOmpGrantRoot("C:\\work\\repo")).toBe("C:/work/repo");
  });

  it("flags sensitive roots the same way as the Rust grant domain", () => {
    expect(isOmpSensitiveGrantRoot("/")).toBe(true);
    expect(isOmpSensitiveGrantRoot("/etc")).toBe(true);
    expect(isOmpSensitiveGrantRoot("/private/etc")).toBe(true);
    expect(isOmpSensitiveGrantRoot("/Users/me/.ssh")).toBe(true);
    expect(isOmpSensitiveGrantRoot("/Users/me/.ssh/config")).toBe(true);
    expect(isOmpSensitiveGrantRoot("/Users/me", "/Users/me")).toBe(true);
    expect(isOmpSensitiveGrantRoot("/Users/me/projects", "/Users/me")).toBe(false);
    expect(isOmpSensitiveGrantRoot("/data/shared")).toBe(false);
  });

  it("suggests the parent directory for file targets and the path itself for directories", () => {
    expect(suggestOmpGrantRoot("/data/shared/report.md", "file")).toBe("/data/shared");
    expect(suggestOmpGrantRoot("/data/shared", "directory")).toBe("/data/shared");
    expect(suggestOmpGrantRoot("/report.md", "file")).toBe("/");
  });

  it("fails closed when a high-risk add-dir grant is not explicitly approved", () => {
    const registry = createOmpWorkspaceGrantRegistry(scope);
    expect(registry).not.toBeNull();
    const decision = grantOmpWorkspaceDirectory(registry!, {
      path: "/data/shared",
      scope: "session",
    });
    expect(decision.granted).toBe(false);
    expect(decision.reason).toBe("approval-required");
    expect(decision.registry).toBe(registry);
    expect(decision.registry.grants).toHaveLength(0);
    expect(decision.registry.audit).toHaveLength(0);
  });

  it("records an approved grant with an audit projection", () => {
    const registry = createOmpWorkspaceGrantRegistry(scope)!;
    const decision = grantOmpWorkspaceDirectory(registry, {
      path: "/data/shared/../shared",
      scope: "session",
      approved: true,
    });
    expect(decision.granted).toBe(true);
    expect(decision.root).toBe("/data/shared");
    expect(decision.registry.grants).toEqual([
      { root: "/data/shared", scope: "session", sensitive: false },
    ]);
    expect(decision.registry.audit).toEqual([
      {
        action: "grant.record",
        root: "/data/shared",
        scope: "session",
        sensitive: false,
        workspaceId: "workspace-1",
        profileId: "profile-1",
        redactedSecrets: true,
      },
    ]);
    expect(isOmpWorkspacePathGranted(decision.registry, "/data/shared/notes/a.md")).toBe(true);
    expect(isOmpWorkspacePathGranted(decision.registry, "/data/other")).toBe(false);
  });

  it("requires explicit acknowledgement for sensitive roots even when approved", () => {
    const registry = createOmpWorkspaceGrantRegistry(scope)!;
    const blocked = grantOmpWorkspaceDirectory(registry, {
      path: "/Users/me/.ssh",
      scope: "workspace",
      approved: true,
      homeDir: "/Users/me",
    });
    expect(blocked.granted).toBe(false);
    expect(blocked.reason).toBe("sensitive-root-unacknowledged");
    expect(blocked.registry.grants).toHaveLength(0);

    const acknowledged = grantOmpWorkspaceDirectory(registry, {
      path: "/Users/me/.ssh",
      scope: "workspace",
      approved: true,
      sensitiveAcknowledged: true,
      homeDir: "/Users/me",
    });
    expect(acknowledged.granted).toBe(true);
    expect(acknowledged.registry.grants[0]).toMatchObject({
      root: "/Users/me/.ssh",
      sensitive: true,
    });
    expect(acknowledged.registry.audit[0]).toMatchObject({
      action: "grant.record",
      sensitive: true,
    });
  });

  it("upgrades an existing grant to the broader scope without duplicating the root", () => {
    const registry = createOmpWorkspaceGrantRegistry(scope)!;
    const once = grantOmpWorkspaceDirectory(registry, {
      path: "/data/shared",
      scope: "once",
      approved: true,
    });
    const widened = grantOmpWorkspaceDirectory(once.registry, {
      path: "/data/shared",
      scope: "workspace",
      approved: true,
    });
    expect(widened.registry.grants).toEqual([
      { root: "/data/shared", scope: "workspace", sensitive: false },
    ]);
    expect(widened.registry.audit.map((entry) => entry.action)).toEqual([
      "grant.record",
      "grant.record",
    ]);
  });

  it("revokes grants with an audit entry and fails closed for unknown roots", () => {
    const registry = createOmpWorkspaceGrantRegistry(scope)!;
    const granted = grantOmpWorkspaceDirectory(registry, {
      path: "/data/shared",
      scope: "session",
      approved: true,
    });
    const revoked = revokeOmpWorkspaceDirectory(granted.registry, "/data/shared");
    expect(revoked.revoked).toBe(true);
    expect(revoked.registry.grants).toHaveLength(0);
    expect(revoked.registry.audit.at(-1)).toMatchObject({
      action: "grant.revoke",
      root: "/data/shared",
      scope: "session",
    });
    expect(isOmpWorkspacePathGranted(revoked.registry, "/data/shared/a.md")).toBe(false);

    const missing = revokeOmpWorkspaceDirectory(revoked.registry, "/data/never-granted");
    expect(missing.revoked).toBe(false);
    expect(missing.reason).toBe("grant-not-found");
    expect(missing.registry).toBe(revoked.registry);
  });

  it("refuses registries with blank workspace or profile scope", () => {
    expect(createOmpWorkspaceGrantRegistry({ workspaceId: " ", profileId: "p" })).toBeNull();
    expect(createOmpWorkspaceGrantRegistry({ workspaceId: "w", profileId: "" })).toBeNull();
  });
});
