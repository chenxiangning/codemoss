import { describe, expect, it } from "vitest";
import {
  MESSAGE_SEARCH_MAX_OPEN_THREADS,
  resolveMessageSearchThreadIds,
} from "./messageSearchScope";

describe("resolveMessageSearchThreadIds", () => {
  it("ignores sidebar threads that were never opened", () => {
    const ids = resolveMessageSearchThreadIds({
      threads: [
        { id: "open", updatedAt: 2 },
        { id: "closed", updatedAt: 3 },
      ],
      threadItemsByThread: {
        open: [{ id: "m1", kind: "message", role: "user", text: "hello" }],
      },
    });
    expect(ids).toEqual(["open"]);
  });

  it("always includes the active thread even when its items are empty", () => {
    const ids = resolveMessageSearchThreadIds({
      threads: [
        { id: "active", updatedAt: 1 },
        { id: "open", updatedAt: 2 },
      ],
      threadItemsByThread: {
        open: [{ id: "m1", kind: "message", role: "user", text: "hello" }],
      },
      activeThreadId: "active",
    });
    expect(ids).toEqual(["active", "open"]);
  });

  it("caps opened threads so search cannot scan every loaded transcript", () => {
    const threads = Array.from({ length: 20 }, (_, index) => ({
      id: `t-${index}`,
      updatedAt: index,
    }));
    const threadItemsByThread = Object.fromEntries(
      threads.map((thread) => [
        thread.id,
        [
          {
            id: `${thread.id}-m`,
            kind: "message" as const,
            role: "user" as const,
            text: "x",
          },
        ],
      ]),
    );
    const ids = resolveMessageSearchThreadIds({
      threads,
      threadItemsByThread,
      activeThreadId: "t-0",
    });
    expect(ids[0]).toBe("t-0");
    expect(ids).toHaveLength(MESSAGE_SEARCH_MAX_OPEN_THREADS);
    expect(ids).not.toContain("t-1");
  });
});
