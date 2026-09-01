import { describe, expect, it } from "vitest";
import {
  DEFAULT_OMP_EXTERNAL_CAPABILITY_RECORDS,
  applyOmpExternalLifecycleObservation,
  enableOmpExternalCapability,
  evaluateOmpExternalOperation,
  grantOmpExternalCapability,
  redactOmpExternalInput,
  setOmpExternalCapabilityState,
} from "./ompExternalIntegrations";

describe("OMP external integration capability boundary", () => {
  it("fails closed and keeps every external integration disabled by default", () => {
    for (const capability of ["mcp", "browser", "computer", "ssh", "search"] as const) {
      expect(DEFAULT_OMP_EXTERNAL_CAPABILITY_RECORDS[capability]).toMatchObject({
        state: "unknown",
        enabled: false,
        requiresApproval: true,
        workspaceGrant: null,
        userGrant: null,
        lifecycle: "disabled",
      });
    }

    const decision = evaluateOmpExternalOperation(DEFAULT_OMP_EXTERNAL_CAPABILITY_RECORDS, "mcp.list", {
      workspaceId: "ws-1",
      userId: "user-1",
    });
    expect(decision).toMatchObject({
      outcome: "unknown",
      reason: "unverified-capability",
      capability: "mcp",
      operation: "mcp.list",
    });
  });

  it("returns typed unknown without invoking a host or network transport", () => {
    const decision = evaluateOmpExternalOperation(DEFAULT_OMP_EXTERNAL_CAPABILITY_RECORDS, "browser.open", {
      workspaceId: "ws-1",
      userId: "user-1",
    });
    expect(decision).toMatchObject({
      outcome: "unknown",
      reason: "unknown-operation",
      capability: null,
      operation: "browser.open",
    });
    expect(decision.audit.source).toBe("omp-native-rpc");
    expect(decision.audit.redacted).toBe(true);
  });

  it("requires both matching workspace and user grants before a supported operation", () => {
    let records = setOmpExternalCapabilityState(DEFAULT_OMP_EXTERNAL_CAPABILITY_RECORDS, "mcp", "supported");
    records = enableOmpExternalCapability(records, "mcp", { requiresApproval: false });
    records = grantOmpExternalCapability(records, "mcp", {
      workspaceId: "ws-1",
      userId: "user-1",
      granted: true,
    });

    expect(
      evaluateOmpExternalOperation(records, "mcp.list", { workspaceId: "other-workspace", userId: "user-1" }),
    ).toMatchObject({ outcome: "blocked", reason: "missing-workspace-grant" });
    expect(
      evaluateOmpExternalOperation(records, "mcp.list", { workspaceId: "ws-1", userId: "other-user" }),
    ).toMatchObject({ outcome: "blocked", reason: "missing-user-grant" });
    expect(evaluateOmpExternalOperation(records, "mcp.list", { workspaceId: "ws-1", userId: "user-1" })).toMatchObject({
      outcome: "allowed",
      reason: "allowed",
    });
  });

  it("keeps approval as a blocking boundary even after grants", () => {
    let records = setOmpExternalCapabilityState(DEFAULT_OMP_EXTERNAL_CAPABILITY_RECORDS, "search", "supported");
    records = enableOmpExternalCapability(records, "search");
    records = grantOmpExternalCapability(records, "search", {
      workspaceId: "ws-1",
      userId: "user-1",
      granted: true,
    });
    expect(evaluateOmpExternalOperation(records, "search.query", { workspaceId: "ws-1", userId: "user-1" })).toMatchObject({
      outcome: "blocked",
      reason: "approval-required",
    });
  });

  it("redacts credentials from integration payloads and records omitted fields", () => {
    const redacted = redactOmpExternalInput({
      server: "docs",
      token: "do-not-log",
      nested: { privateKey: "do-not-log-either", path: "/tmp/docs" },
    });
    expect(redacted.value).toEqual({
      server: "docs",
      token: "[redacted]",
      nested: { privateKey: "[redacted]", path: "/tmp/docs" },
    });
    expect(redacted.secretFieldsOmitted).toEqual(["token", "nested.privateKey"]);
    expect(JSON.stringify(redacted.value)).not.toContain("do-not-log");
  });

  it("keeps explicitly unsupported capabilities typed and disabled", () => {
    const records = setOmpExternalCapabilityState(DEFAULT_OMP_EXTERNAL_CAPABILITY_RECORDS, "computer", "unsupported");
    const decision = evaluateOmpExternalOperation(records, "computer.toggle");
    expect(decision).toMatchObject({
      outcome: "unsupported",
      reason: "unsupported-capability",
      capability: "computer",
      operation: "computer.toggle",
    });
  });

  it("records lifecycle observations without turning them into permission grants", () => {
    let records = applyOmpExternalLifecycleObservation(
      DEFAULT_OMP_EXTERNAL_CAPABILITY_RECORDS,
      "browser",
      "connected",
    );
    expect(records.browser.lifecycle).toBe("connected");
    expect(records.browser.enabled).toBe(false);
    expect(records.browser.workspaceGrant).toBeNull();
    expect(records.browser.userGrant).toBeNull();
    expect(evaluateOmpExternalOperation(records, "browser.relay")).toMatchObject({
      outcome: "unknown",
      reason: "unverified-capability",
    });
  });
});
