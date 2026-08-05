import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { decodeSquadProjection, sharedSquadGet } from "./squadOrchestration";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

function projection() {
  return {
    schemaVersion: 1,
    runId: "run-1",
    workspaceId: "workspace-id",
    workspaceRoot: "/workspace",
    sessionId: "shared:thread-1",
    requestText: "analyze this",
    leadTarget: {
      engine: "codex",
      providerProfileId: null,
      modelCatalogEntryId: "gpt-5",
      model: "gpt-5",
      providerProfileNameSnapshot: "Local",
      providerProfileSource: "local",
    },
    status: "planning",
    planRevision: 0,
    plan: null,
    nodes: [],
    activeAttemptIds: ["attempt-1"],
    diagnostics: [],
    requestedAt: 1,
    approvedAt: null,
    updatedAt: 1,
  };
}

describe("Squad Tauri trust boundary", () => {
  beforeEach(() => vi.mocked(invoke).mockReset());

  it("maps get and validates the backend response", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(projection());

    await expect(
      sharedSquadGet("/workspace", "shared:thread-1"),
    ).resolves.toMatchObject({
      runId: "run-1",
      status: "planning",
    });
    expect(invoke).toHaveBeenCalledWith("shared_squad_get", {
      workspaceId: "/workspace",
      threadId: "shared:thread-1",
    });
  });

  it("allows additive unknown fields without weakening required fields", () => {
    const candidate = {
      ...projection(),
      futureProjectionField: { version: 2 },
    };
    expect(decodeSquadProjection(candidate)).toBe(candidate);
  });

  it("fails closed on an invalid canonical status", () => {
    expect(() =>
      decodeSquadProjection({ ...projection(), status: "silently-running" }),
    ).toThrow("squad-response-invalid: projection.status");
  });
});
