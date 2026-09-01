import { describe, expect, it } from "vitest";
import { projectOmpEvent, projectOmpEvents } from "./ompProjection";

describe("OMP event projection", () => {
  it("keeps RPC control events outside conversation", () => {
    expect(projectOmpEvent({ type: "ready" })).toEqual({
      kind: "control",
      event: "ready",
      payload: { type: "ready" },
    });
    expect(projectOmpEvent({ type: "extension_ui_request" })).toMatchObject({
      kind: "control",
      event: "extensionUi",
    });
    expect(projectOmpEvent({ type: "available_commands_update" })).toMatchObject({
      kind: "control",
      event: "commands",
    });
  });

  it("projects ACP session updates into canonical conversation events", () => {
    expect(
      projectOmpEvents([
        { method: "session/update", params: { update: { sessionUpdate: "agent_message_chunk" } } },
        { method: "session/update", params: { update: { sessionUpdate: "agent_thought_chunk" } } },
        { method: "session/update", params: { update: { sessionUpdate: "tool_call" } } },
        { method: "session/update", params: { update: { sessionUpdate: "tool_result" } } },
        { method: "session/update", params: { update: { sessionUpdate: "turn_complete" } } },
        { method: "session/update", params: { update: { sessionUpdate: "tool_call_update" } } },
        { method: "session/finished" },
      ]),
    ).toEqual([
      expect.objectContaining({ kind: "conversation", event: "textDelta" }),
      expect.objectContaining({ kind: "conversation", event: "reasoningDelta" }),
      expect.objectContaining({ kind: "conversation", event: "toolStarted" }),
      expect.objectContaining({ kind: "conversation", event: "toolCompleted" }),
      expect.objectContaining({ kind: "conversation", event: "terminal" }),
      expect.objectContaining({ kind: "conversation", event: "toolCompleted" }),
      expect.objectContaining({ kind: "conversation", event: "terminal" }),
    ]);
  });

  it("fails closed for inherited and unknown control types", () => {
    expect(projectOmpEvent({ type: "constructor" })).toMatchObject({
      kind: "control",
      event: "other",
    });
    expect(projectOmpEvent({ type: "__proto__" })).toMatchObject({
      kind: "control",
      event: "other",
    });
  });

  it("does not invent conversation semantics for unknown control frames", () => {
    expect(projectOmpEvent({ type: "unknown" })).toMatchObject({
      kind: "control",
      event: "other",
    });
  });
});
