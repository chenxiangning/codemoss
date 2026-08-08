import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  applyCollabThreadProcessingFromProjection,
  applyCollabThreadProcessingFromStatus,
  registerCollabThreadProcessingMarker,
  resetCollabThreadProcessingMarkerForTests,
  restoreCollabThreadProcessingIfActive,
  setCollabThreadProcessing,
} from "./collabThreadProcessingBridge";
import type { AgentProjectionV1 } from "../types";

function baseProjection(
  status: AgentProjectionV1["status"],
): AgentProjectionV1 {
  return {
    schemaVersion: 1,
    runId: "run-1",
    workspaceId: "ws-1",
    workspaceRoot: "/tmp",
    sessionId: "shared:session-1",
    requestText: "task",
    target: { engine: "claude" },
    status,
    planRevision: 1,
    plan: null,
    requestedAt: 1,
    updatedAt: 1,
  };
}

describe("collabThreadProcessingBridge", () => {
  beforeEach(() => {
    resetCollabThreadProcessingMarkerForTests();
  });

  it("no-ops when marker is not registered", () => {
    expect(() => setCollabThreadProcessing("shared:t1", true)).not.toThrow();
  });

  it("forwards setCollabThreadProcessing to the registered marker", () => {
    const marker = vi.fn();
    registerCollabThreadProcessingMarker(marker);
    setCollabThreadProcessing("shared:t1", true);
    expect(marker).toHaveBeenCalledWith("shared:t1", true);
    setCollabThreadProcessing("  shared:t1  ", false);
    expect(marker).toHaveBeenCalledWith("shared:t1", false);
  });

  it("ignores blank thread ids", () => {
    const marker = vi.fn();
    registerCollabThreadProcessingMarker(marker);
    setCollabThreadProcessing("   ", true);
    expect(marker).not.toHaveBeenCalled();
  });

  it("keeps processing for non-terminal statuses including awaiting-approval", () => {
    const marker = vi.fn();
    registerCollabThreadProcessingMarker(marker);
    for (const status of [
      "planning",
      "awaiting-approval",
      "implementing",
      "executing",
      "reviewing",
    ] as const) {
      marker.mockClear();
      applyCollabThreadProcessingFromStatus("shared:t1", status);
      expect(marker).toHaveBeenCalledWith("shared:t1", true);
    }
  });

  it("clears processing for terminal statuses", () => {
    const marker = vi.fn();
    registerCollabThreadProcessingMarker(marker);
    for (const status of ["succeeded", "failed", "cancelled"] as const) {
      marker.mockClear();
      applyCollabThreadProcessingFromStatus("shared:t1", status);
      expect(marker).toHaveBeenCalledWith("shared:t1", false);
    }
  });

  it("maps projection status and null projection", () => {
    const marker = vi.fn();
    registerCollabThreadProcessingMarker(marker);
    applyCollabThreadProcessingFromProjection(
      "shared:t1",
      baseProjection("awaiting-approval"),
    );
    expect(marker).toHaveBeenCalledWith("shared:t1", true);
    applyCollabThreadProcessingFromProjection(
      "shared:t1",
      baseProjection("succeeded"),
    );
    expect(marker).toHaveBeenCalledWith("shared:t1", false);
    applyCollabThreadProcessingFromProjection("shared:t1", null);
    expect(marker).toHaveBeenCalledWith("shared:t1", false);
  });

  it("restoreCollabThreadProcessingIfActive only lights active runs", () => {
    const marker = vi.fn();
    registerCollabThreadProcessingMarker(marker);

    restoreCollabThreadProcessingIfActive(
      "shared:t1",
      baseProjection("implementing"),
    );
    expect(marker).toHaveBeenCalledWith("shared:t1", true);

    marker.mockClear();
    restoreCollabThreadProcessingIfActive(
      "shared:t1",
      baseProjection("succeeded"),
    );
    expect(marker).not.toHaveBeenCalled();

    restoreCollabThreadProcessingIfActive("shared:t1", null);
    expect(marker).not.toHaveBeenCalled();
  });
});
