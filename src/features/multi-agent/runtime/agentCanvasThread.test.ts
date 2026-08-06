import { describe, expect, it } from "vitest";

import {
  buildAgentCanvasThreadId,
  isAgentCanvasThreadId,
  parseAgentCanvasThreadId,
} from "./agentCanvasThread";

describe("agentCanvasThread", () => {
  it("builds and parses agent-canvas thread ids", () => {
    const id = buildAgentCanvasThreadId(
      "shared:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      "attempt-stage-1",
    );
    expect(isAgentCanvasThreadId(id)).toBe(true);
    expect(parseAgentCanvasThreadId(id)).toEqual({
      sharedThreadId: "shared:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      attemptId: "attempt-stage-1",
    });
  });

  it("returns empty when inputs missing", () => {
    expect(buildAgentCanvasThreadId("", "a")).toBe("");
    expect(buildAgentCanvasThreadId("shared:x", "")).toBe("");
  });
});
