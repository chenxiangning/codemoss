import { describe, expect, it, beforeEach } from "vitest";
import {
  clearCollabWorkerNativeHideIds,
  getCollabWorkerNativeHideIds,
  isCollabWorkerNativeThreadId,
  rememberCollabWorkerNativeThreadId,
} from "./collabNativeHideRegistry";

describe("collabNativeHideRegistry", () => {
  beforeEach(() => {
    clearCollabWorkerNativeHideIds();
  });

  it("expands bare uuid to engine-prefixed hide ids", () => {
    rememberCollabWorkerNativeThreadId("019fd727-2a93-7f51-802e-ca817573d8e8");
    const hide = getCollabWorkerNativeHideIds();
    expect(hide.has("019fd727-2a93-7f51-802e-ca817573d8e8")).toBe(true);
    expect(hide.has("codex:019fd727-2a93-7f51-802e-ca817573d8e8")).toBe(true);
    expect(
      isCollabWorkerNativeThreadId("codex:019fd727-2a93-7f51-802e-ca817573d8e8"),
    ).toBe(true);
  });

  it("ignores agent-canvas and shared ids", () => {
    rememberCollabWorkerNativeThreadId("agent-canvas:shared:x:attempt");
    rememberCollabWorkerNativeThreadId("shared:sess");
    expect(getCollabWorkerNativeHideIds().size).toBe(0);
  });

  it("remembers codex: prefixed worker ids for Agent N rename path", () => {
    rememberCollabWorkerNativeThreadId("codex:worker-1");
    expect(isCollabWorkerNativeThreadId("codex:worker-1")).toBe(true);
    expect(isCollabWorkerNativeThreadId("worker-1")).toBe(true);
  });
});
