import { describe, expect, it } from "vitest";
import {
  isMissingSharedSessionMetaError,
  shouldSuppressSharedTargetPersistToast,
} from "./sharedTargetPersistErrors";

describe("sharedTargetPersistErrors", () => {
  it("detects ENOENT-style meta missing errors", () => {
    expect(
      isMissingSharedSessionMetaError(
        new Error("No such file or directory (os error 2)"),
      ),
    ).toBe(true);
    expect(isMissingSharedSessionMetaError(new Error("disk unavailable"))).toBe(
      false,
    );
  });

  it("suppresses toast when the user already left the session", () => {
    expect(
      shouldSuppressSharedTargetPersistToast(new Error("disk unavailable"), {
        persistWorkspaceId: "ws-1",
        persistThreadId: "shared:a",
        activeWorkspaceId: "ws-2",
        activeThreadId: "shared:a",
      }),
    ).toBe(true);
    expect(
      shouldSuppressSharedTargetPersistToast(new Error("disk unavailable"), {
        persistWorkspaceId: "ws-1",
        persistThreadId: "shared:a",
        activeWorkspaceId: "ws-1",
        activeThreadId: "shared:b",
      }),
    ).toBe(true);
  });

  it("suppresses toast for missing meta even on the same session", () => {
    expect(
      shouldSuppressSharedTargetPersistToast(
        new Error("No such file or directory (os error 2)"),
        {
          persistWorkspaceId: "ws-1",
          persistThreadId: "shared:a",
          activeWorkspaceId: "ws-1",
          activeThreadId: "shared:a",
        },
      ),
    ).toBe(true);
  });

  it("keeps toast for real failures while still on the same session", () => {
    expect(
      shouldSuppressSharedTargetPersistToast(new Error("disk unavailable"), {
        persistWorkspaceId: "ws-1",
        persistThreadId: "shared:a",
        activeWorkspaceId: "ws-1",
        activeThreadId: "shared:a",
      }),
    ).toBe(false);
  });
});
