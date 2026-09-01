import { describe, expect, it, vi } from "vitest";
import type { CodexDoctorResult } from "../../../types/diagnostics";
import {
  DEFAULT_OMP_ADMIN_CAPABILITY_MATRIX,
  clearOmpAdminDomainStore,
  createOmpAdminDomainStore,
  diagnoseOmpAdminDomainStore,
  enqueueOmpAdminDomainWrite,
  evaluateOmpAdminAction,
  flushOmpAdminDomainQueue,
  grantOmpAdminCapability,
  issueOmpConfirmationToken,
  ompAdminDomainStorageKey,
  persistOmpAdminDomainStore,
  projectOmpAdminCapability,
  projectOmpAdminDomainSync,
  projectOmpAdvisor,
  projectOmpAttribution,
  projectOmpBenchMeasurement,
  projectOmpDiagnostics,
  projectOmpExport,
  projectOmpMemory,
  projectOmpMentalModel,
  projectOmpSecurityFinding,
  projectOmpUsage,
  readOmpAdminDomainStore,
  redactOmpAdminValue,
  rollbackOmpWorktreeOwnership,
  type OmpAdminDomainStore,
  type OmpAdminOwner,
} from "./ompAdminBoundary";

vi.mock("@/services/clientStorage", () => ({
  getClientStoreSync: vi.fn(),
  writeClientStoreValue: vi.fn(),
}));

import { getClientStoreSync, writeClientStoreValue } from "@/services/clientStorage";

const ownership = {
  worktreeId: "wt-1",
  ownerId: "omp-owner",
  workspaceId: "ws-1",
} as const;

const context = {
  actorId: "user-1",
  role: "admin" as const,
  ompOwnerId: "omp-owner",
  workspaceId: "ws-1",
  ownership,
};

describe("OMP P12 admin boundary", () => {
  it("denies unknown owner and cross-workspace mutation by default", () => {
    expect(
      evaluateOmpAdminAction(
        { operation: "worktree.remove", ownerId: "other", workspaceId: "ws-1", worktreeId: "wt-1", confirmationToken: issueOmpConfirmationToken({ operation: "worktree.remove", ownerId: "other", workspaceId: "ws-1", worktreeId: "wt-1" }) },
        context,
      ).reason,
    ).toBe("owner-mismatch");
    expect(
      evaluateOmpAdminAction(
        { operation: "git.command", ownerId: "omp-owner", workspaceId: "ws-2", confirmationToken: issueOmpConfirmationToken({ operation: "git.command", ownerId: "omp-owner", workspaceId: "ws-2" }) },
        context,
      ).reason,
    ).toBe("workspace-mismatch");
  });

  it("requires admin and explicit confirmation for maintenance and destructive actions", () => {
    expect(
      evaluateOmpAdminAction(
        { operation: "setup.install", ownerId: "omp-owner" },
        { ...context, role: "user" },
      ).reason,
    ).toBe("admin-required");
    expect(
      evaluateOmpAdminAction(
        { operation: "update.gc", ownerId: "omp-owner" },
        context,
      ).reason,
    ).toBe("confirmation-required");
    expect(
      evaluateOmpAdminAction(
        { operation: "update.gc", ownerId: "omp-owner", confirmed: true },
        { ...context, mutationGuard: () => true },
      ).allowed,
    ).toBe(true);
    // 静态占位字符串不再通过确认门：token 必须与动作元组绑定
    expect(
      evaluateOmpAdminAction(
        { operation: "update.gc", ownerId: "omp-owner", confirmationToken: "confirmed" },
        { ...context, mutationGuard: () => true },
      ).reason,
    ).toBe("confirmation-required");
    expect(
      evaluateOmpAdminAction(
        {
          operation: "update.gc",
          ownerId: "omp-owner",
          confirmationToken: issueOmpConfirmationToken({ operation: "update.gc", ownerId: "omp-owner" }),
        },
        { ...context, mutationGuard: () => true },
      ).allowed,
    ).toBe(true);
  });

  it("reuses the mutation guard and leaves no ownership after rollback", () => {
    const guard = vi.fn(() => false);
    const decision = evaluateOmpAdminAction(
      { operation: "git.command", ownerId: "omp-owner", confirmationToken: issueOmpConfirmationToken({ operation: "git.command", ownerId: "omp-owner" }) },
      { ...context, mutationGuard: guard },
    );
    expect(decision.reason).toBe("mutation-guard-denied");
    expect(guard).toHaveBeenCalledWith("git.command");
    expect(rollbackOmpWorktreeOwnership([ownership], "omp-owner")).toEqual([]);
    expect(rollbackOmpWorktreeOwnership([ownership], "other")).toEqual([ownership]);
  });

  it("keeps bench and diagnostics out of foreground Conversation", () => {
    expect(
      evaluateOmpAdminAction(
        { operation: "bench.measure", ownerId: "omp-owner", provider: "p", model: "m" },
        context,
      ).allowed,
    ).toBe(true);
    expect(
      evaluateOmpAdminAction(
        { operation: "bench.measure", ownerId: "omp-owner", conversationId: "conversation-1" },
        context,
      ).reason,
    ).toBe("bench-conversation-coupling");
    const bench = projectOmpBenchMeasurement({ provider: "p", model: "m", durationMs: 12, ok: true });
    expect(bench.conversationId).toBeNull();

    const result = {
      ok: true,
      codexBin: null,
      version: null,
      appServerOk: true,
      details: null,
      path: null,
      nodeOk: true,
      nodeVersion: null,
      nodeDetails: null,
    } satisfies CodexDoctorResult;
    expect(projectOmpDiagnostics(result, "ws-1")).toMatchObject({
      kind: "diagnostics",
      workspaceId: "ws-1",
      conversationId: null,
      result,
    });
  });
});

 

