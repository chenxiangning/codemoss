import { describe, expect, it } from "vitest";
import type { SkillOption } from "../../../types";
import {
  disableOmpManifest,
  enableOmpManifest,
  isOmpManifestPermissionEnabled,
  projectOmpManifest,
  validateOmpManifest,
} from "./ompCapabilityBoundary";

const manifest = {
  id: "review-skill",
  name: "Review skill",
  version: "1.2.3",
  kind: "skill",
  entrypoint: "skill.md",
  permissions: ["filesystem.read", "network", "plugin.install", "secret.access"],
} as const;

const scope = { workspaceId: "workspace-1", profileId: "profile-1" };
const skill: SkillOption = {
  name: "review-skill",
  path: "/workspace/.omp/skills/review-skill",
  description: "Review code",
};

describe("OMP P10 capability boundary", () => {
  it("validates versioned manifests and rejects unsafe entrypoints", () => {
    expect(validateOmpManifest(manifest)).toMatchObject({ valid: true });
    expect(
      validateOmpManifest({ ...manifest, entrypoint: "../escape.js" }),
    ).toMatchObject({ valid: false });
    expect(
      validateOmpManifest({ ...manifest, permissions: ["filesystem.execute"] }),
    ).toMatchObject({ valid: false });
  });

  it("projects discovered skills with profile and workspace scope, disabled by default", () => {
    const projection = projectOmpManifest(manifest, scope, {
      kind: "skill",
      item: skill,
    });
    expect(projection).not.toBeNull();
    expect(projection).toMatchObject({
      state: "disabled",
      scope,
      discovery: { kind: "skill", item: skill },
      audit: {
        action: "manifest.project",
        workspaceId: "workspace-1",
        profileId: "profile-1",
        redactedSecrets: true,
      },
    });
    expect(projection?.permissions["filesystem.read"]).toMatchObject({
      state: "unknown",
      enabled: false,
    });
    expect(projection?.permissions.network.enabled).toBe(false);
    expect(projection?.permissions["plugin.install"].enabled).toBe(false);
  });

  it("denies secret access and plugin installation even when requested", () => {
    const projection = projectOmpManifest(manifest, scope);
    expect(projection).not.toBeNull();
    const enabled = enableOmpManifest(projection!, [
      "filesystem.read",
      "network",
      "plugin.install",
      "secret.access",
    ]);
    expect(isOmpManifestPermissionEnabled(enabled, "filesystem.read")).toBe(true);
    expect(isOmpManifestPermissionEnabled(enabled, "network")).toBe(true);
    expect(isOmpManifestPermissionEnabled(enabled, "plugin.install")).toBe(false);
    expect(isOmpManifestPermissionEnabled(enabled, "secret.access")).toBe(false);
    expect(enabled.permissions["secret.access"].state).toBe("unsupported");
    expect(enabled.audit.redactedSecrets).toBe(true);
  });

  it("fully rolls back grants on disable", () => {
    const projection = projectOmpManifest(manifest, scope);
    const enabled = enableOmpManifest(projection!, ["filesystem.read", "network"]);
    const disabled = disableOmpManifest(enabled);
    expect(disabled.state).toBe("disabled");
    expect(disabled.permissions["filesystem.read"]).toMatchObject({
      state: "unknown",
      enabled: false,
    });
    expect(disabled.permissions.network.enabled).toBe(false);
    expect(disabled.permissions["plugin.install"]).toMatchObject({
      state: "unknown",
      enabled: false,
    });
    expect(disabled.permissions["secret.access"]).toMatchObject({
      state: "unsupported",
      enabled: false,
    });
    expect(disabled.audit.action).toBe("manifest.disable");
  });
});
