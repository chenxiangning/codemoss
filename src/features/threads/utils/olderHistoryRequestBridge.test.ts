import { describe, expect, it } from "vitest";
import {
  requestOlderHistory,
  setOlderHistoryRequester,
} from "./olderHistoryRequestBridge";

describe("olderHistoryRequestBridge", () => {
  it("returns false when no requester is bound", () => {
    setOlderHistoryRequester(null);
    expect(requestOlderHistory("shared:1")).toBe(false);
  });

  it("forwards to the bound requester", () => {
    const seen: string[] = [];
    setOlderHistoryRequester((threadId) => {
      seen.push(threadId);
      return true;
    });
    expect(requestOlderHistory("shared:2")).toBe(true);
    expect(seen).toEqual(["shared:2"]);
    setOlderHistoryRequester(null);
  });
});