const p11Owner: OmpAdminOwner = {
  engine: "omp",
  workspaceId: "workspace-1",
  runtimeProfileId: "profile-1",
  providerProfileId: "provider-1",
  nativeSessionId: "native-1",
  logicalThreadId: "thread-1",
};

const p11Evidence = {
  nativeCommand: "security.show",
  nativeCommands: ["security.show"],
  verified: true,
};

describe("OMP P11 memory/security/usage/export boundary", () => {
  it("fails closed for every P11 capability without native evidence", () => {
    expect(DEFAULT_OMP_ADMIN_CAPABILITY_MATRIX.memory).toMatchObject({
      state: "unsupported",
      enabled: false,
      requiresApproval: true,
      nativeCommand: null,
    });
    expect(projectOmpAdminCapability("usage.stats")).toMatchObject({
      state: "unsupported",
      reason: "native-support-not-proven",
    });
  });

  it("distinguishes discovered-but-unverified input from verified native support", () => {
    expect(
      projectOmpAdminCapability("security.scan", {
        nativeCommand: "security.scan",
        nativeCommands: ["security.scan"],
      }),
    ).toMatchObject({ state: "compat-input", enabled: false });
    const verified = {
      ...DEFAULT_OMP_ADMIN_CAPABILITY_MATRIX,
      "security.scan": projectOmpAdminCapability("security.scan", {
        nativeCommand: "security.scan",
        nativeCommands: ["security.scan"],
        verified: true,
      }),
    };
    expect(grantOmpAdminCapability(verified, "security.scan", false)["security.scan"]).toMatchObject({
      state: "supported",
      enabled: true,
      requiresApproval: false,
    });
    expect(projectOmpAdminCapability("security.scan", { ...p11Evidence })).toMatchObject({
      state: "supported",
      enabled: false,
      requiresApproval: true,
    });
  });

  it("requires complete, exact ownership before exposing admin data", () => {
    expect(projectOmpAttribution(null, p11Owner)).toMatchObject({
      status: "unattributed",
      owner: null,
    });
    expect(
      projectOmpAttribution({ ...p11Owner, workspaceId: "other-workspace" }, p11Owner),
    ).toMatchObject({ status: "mismatch", owner: null });
    expect(projectOmpAttribution(p11Owner, p11Owner)).toMatchObject({
      status: "strict-match",
      owner: p11Owner,
    });
  });

  it("redacts nested secrets and secret-like strings without exposing raw values", () => {
    const result = redactOmpAdminValue({
      details: {
        apiKey: "sk-live-secret",
        message: "Authorization=Bearer abc123 and token=xyz",
      },
      safe: "keep this",
    });
    expect(result.valuesRedacted).toBe(true);
    expect(result.value).toEqual({
      details: {
        apiKey: "[redacted]",
        message: "Authorization=Bearer [redacted] and token=[redacted]",
      },
      safe: "keep this",
    });
    expect(JSON.stringify(result.value)).not.toContain("sk-live-secret");
    expect(JSON.stringify(result.value)).not.toContain("abc123");
  });

  it("projects security findings as feature-local data and strips mismatched owners", () => {
    const projected = projectOmpSecurityFinding({
      evidence: p11Evidence,
      candidateOwner: p11Owner,
      expectedOwner: p11Owner,
      finding: {
        id: "finding-1",
        source: "omp-security",
        severity: "high",
        disposition: "open",
        details: { token: "do-not-share" },
      },
      requestId: "request-1",
      occurredAt: "2026-08-31T00:00:00.000Z",
    });
    expect(projected.surface).toBe("omp-admin");
    expect(projected.data).toMatchObject({ id: "finding-1", details: { token: "[redacted]" } });
    expect(projected.audit).toMatchObject({
      actor: "omp-native",
      requestId: "request-1",
      valuesRedacted: true,
    });

    const mismatched = projectOmpSecurityFinding({
      evidence: p11Evidence,
      candidateOwner: { ...p11Owner, nativeSessionId: "other-session" },
      expectedOwner: p11Owner,
      finding: {
        id: "finding-2",
        source: "omp-security",
        severity: "low",
        disposition: "open",
        details: {},
      },
      requestId: "request-2",
    });
    expect(mismatched.data).toBeNull();
    expect(mismatched.attribution.status).toBe("mismatch");
  });

  it("keeps usage and export projections out of Conversation and redacts export payloads", () => {
    const usage = projectOmpUsage({
      evidence: { ...p11Evidence, nativeCommand: "usage.stats", nativeCommands: ["usage.stats"] },
      candidateOwner: p11Owner,
      expectedOwner: p11Owner,
      usage: { inputTokens: 10, outputTokens: 4 },
      requestId: "usage-1",
    });
    expect(usage.surface).toBe("omp-admin");
    expect(usage.data).toEqual({ inputTokens: 10, outputTokens: 4 });

    const exported = projectOmpExport({
      capability: "export.html",
      evidence: {
        ...p11Evidence,
        nativeCommand: "export.html",
        nativeCommands: ["export.html"],
      },
      candidateOwner: p11Owner,
      expectedOwner: p11Owner,
      payload: { html: "<p>safe</p>", credential: "secret-value" },
      requestId: "export-1",
    });
    expect(exported.surface).toBe("omp-admin");
    expect(exported.data).toEqual({ html: "<p>safe</p>", credential: "[redacted]" });
    expect(JSON.stringify(exported)).not.toContain("secret-value");
    expect("kind" in exported).toBe(false);
  });
});

  it("projects memory and advisor records only through the admin surface", () => {
    const memory = projectOmpMemory({
      evidence: {
        nativeCommand: "memory.list",
        nativeCommands: ["memory.list"],
        verified: true,
      },
      candidateOwner: p11Owner,
      expectedOwner: p11Owner,
      record: { id: "memory-1", kind: "fact", content: "remember this", createdAt: "2026-08-31" },
      requestId: "memory-1",
    });
    expect(memory.surface).toBe("omp-admin");
    expect(memory.data?.content).toBe("remember this");

    const advisor = projectOmpAdvisor({
      evidence: {
        nativeCommand: "advisor.run",
        nativeCommands: ["advisor.run"],
        verified: true,
      },
      candidateOwner: p11Owner,
      expectedOwner: p11Owner,
      result: {
        id: "advisor-1",
        title: "Tighten permissions",
        recommendation: "Review grants",
      },
      requestId: "advisor-1",
    });
    expect(advisor.surface).toBe("omp-admin");
    expect(advisor.data?.recommendation).toBe("Review grants");
  });

  it("projects mental-model records through the same admin surface", () => {
    const mentalModel = projectOmpMentalModel({
      evidence: {
        nativeCommand: "mental-models.list",
        nativeCommands: ["mental-models.list"],
        verified: true,
      },
      candidateOwner: p11Owner,
      expectedOwner: p11Owner,
      record: {
        id: "mm-1",
        kind: "architecture",
        content: "layered modules",
        createdAt: "2026-09-01",
      },
      requestId: "mm-1",
    });
    expect(mentalModel.surface).toBe("omp-admin");
    expect(mentalModel.capability).toBe("mental-models");
    expect(mentalModel.data?.content).toBe("layered modules");
  });

