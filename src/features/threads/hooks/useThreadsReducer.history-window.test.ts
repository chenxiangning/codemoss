import { describe, expect, it } from "vitest";
import { initialState, threadReducer } from "./useThreadsReducer";

describe("threadReducer history window", () => {
  it("prepends older items without dropping the current turn", () => {
    const withWindow = threadReducer(initialState, {
      type: "setThreadItems",
      threadId: "claude:sess",
      items: [
        {
          id: "user-now",
          kind: "message",
          role: "user",
          text: "current question",
        },
        {
          id: "assistant-now",
          kind: "message",
          role: "assistant",
          text: "current answer",
        },
      ],
    });
    const prepended = threadReducer(withWindow, {
      type: "prependThreadItems",
      threadId: "claude:sess",
      items: [
        {
          id: "user-old",
          kind: "message",
          role: "user",
          text: "older question",
        },
        {
          id: "user-now",
          kind: "message",
          role: "user",
          text: "should be ignored duplicate",
        },
      ],
    });
    const ids = prepended.itemsByThread["claude:sess"]?.map((item) => item.id);
    expect(ids).toEqual(["user-old", "user-now", "assistant-now"]);
  });

  it("records a truncated history window without assembling a full transcript", () => {
    const next = threadReducer(initialState, {
      type: "setThreadHistoryWindow",
      threadId: "claude:sess",
      hasMore: true,
      nextCursor: "1024",
    });
    expect(next.historyWindowByThread["claude:sess"]).toEqual({
      hasMore: true,
      nextCursor: "1024",
    });
    expect(next.itemsByThread["claude:sess"]).toBeUndefined();
  });
});
