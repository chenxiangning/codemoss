import { describe, expect, it } from "vitest";
import {
  mergeSessionIndexRowsIntoSummaries,
  sessionIndexRowToThreadId,
  sessionIndexRowsToThreadSummaries,
} from "./sessionIndexThreadSummaries";

describe("sessionIndexThreadSummaries", () => {
  it("maps claude/codex/kimi rows to thread ids", () => {
    expect(
      sessionIndexRowToThreadId({
        engine: "claude",
        sessionId: "abc",
        title: "hi",
        updatedAt: 1,
      }),
    ).toBe("claude:abc");
    expect(
      sessionIndexRowToThreadId({
        engine: "codex",
        sessionId: "uuid-1",
        title: "hi",
        updatedAt: 1,
      }),
    ).toBe("uuid-1");
    expect(
      sessionIndexRowToThreadId({
        engine: "kimi",
        sessionId: "k1",
        title: "hi",
        updatedAt: 1,
      }),
    ).toBe("kimi:k1");
  });

  it("builds thread summaries with custom titles", () => {
    const rows = sessionIndexRowsToThreadSummaries(
      [
        {
          engine: "claude",
          sessionId: "s1",
          title: "First prompt",
          updatedAt: 100,
          sizeBytes: 12,
        },
      ],
      {
        workspaceId: "ws",
        mappedTitles: {},
        getCustomName: () => "",
      },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("claude:s1");
    expect(rows[0]?.engineSource).toBe("claude");
    expect(rows[0]?.name).toContain("First");
  });

  it("merges without dropping newer live rows", () => {
    const merged = mergeSessionIndexRowsIntoSummaries(
      [
        {
          id: "claude:s1",
          name: "Live name",
          updatedAt: 200,
          engineSource: "claude",
          threadKind: "native",
        },
      ],
      [
        {
          engine: "claude",
          sessionId: "s1",
          title: "Index older",
          updatedAt: 100,
        },
        {
          engine: "codex",
          sessionId: "c1",
          title: "Codex from index",
          updatedAt: 150,
        },
      ],
      {
        workspaceId: "ws",
        mappedTitles: {},
        getCustomName: () => "",
      },
    );
    const byId = new Map(merged.map((row) => [row.id, row]));
    expect(byId.get("claude:s1")?.name).toBe("Live name");
    expect(byId.get("c1")?.engineSource).toBe("codex");
  });

  it("hides Shared-owned and protocol-hidden index rows before first paint", () => {
    const rows = sessionIndexRowsToThreadSummaries(
      [
        {
          engine: "claude",
          sessionId: "owned-1",
          title: "Claude Session",
          updatedAt: 10,
        },
        {
          engine: "claude",
          sessionId: "user-1",
          title: "Claude Session",
          updatedAt: 9,
        },
      ],
      {
        workspaceId: "ws",
        mappedTitles: {},
        getCustomName: () => "",
        hiddenSharedBindingIds: new Set(["claude:owned-1", "owned-1"]),
      },
    );
    expect(rows.map((row) => row.id)).toEqual(["claude:user-1"]);
  });

  it("never hides a shared canonical row via the owner predicate", () => {
    const rows = sessionIndexRowsToThreadSummaries(
      [
        {
          engine: "claude",
          sessionId: "shared:s1",
          title: "Shared Session",
          updatedAt: 3,
        },
      ],
      {
        workspaceId: "ws",
        mappedTitles: {},
        getCustomName: () => "",
        hiddenSharedBindingIds: new Set(["shared:s1"]),
      },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("shared:s1");
  });
});