describe("OMP P11 memory/mental-models/advisor domain boundary (12.2)", () => {
  const enqueueSecret = (store: OmpAdminDomainStore) =>
    enqueueOmpAdminDomainWrite(store, {
      id: "rec-1",
      payload: { content: "remember", secret: "top-secret-value" },
      enqueuedAt: "2026-09-01T00:00:00.000Z",
    });

  it("queues writes in order and never lets secrets enter the projection", () => {
    let store = createOmpAdminDomainStore("memory", "profile-1");
    expect(store.sync).toBe("idle");
    expect(store.conversationId).toBeNull();

    store = enqueueSecret(store);
    store = enqueueOmpAdminDomainWrite(store, {
      id: "rec-2",
      payload: { content: "second" },
      enqueuedAt: "2026-09-01T00:00:01.000Z",
    });
    expect(store.queue.map((entry) => entry.recordId)).toEqual(["rec-1", "rec-2"]);
    expect(store.queue[0]?.seq).toBeLessThan(store.queue[1]?.seq ?? 0);
    expect(store.sync).toBe("queued");
    // 脱敏：secret 不落 queue/projection
    expect(JSON.stringify(store.queue)).not.toContain("top-secret-value");
    expect(store.queue[0]?.redactedPaths).toEqual(["secret"]);

    store = flushOmpAdminDomainQueue(store);
    expect(store.queue).toHaveLength(0);
    expect(store.records.map((record) => record.id)).toEqual(["rec-1", "rec-2"]);
    expect(store.sync).toBe("syncing");
    expect(JSON.stringify(store.records)).not.toContain("top-secret-value");
  });

  it("projects native sync outcomes including conflict and failure", () => {
    let store = createOmpAdminDomainStore("advisor", "profile-1");
    store = flushOmpAdminDomainQueue(enqueueSecret(store));

    store = projectOmpAdminDomainSync(store, { outcome: "synced" });
    expect(store.sync).toBe("synced");
    expect(store.lastError).toBeNull();

    store = projectOmpAdminDomainSync(store, { outcome: "failed", detail: "native-timeout" });
    expect(store.sync).toBe("failed");
    expect(store.lastError).toBe("native-timeout");

    store = projectOmpAdminDomainSync(store, { outcome: "conflict", detail: "diverged" });
    expect(store.sync).toBe("conflict");
  });

  it("diagnoses queue depth, sync state and pending issues without side effects", () => {
    let store = createOmpAdminDomainStore("mental-models", "profile-1");
    store = enqueueSecret(store);

    const pending = diagnoseOmpAdminDomainStore(store);
    expect(pending.domain).toBe("mental-models");
    expect(pending.queueDepth).toBe(1);
    expect(pending.issues).toContain("pending-writes-not-flushed");

    store = projectOmpAdminDomainSync(flushOmpAdminDomainQueue(store), {
      outcome: "failed",
      detail: "native-timeout",
    });
    const failed = diagnoseOmpAdminDomainStore(store);
    expect(failed.recordCount).toBe(1);
    expect(failed.issues).toContain("sync-failed:native-timeout");

    const healthy = diagnoseOmpAdminDomainStore(
      projectOmpAdminDomainSync(store, { outcome: "synced" }),
    );
    expect(healthy.issues).toEqual([]);
  });

  it("clear empties records and queue with an audit entry, keeping the trail", () => {
    let store = flushOmpAdminDomainQueue(
      enqueueSecret(createOmpAdminDomainStore("memory", "profile-1")),
    );
    store = clearOmpAdminDomainStore(store, {
      actorId: "user-1",
      occurredAt: "2026-09-01T01:00:00.000Z",
      detail: "user-requested",
    });
    expect(store.records).toHaveLength(0);
    expect(store.queue).toHaveLength(0);
    expect(store.sync).toBe("idle");
    expect(store.auditTrail.at(-1)).toEqual({
      operation: "memory.clear",
      domain: "memory",
      profileId: "profile-1",
      actorId: "user-1",
      occurredAt: "2026-09-01T01:00:00.000Z",
      detail: "user-requested",
    });
  });

  it("persists profile-scoped domain stores and fails closed on mismatch or corruption", () => {
    expect(ompAdminDomainStorageKey("memory", "profile-1")).toBe(
      "ompAdminDomain:memory:profile-1",
    );

    const store = flushOmpAdminDomainQueue(
      enqueueSecret(createOmpAdminDomainStore("memory", "profile-1")),
    );
    persistOmpAdminDomainStore(store);
    expect(writeClientStoreValue).toHaveBeenCalledWith(
      "app",
      "ompAdminDomain:memory:profile-1",
      expect.objectContaining({ domain: "memory", profileId: "profile-1" }),
      expect.objectContaining({ immediate: true }),
    );
    // 持久化载荷同样不得包含 secret
    expect(JSON.stringify(vi.mocked(writeClientStoreValue).mock.calls.at(-1))).not.toContain(
      "top-secret-value",
    );

    vi.mocked(getClientStoreSync).mockReturnValueOnce(store as never);
    expect(readOmpAdminDomainStore("memory", "profile-1")).toEqual(store);

    vi.mocked(getClientStoreSync).mockReturnValueOnce(
      createOmpAdminDomainStore("memory", "other") as never,
    );
    expect(readOmpAdminDomainStore("memory", "profile-1")).toBeNull();

    vi.mocked(getClientStoreSync).mockReturnValueOnce({ broken: true } as never);
    expect(readOmpAdminDomainStore("memory", "profile-1")).toBeNull();
  });

  it("keeps domain stores independent per domain and profile", () => {
    const memory = createOmpAdminDomainStore("memory", "profile-1");
    const advisor = createOmpAdminDomainStore("advisor", "profile-1");
    expect(ompAdminDomainStorageKey("memory", "profile-1")).not.toBe(
      ompAdminDomainStorageKey("advisor", "profile-1"),
    );
    expect(enqueueSecret(memory).queue).toHaveLength(1);
    expect(advisor.queue).toHaveLength(0);
  });
});
