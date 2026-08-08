import { describe, expect, it } from "vitest";

import { multiAgentContextBlockReason } from "./contextGate";

describe("multiAgentContextBlockReason (Context Fan-in §8.6)", () => {
  it("never blocks skill / memory / note-cards / memory-reference", () => {
    expect(
      multiAgentContextBlockReason({
        noteCardIds: ["n1", "n2"],
        memoryIds: ["m1"],
        memoryReferenceEnabled: true,
        skillNames: ["code-review", "docs"],
      }),
    ).toBeNull();
  });

  it("returns null when empty", () => {
    expect(
      multiAgentContextBlockReason({
        noteCardIds: [],
        memoryIds: [],
        memoryReferenceEnabled: false,
        skillNames: [],
      }),
    ).toBeNull();
  });
});
