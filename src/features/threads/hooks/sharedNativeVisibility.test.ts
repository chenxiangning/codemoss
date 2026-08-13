import { afterEach, describe, expect, it } from "vitest";
import {
  expandVisibilityHideSet,
  hasVerifiedSharedHide,
  hiddenIdsFromVisibilityProjection,
  isFullyVerifiedSharedNativeVisibility,
  isUsableSharedNativeVisibility,
  lastVerifiedSharedHide,
  mergePreservedSharedThreadsForIndexFirstPaint,
  rememberVerifiedSharedHide,
  rememberVerifiedSharedHideIfComplete,
  resetSharedNativeVisibilityMemory,
  shouldExcludeOrdinaryNativeRow,
  strengthenVerifiedSharedHide,
  unionHideSets,
} from "./sharedNativeVisibility";
import type { ThreadSummary } from "../../../types";

afterEach(() => {
  resetSharedNativeVisibilityMemory();
});

describe("sharedNativeVisibility", () => {
  it("only treats fully verified projections as first-paint usable", () => {
    expect(
      isFullyVerifiedSharedNativeVisibility({
        available: true,
        freshness: "verified",
        hiddenNativeIds: [],
      }),
    ).toBe(true);
    expect(
      isUsableSharedNativeVisibility({
        available: true,
        freshness: "verified",
        hiddenNativeIds: [],
      }),
    ).toBe(true);
    expect(
      isUsableSharedNativeVisibility({
        available: true,
        freshness: "partial",
        hiddenNativeIds: ["native-1"],
        reason: "v2-readonly:busy",
      }),
    ).toBe(false);
    expect(
      isUsableSharedNativeVisibility({
        available: false,
        freshness: "unavailable",
        hiddenNativeIds: [],
      }),
    ).toBe(false);
  });

  it("expands raw and prefixed hidden ids and keeps shared rows visible", () => {
    const hide = expandVisibilityHideSet({
      available: true,
      hiddenNativeIds: ["abc-1"],
      protocolHiddenNativeIds: ["claude:pkg-1"],
    });
    expect(shouldExcludeOrdinaryNativeRow("claude:abc-1", hide)).toBe(true);
    expect(shouldExcludeOrdinaryNativeRow("abc-1", hide)).toBe(true);
    expect(shouldExcludeOrdinaryNativeRow("claude:pkg-1", hide)).toBe(true);
    expect(shouldExcludeOrdinaryNativeRow("shared:s1", hide)).toBe(false);
    expect(shouldExcludeOrdinaryNativeRow("claude:user-session", hide)).toBe(false);
  });

  it("remembers empty verified hide so later unavailable does not look like first sight", () => {
    rememberVerifiedSharedHide("ws-1", new Set());
    expect(hasVerifiedSharedHide("ws-1")).toBe(true);
    expect(lastVerifiedSharedHide("ws-1").size).toBe(0);
    expect(hasVerifiedSharedHide("ws-missing")).toBe(false);
  });

  it("unions hide sets without dropping prior verified ids", () => {
    const merged = unionHideSets(new Set(["old-1"]), ["claude:new-1"]);
    expect(merged.has("old-1")).toBe(true);
    expect(merged.has("claude:old-1")).toBe(true);
    expect(merged.has("claude:new-1")).toBe(true);
    expect(merged.has("new-1")).toBe(true);
  });

  it("collects protocol hidden ids from the projection payload", () => {
    expect(
      hiddenIdsFromVisibilityProjection({
        available: true,
        hiddenNativeIds: ["bind-1"],
        protocolHiddenNativeIds: ["MOSSX-row"],
      }),
    ).toEqual(["bind-1", "MOSSX-row"]);
  });

  it("does not promote an incomplete hide set to last-verified", () => {
    rememberVerifiedSharedHideIfComplete(
      "ws-1",
      { available: false, freshness: "unavailable", hiddenNativeIds: ["collab-only"] },
      new Set(["collab-only"]),
    );
    expect(hasVerifiedSharedHide("ws-1")).toBe(false);
    rememberVerifiedSharedHide("ws-1", new Set(["old-1"]));
    strengthenVerifiedSharedHide("ws-1", new Set(["collab-only"]));
    expect(lastVerifiedSharedHide("ws-1").has("old-1")).toBe(true);
    expect(lastVerifiedSharedHide("ws-1").has("collab-only")).toBe(true);
  });

  it("keeps shared canonical rows when Index first-paint replaces natives", () => {
    const shared: ThreadSummary = {
      id: "shared:s1",
      name: "继续会话",
      updatedAt: 500,
      engineSource: "claude",
      threadKind: "shared",
    };
    const leakedNative: ThreadSummary = {
      id: "claude:owned-1",
      name: "Claude Session",
      updatedAt: 400,
      engineSource: "claude",
      threadKind: "native",
    };
    const indexNative: ThreadSummary = {
      id: "claude:user-1",
      name: "用户会话",
      updatedAt: 300,
      engineSource: "claude",
      threadKind: "native",
    };
    const merged = mergePreservedSharedThreadsForIndexFirstPaint(
      [indexNative],
      [shared, leakedNative],
    );
    expect(merged.map((row) => row.id)).toEqual(["shared:s1", "claude:user-1"]);
  });
});
