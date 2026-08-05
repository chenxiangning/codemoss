// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import type { SquadProjectionV1 } from "../types";
import {
  emitSquadConversationItems,
  SQUAD_CONVERSATION_ITEM_EVENT,
  subscribeSquadConversationItems,
} from "./squadConversationBridge";

function projection(status: SquadProjectionV1["status"]): SquadProjectionV1 {
  return {
    schemaVersion: 1,
    runId: "run-1",
    workspaceId: "workspace-id",
    workspaceRoot: "/workspace",
    sessionId: "session-1",
    requestText: "Implement the feature",
    leadTarget: {
      engine: "codex",
      providerProfileId: null,
      modelCatalogEntryId: "gpt-5",
      model: "gpt-5",
      providerProfileNameSnapshot: "Local",
      providerProfileSource: "local",
    },
    status,
    planRevision: 1,
    plan: {
      schemaVersion: 1,
      summary: "plan",
      budget: {
        maxParallelReadOnly: 2,
        maxNodeAttempts: 2,
        maxRepairAttempts: 1,
        maxWallClockSeconds: 300,
      },
      nodes: [],
      finalNodeId: "final",
    },
    nodes: [
      {
        node: {
          id: "final",
          title: "Final",
          kind: "synthesize",
          goal: "Summarize",
          dependsOn: [],
          target: {
            engine: "codex",
            providerProfileId: null,
            modelCatalogEntryId: "gpt-5",
            model: "gpt-5",
            providerProfileNameSnapshot: "Local",
            providerProfileSource: "local",
          },
          permission: "read-only",
          maxAttempts: 1,
          successCriteria: ["done"],
        },
        status: status === "succeeded" ? "succeeded" : "pending",
        attempts: [],
        outcome:
          status === "succeeded"
            ? {
                schemaVersion: 1,
                status: "succeeded",
                summary: "Final answer",
                evidence: [],
                artifacts: [],
                changedPaths: [],
                verification: {
                  status: "not-run",
                  checks: [],
                  failures: [],
                },
                proposedRepairs: [],
                extra: {},
              }
            : null,
        diagnostics: [],
      },
    ],
    activeAttemptIds: [],
    diagnostics: [],
    requestedAt: 1,
    approvedAt: 2,
    updatedAt: 3,
  };
}

describe("Squad conversation bridge", () => {
  it("publishes stable canonical ids and exposes the final only on success", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSquadConversationItems(listener);

    emitSquadConversationItems("workspace-id", "shared:session-1", projection("running"));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0].item).toMatchObject({
      id: "squad:run-1:user",
      role: "user",
    });

    emitSquadConversationItems("workspace-id", "shared:session-1", projection("succeeded"));
    expect(listener).toHaveBeenCalledTimes(3);
    expect(listener.mock.calls[2]?.[0].item).toMatchObject({
      id: "squad:run-1:assistant",
      role: "assistant",
      text: "Final answer",
    });
    unsubscribe();
  });

  it("ignores malformed external events", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeSquadConversationItems(listener);
    window.dispatchEvent(
      new CustomEvent(SQUAD_CONVERSATION_ITEM_EVENT, {
        detail: { workspaceId: "workspace-id", threadId: "native:thread" },
      }),
    );
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
