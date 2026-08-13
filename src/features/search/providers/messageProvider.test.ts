import { describe, expect, it } from "vitest";
import { searchMessages } from "./messageProvider";

describe("searchMessages", () => {
  it("searches messages from the active workspace thread set", () => {
    const results = searchMessages({
      query: "hello",
      workspaceId: "ws-a",
      threads: [
        { id: "t-1", name: "Build", updatedAt: 2 },
        { id: "t-2", name: "Ops", updatedAt: 1 },
      ],
      threadItemsByThread: {
        "t-1": [{ id: "m1", kind: "message", role: "user", text: "hello mossx" }],
        "t-2": [{ id: "m2", kind: "message", role: "assistant", text: "no hit" }],
        "t-x": [{ id: "m3", kind: "message", role: "assistant", text: "hello from other ws" }],
      },
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.threadId).toBe("t-1");
    expect(results[0]?.kind).toBe("message");
  });

  it("does not search sidebar threads that were never opened", () => {
    const results = searchMessages({
      query: "secret",
      workspaceId: "ws-a",
      threads: [
        { id: "open", name: "Open", updatedAt: 2 },
        { id: "closed", name: "Closed", updatedAt: 3 },
      ],
      threadItemsByThread: {
        open: [{ id: "m1", kind: "message", role: "user", text: "visible" }],
      },
    });
    expect(results).toEqual([]);
  });

  it("preserves case-insensitive matching with cached normalized text", () => {
    const threadItemsByThread = {
      "t-1": [{ id: "m1", kind: "message", role: "user", text: "Hello MossX" }],
    } satisfies Parameters<typeof searchMessages>[0]["threadItemsByThread"];
    const options = {
      workspaceId: "ws-a",
      threads: [{ id: "t-1", name: "Build", updatedAt: 2 }],
      threadItemsByThread,
    };

    const lower = searchMessages({ ...options, query: "hello" });
    const upper = searchMessages({ ...options, query: "HELLO" });

    expect(upper).toEqual(lower);
  });
});
