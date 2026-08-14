import { describe, expect, it } from "vitest";

import { buildWorkspaceSessionSelectionKey } from "../../settings/components/settings-view/hooks/useWorkspaceSessionCatalog";
import {
  SESSION_CATALOG_INITIAL_PAGE_SIZE,
  THREAD_LIST_INITIAL_PAGE_SIZE,
  THREAD_LIST_INITIAL_TARGET_COUNT,
  THREAD_LIST_LOAD_OLDER_PAGE_SIZE,
  THREAD_LIST_LOAD_OLDER_TARGET_COUNT,
  decodeSessionIndexThreadListCursor,
  decodeThreadListCursorState,
  encodeSessionIndexThreadListCursor,
  normalizeProjectCatalogSession,
  resolveInitialThreadListTargetCount,
  resolveThreadListCursorForDisplay,
} from "./useThreadActions.threadList";
import type { WorkspaceInfo } from "../../../types";

describe("useThreadActions.threadList", () => {
  it("preserves additive catalog source fields during normalization", () => {
    expect(
      normalizeProjectCatalogSession({
        sessionId: "claude:session-1",
        stableSessionKey: "claude:child-ws:session-1",
        canonicalSessionId: "session-1",
        workspaceId: "child-ws",
        matchedWorkspaceId: "child-ws",
        engine: "claude",
        title: "Child workspace session",
        nativeTitle: "Agent 12",
        updatedAt: 1_730_500_000_000,
        sourceCompleteness: "complete",
        sourceStatusReason: null,
        folderId: "folder-1",
      }),
    ).toMatchObject({
      sessionId: "claude:session-1",
      stableSessionKey: "claude:child-ws:session-1",
      workspaceId: "child-ws",
      matchedWorkspaceId: "child-ws",
      engine: "claude",
      nativeTitle: "Agent 12",
      sourceCompleteness: "complete",
      sourceStatusReason: null,
      folderId: "folder-1",
    });
  });

  it("keeps provider continuation lineage separate from parentSessionId", () => {
    expect(
      normalizeProjectCatalogSession({
        sessionId: "target-1",
        workspaceId: "ws-1",
        engine: "codex",
        title: "Continued session",
        updatedAt: 1,
        parentSessionId: null,
        originKind: "provider-continuation",
        sourceSessionId: "claude:source-1",
        familyId: "claude:ws-1:source-1",
        familyRootSessionId: "claude:ws-1:source-1",
        lineageParentSessionId: "claude:source-1",
        lineageKind: "provider-continuation",
        lineageDepth: 1,
      }),
    ).toMatchObject({
      parentSessionId: null,
      originKind: "provider-continuation",
      sourceSessionId: "claude:source-1",
      lineageParentSessionId: "claude:source-1",
      lineageDepth: 1,
    });
  });

  it("keeps sidebar and Session Management keys aligned for aggregate child rows", () => {
    const catalogEntry = {
      sessionId: "claude:session-1",
      stableSessionKey: "claude:child-ws:session-1",
      canonicalSessionId: "session-1",
      workspaceId: "child-ws",
      matchedWorkspaceId: "child-ws",
      engine: "claude",
      title: "Child workspace session",
      updatedAt: 1_730_500_000_000,
      sourceCompleteness: "complete",
      sourceStatusReason: null,
      folderId: "folder-1",
    };

    const sidebarSession = normalizeProjectCatalogSession(catalogEntry);

    expect(sidebarSession).toMatchObject({
      sessionId: "claude:session-1",
      stableSessionKey: "claude:child-ws:session-1",
      workspaceId: "child-ws",
    });
    expect(buildWorkspaceSessionSelectionKey(catalogEntry)).toBe(
      "child-ws::claude:child-ws:session-1",
    );
  });

  it("normalizes optional catalog strings and rejects invalid source completeness", () => {
    expect(
      normalizeProjectCatalogSession({
        sessionId: " claude:session-2 ",
        stableSessionKey: " claude:child-ws:session-2 ",
        workspaceId: " child-ws ",
        matchedWorkspaceId: "",
        engine: " claude ",
        title: " Session with whitespace ",
        updatedAt: Number.POSITIVE_INFINITY,
        sourceCompleteness: "definitely_empty",
        sourceStatusReason: " ",
        folderId: " folder-1 ",
      }),
    ).toMatchObject({
      sessionId: "claude:session-2",
      stableSessionKey: "claude:child-ws:session-2",
      workspaceId: "child-ws",
      matchedWorkspaceId: null,
      engine: "claude",
      updatedAt: 0,
      sourceCompleteness: null,
      sourceStatusReason: null,
      folderId: "folder-1",
    });
  });

  it("does not expose load-older cursor for catalog partial source without next cursor", () => {
    expect(
      resolveThreadListCursorForDisplay({
        catalogCursor: null,
        catalogPartialSource: "claude-scan-cap-reached",
        runtimeCursor: null,
      }),
    ).toBeNull();
    expect(
      resolveThreadListCursorForDisplay({
        catalogCursor: "offset:200",
        catalogPartialSource: "claude-scan-cap-reached",
        runtimeCursor: null,
      }),
    ).toBe("catalog::offset:200");
  });

  it("synthesizes a session-index cursor only when SQLite has more rows", () => {
    const oldestKey = { updatedAt: 4000, sessionId: "row-20" };
    // Index has older rows beyond the current page → session-index keyset cursor.
    expect(
      resolveThreadListCursorForDisplay({
        catalogCursor: null,
        catalogPartialSource: null,
        runtimeCursor: null,
        sessionIndexTotalCount: 120,
        sessionIndexRowCount: 20,
        sessionIndexOldestKey: oldestKey,
      }),
    ).toBe("session-index::4000:row-20");
    // Fully covered → no cursor.
    expect(
      resolveThreadListCursorForDisplay({
        catalogCursor: null,
        catalogPartialSource: null,
        runtimeCursor: null,
        sessionIndexTotalCount: 20,
        sessionIndexRowCount: 20,
        sessionIndexOldestKey: oldestKey,
      }),
    ).toBeNull();
    // Missing oldest key → no cursor (nothing to page from).
    expect(
      resolveThreadListCursorForDisplay({
        catalogCursor: null,
        catalogPartialSource: null,
        runtimeCursor: null,
        sessionIndexTotalCount: 120,
        sessionIndexRowCount: 20,
        sessionIndexOldestKey: null,
      }),
    ).toBeNull();
    // Catalog/runtime cursors win over the index fallback.
    expect(
      resolveThreadListCursorForDisplay({
        catalogCursor: "offset:200",
        catalogPartialSource: null,
        runtimeCursor: null,
        sessionIndexTotalCount: 500,
        sessionIndexRowCount: 20,
        sessionIndexOldestKey: oldestKey,
      }),
    ).toBe("catalog::offset:200");
    expect(
      resolveThreadListCursorForDisplay({
        catalogCursor: null,
        catalogPartialSource: null,
        runtimeCursor: "rt-1",
        sessionIndexTotalCount: 500,
        sessionIndexRowCount: 20,
        sessionIndexOldestKey: oldestKey,
      }),
    ).toBe("runtime::rt-1");
  });

  it("round-trips session-index keyset cursors (sessionId may contain colons)", () => {
    expect(decodeThreadListCursorState("session-index::4000:row-20")).toEqual({
      source: "session-index",
      cursor: "4000:row-20",
    });
    const key = { updatedAt: 4000, sessionId: "ns:row-20" };
    const encoded = encodeSessionIndexThreadListCursor(key);
    expect(encoded).toBe("session-index::4000:ns:row-20");
    expect(decodeThreadListCursorState(encoded)).toEqual({
      source: "session-index",
      cursor: "4000:ns:row-20",
    });
    expect(decodeSessionIndexThreadListCursor("4000:ns:row-20")).toEqual(key);
    expect(decodeSessionIndexThreadListCursor("")).toBeNull();
    expect(decodeSessionIndexThreadListCursor("abc")).toBeNull();
  });

  it("first-paint list target defaults to 5 and stays smaller than load-older batches", () => {
    expect(THREAD_LIST_INITIAL_TARGET_COUNT).toBe(5);
    expect(THREAD_LIST_INITIAL_PAGE_SIZE).toBe(5);
    expect(SESSION_CATALOG_INITIAL_PAGE_SIZE).toBe(5);
    expect(THREAD_LIST_LOAD_OLDER_TARGET_COUNT).toBe(50);
    expect(THREAD_LIST_LOAD_OLDER_PAGE_SIZE).toBe(50);

    const workspace = {
      id: "ws-1",
      name: "ws",
      path: "/tmp/ws",
      connected: true,
      settings: { sidebarCollapsed: false },
    } as WorkspaceInfo;
    expect(resolveInitialThreadListTargetCount(workspace)).toBe(5);
  });
});
