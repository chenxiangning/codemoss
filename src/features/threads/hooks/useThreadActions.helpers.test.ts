import { describe, expect, it } from "vitest";

import type { ConversationItem, ThreadSummary } from "../../../types";
import {
  buildHiddenAutomaticSessionIdSet,
  filterHiddenAutomaticThreadSummaries,
  isRetainableEngineContinuitySummary,
  mergeCodexCatalogSessionSummaries,
  mergeDegradedClaudeContinuitySummaries,
  mergeDegradedCodexContinuitySummaries,
  mergeGeminiSessionSummaries,
  mergeGrokSessionSummaries,
  mergeKimiSessionSummaries,
  mergeThreadSummaryPreservingStableIdentity,
  resolveThreadSourceMeta,
  seedLastGoodEngineIntoMerged,
  selectRecoveredNewThreadDecision,
  selectRecoveredNewThreadSummary,
  selectReplacementThreadDecision,
  selectReplacementThreadByMessageHistory,
  selectReplacementThreadByMessageHistoryDecision,
  stripHiddenSharedBindingSummaries,
  threadIdMatchesHiddenAutomaticSessionSet,
} from "./useThreadActions.helpers";

describe("useThreadActions.helpers", () => {
  it("matches hidden automatic session ids across alias forms", () => {
    const hiddenIds = buildHiddenAutomaticSessionIdSet([
      "claude:f87d3167-23d4-47a8-a273-43eb9bd57f8a:2b325056-0242-4450-a18e-1b7b29f718c1",
      "codex:019fbdf3-fd7d-7422-acf1-900c7361a0ef",
    ]);

    expect(
      threadIdMatchesHiddenAutomaticSessionSet(
        "claude:2b325056-0242-4450-a18e-1b7b29f718c1",
        hiddenIds,
      ),
    ).toBe(true);
    expect(
      threadIdMatchesHiddenAutomaticSessionSet(
        "2b325056-0242-4450-a18e-1b7b29f718c1",
        hiddenIds,
      ),
    ).toBe(true);
    expect(
      threadIdMatchesHiddenAutomaticSessionSet(
        "019fbdf3-fd7d-7422-acf1-900c7361a0ef",
        hiddenIds,
      ),
    ).toBe(true);
    expect(
      threadIdMatchesHiddenAutomaticSessionSet("claude:user-visible", hiddenIds),
    ).toBe(false);
  });

  it("filters native sidebar rows that lack autoSession but match hidden ids", () => {
    const hiddenIds = buildHiddenAutomaticSessionIdSet([
      "claude:2b325056-0242-4450-a18e-1b7b29f718c1",
    ]);
    const filtered = filterHiddenAutomaticThreadSummaries(
      [
        {
          id: "claude:2b325056-0242-4450-a18e-1b7b29f718c1",
          name: "Please generate a commit message",
          autoSession: null,
        },
        {
          id: "claude:user-visible",
          name: "审查 PR",
          autoSession: null,
        },
        {
          id: "codex:helper",
          name: "helper",
          autoSession: {
            sessionPurpose: "commit-message",
            visibility: "hidden",
            ownerFeature: "git",
            autoArchive: true,
            createdBy: "system",
          },
        },
      ],
      hiddenIds,
    );

    expect(filtered.map((row) => row.id)).toEqual(["claude:user-visible"]);
  });

  it("projects provider continuation at the top level without parentThreadId", () => {
    const [continuation] = mergeCodexCatalogSessionSummaries(
      [],
      [
        {
          sessionId: "target-1",
          workspaceId: "ws-1",
          title: "Continued session",
          updatedAt: 1,
          engine: "codex",
          originKind: "provider-continuation",
          sourceSessionId: "claude:source-1",
          familyId: "claude:ws-1:source-1",
          familyRootSessionId: "claude:ws-1:source-1",
          lineageParentSessionId: "claude:source-1",
          lineageKind: "provider-continuation",
          lineageDepth: 1,
        },
      ],
      "ws-1",
      {},
      () => undefined,
    );

    expect(continuation).toMatchObject({
      id: "target-1",
      parentThreadId: null,
      originKind: "provider-continuation",
      sourceSessionId: "claude:source-1",
      lineageParentSessionId: "claude:source-1",
    });
  });

  it("replaces a continuation protocol title with readable source lineage", () => {
    const summaries = mergeCodexCatalogSessionSummaries(
      [
        {
          id: "claude:source-1",
          name: "修复登录问题",
          updatedAt: 1,
          engineSource: "claude",
        },
      ],
      [
        {
          sessionId: "codex:target-1",
          workspaceId: "ws-1",
          title:
            `MOSSX_CONTEXT_PACKAGE:sha256:${"a".repeat(64)}:` +
            `sha256:${"b".repeat(64)}`,
          updatedAt: 2,
          engine: "codex",
          originKind: "provider-continuation",
          sourceSessionId: "claude:source-1",
          providerProfileName: "Provider B",
        },
      ],
      "ws-1",
      {},
      () => undefined,
    );

    const source = summaries.find((thread) => thread.id === "claude:source-1");
    const continuation = summaries.find(
      (thread) => thread.id === "codex:target-1",
    );
    expect(source?.name).toBe("修复登录问题");
    expect(continuation?.name).toBe("继续：修复登录问题");
    expect(continuation?.name).not.toContain("MOSSX_");
  });

  it("maps Codex local fallback parentSessionId into parentThreadId", () => {
    expect(
      resolveThreadSourceMeta({
        source: "cli",
        parentSessionId: "parent-session",
      }),
    ).toEqual({
      source: "cli",
      provider: undefined,
      sourceLabel: "cli",
      parentThreadId: "parent-session",
    });
  });

  it("keeps quoted broken-pipe explanations in history matching", () => {
    const staleItems: ConversationItem[] = [
      {
        id: "user-1",
        kind: "message",
        role: "user",
        text: "继续",
      },
      {
        id: "assistant-1",
        kind: "message",
        role: "assistant",
        text: "Broken pipe (os error 32)\n\n结论先行：这是 stale session，需要重建 runtime。",
      },
    ];

    const candidateA: ThreadSummary = {
      id: "thread-a",
      name: "hi",
      updatedAt: 10,
      engineSource: "codex",
      threadKind: "native",
    };
    const candidateB: ThreadSummary = {
      id: "thread-b",
      name: "hi",
      updatedAt: 9,
      engineSource: "codex",
      threadKind: "native",
    };

    const matched = selectReplacementThreadByMessageHistory({
      staleItems,
      candidates: [
        {
          summary: candidateA,
          items: staleItems,
        },
        {
          summary: candidateB,
          items: [
            {
              id: "user-2",
              kind: "message",
              role: "user",
              text: "继续",
            },
          ],
        },
      ],
    });

    expect(matched?.id).toBe("thread-a");
  });

  it("selects the sole newly discovered replacement thread when generic summaries are ambiguous", () => {
    const staleSummary: ThreadSummary = {
      id: "thread-stale",
      name: "1",
      updatedAt: 100,
      engineSource: "codex",
      threadKind: "native",
    };
    const knownOlder: ThreadSummary = {
      id: "thread-known",
      name: "1",
      updatedAt: 90,
      engineSource: "codex",
      threadKind: "native",
    };
    const newlyRecovered: ThreadSummary = {
      id: "thread-recovered",
      name: "1",
      updatedAt: 101,
      engineSource: "codex",
      threadKind: "native",
    };

    const matched = selectRecoveredNewThreadSummary({
      staleThreadId: "thread-stale",
      staleSummary,
      previousSummaries: [staleSummary, knownOlder],
      summaries: [newlyRecovered, knownOlder, staleSummary],
    });

    expect(matched?.id).toBe("thread-recovered");
  });

  it("marks time-coherent newly discovered replacement as persistent", () => {
    const staleSummary: ThreadSummary = {
      id: "thread-stale",
      name: "1",
      updatedAt: 100,
      engineSource: "codex",
      threadKind: "native",
    };
    const recovered: ThreadSummary = {
      id: "thread-recovered",
      name: "1",
      updatedAt: 105,
      engineSource: "codex",
      threadKind: "native",
    };

    const decision = selectRecoveredNewThreadDecision({
      staleThreadId: "thread-stale",
      staleSummary,
      previousSummaries: [staleSummary],
      summaries: [staleSummary, recovered],
    });

    expect(decision.summary?.id).toBe("thread-recovered");
    expect(decision.isPersistent).toBe(true);
    expect(decision.featureSignals).toContain("time_window_coherent");
  });

  it("keeps strictly newer replacements outside the recovery window non-persistent", () => {
    const staleSummary: ThreadSummary = {
      id: "thread-stale",
      name: "1",
      updatedAt: 100,
      engineSource: "codex",
      threadKind: "native",
    };
    const previousCandidate: ThreadSummary = {
      id: "thread-previous",
      name: "Previous",
      updatedAt: 90,
      engineSource: "codex",
      threadKind: "native",
    };
    const recovered: ThreadSummary = {
      id: "thread-recovered",
      name: "Recovered much later",
      updatedAt: 100 + 25 * 60 * 60 * 1000,
      engineSource: "codex",
      threadKind: "native",
    };

    const decision = selectRecoveredNewThreadDecision({
      staleThreadId: "thread-stale",
      staleSummary,
      previousSummaries: [staleSummary, previousCandidate, recovered],
      summaries: [staleSummary, previousCandidate, recovered],
    });

    expect(decision.summary?.id).toBe("thread-recovered");
    expect(decision.reasonCode).toBe("low-confidence");
    expect(decision.featureSignals).toEqual(["strictly_newer_candidate"]);
    expect(decision.isPersistent).toBe(false);
  });

  it("keeps sole weak replacement candidates non-persistent", () => {
    const candidate: ThreadSummary = {
      id: "thread-only",
      name: "Unrelated",
      updatedAt: 10,
      engineSource: "codex",
      threadKind: "native",
    };

    const decision = selectReplacementThreadDecision({
      staleThreadId: "thread-stale",
      summaries: [candidate],
    });

    expect(decision.summary?.id).toBe("thread-only");
    expect(decision.reasonCode).toBe("low-confidence");
    expect(decision.isPersistent).toBe(false);
  });

  it("marks unique history-boundary matches as persistent", () => {
    const staleItems: ConversationItem[] = [
      {
        id: "user-1",
        kind: "message",
        role: "user",
        text: "继续写第二章",
      },
    ];
    const candidate: ThreadSummary = {
      id: "thread-history",
      name: "第二章",
      updatedAt: 10,
      engineSource: "codex",
      threadKind: "native",
    };

    const decision = selectReplacementThreadByMessageHistoryDecision({
      staleThreadId: "thread-stale",
      staleItems,
      candidates: [{ summary: candidate, items: staleItems }],
    });

    expect(decision.summary?.id).toBe("thread-history");
    expect(decision.strategy).toBe("history-match");
    expect(decision.isPersistent).toBe(true);
  });

  it("selects the sole strictly newer replacement thread when stale summary falls out of the current list", () => {
    const staleSummary: ThreadSummary = {
      id: "thread-stale",
      name: "",
      updatedAt: 100,
      engineSource: "codex",
      threadKind: "native",
    };
    const knownOlder: ThreadSummary = {
      id: "thread-known",
      name: "1",
      updatedAt: 90,
      engineSource: "codex",
      threadKind: "native",
    };
    const recovered: ThreadSummary = {
      id: "thread-recovered",
      name: "1",
      updatedAt: 105,
      engineSource: "codex",
      threadKind: "native",
    };

    const matched = selectRecoveredNewThreadSummary({
      staleThreadId: "thread-stale",
      staleSummary,
      previousSummaries: [knownOlder, recovered],
      summaries: [recovered, knownOlder],
    });

    expect(matched?.id).toBe("thread-recovered");
  });

  it("preserves real Claude subagent parent links from catalog sessions", () => {
    const merged = mergeCodexCatalogSessionSummaries(
      [
        {
          id: "claude:parent-session",
          name: "父会话",
          updatedAt: 100,
          engineSource: "claude",
          threadKind: "native",
        },
      ],
      [
        {
          sessionId: "claude:subagent:parent-session:a5e6403f261113239",
          title: "分析前端项目",
          updatedAt: 110,
          engine: "claude",
          parentSessionId: "claude:parent-session",
        },
      ],
      "workspace-1",
      {},
      () => undefined,
    );

    expect(
      merged.find((thread) => thread.id === "claude:subagent:parent-session:a5e6403f261113239")
        ?.parentThreadId,
    ).toBe("claude:parent-session");
  });

  it("normalizes bare Claude subagent parent links from catalog sessions", () => {
    const merged = mergeCodexCatalogSessionSummaries(
      [
        {
          id: "claude:parent-session",
          name: "父会话",
          updatedAt: 100,
          engineSource: "claude",
          threadKind: "native",
        },
      ],
      [
        {
          sessionId: "claude:subagent:parent-session:a5e6403f261113239",
          title: "分析前端项目",
          updatedAt: 110,
          engine: "claude",
          parentSessionId: "parent-session",
        },
      ],
      "workspace-1",
      {},
      () => undefined,
    );

    expect(
      merged.find((thread) => thread.id === "claude:subagent:parent-session:a5e6403f261113239")
        ?.parentThreadId,
    ).toBe("claude:parent-session");
  });

  it("does not let generic Claude catalog titles overwrite meaningful existing titles", () => {
    const merged = mergeCodexCatalogSessionSummaries(
      [
        {
          id: "claude:session-1",
          name: "稳定命名",
          updatedAt: 100,
          engineSource: "claude",
          threadKind: "native",
        },
      ],
      [
        {
          sessionId: "claude:session-1",
          title: "",
          updatedAt: 120,
          engine: "claude",
        },
      ],
      "workspace-1",
      {},
      () => undefined,
    );

    expect(merged.find((thread) => thread.id === "claude:session-1")?.name).toBe("稳定命名");
  });

  it("does not let ordinal Agent catalog titles overwrite meaningful existing titles", () => {
    const merged = mergeCodexCatalogSessionSummaries(
      [
        {
          id: "claude:session-1",
          name: "帮我审核一下这个 PR",
          updatedAt: 100,
          engineSource: "claude",
          threadKind: "native",
        },
      ],
      [
        {
          sessionId: "claude:session-1",
          title: "Agent 202",
          updatedAt: 120,
          engine: "claude",
        },
      ],
      "workspace-1",
      {},
      () => undefined,
    );

    expect(merged.find((thread) => thread.id === "claude:session-1")?.name).toBe(
      "帮我审核一下这个 PR",
    );
  });

  it("lets weak-looking native catalog titles replace first-message titles", () => {
    const merged = mergeCodexCatalogSessionSummaries(
      [
        {
          id: "codex:session-1",
          name: "First prompt fallback",
          updatedAt: 100,
          engineSource: "codex",
          threadKind: "native",
        },
      ],
      [
        {
          sessionId: "codex:session-1",
          title: "Agent 12",
          nativeTitle: "Agent 12",
          updatedAt: 120,
          engine: "codex",
        },
      ],
      "workspace-1",
      {},
      () => undefined,
    );

    expect(merged.find((thread) => thread.id === "codex:session-1")?.name).toBe(
      "Agent 12",
    );
  });

  it("preserves weak-looking native titles in direct native-session merges", () => {
    const previous: ThreadSummary = {
      id: "claude:session-1",
      name: "First prompt fallback",
      updatedAt: 100,
      engineSource: "claude",
      threadKind: "native",
    };
    const next = { ...previous, name: "Claude Session", updatedAt: 120 };

    expect(
      mergeThreadSummaryPreservingStableIdentity(previous, next, {
        nativeTitle: "Claude Session",
      }).name,
    ).toBe("Claude Session");
  });

  it("lets custom titles override mapped titles in catalog and Gemini merges", () => {
    const catalogMerged = mergeCodexCatalogSessionSummaries(
      [],
      [
        {
          sessionId: "claude:session-1",
          title: "Native title",
          updatedAt: 120,
          engine: "claude",
        },
      ],
      "workspace-1",
      { "claude:session-1": "Mapped title" },
      () => "Custom title",
    );
    const geminiMerged = mergeGeminiSessionSummaries(
      [],
      [
        {
          sessionId: "session-2",
          firstMessage: "Gemini native title",
          updatedAt: 120,
        },
      ],
      "workspace-1",
      { "gemini:session-2": "Mapped Gemini title" },
      () => "Custom Gemini title",
    );

    expect(catalogMerged.find((thread) => thread.id === "claude:session-1")?.name).toBe(
      "Custom title",
    );
    expect(geminiMerged.find((thread) => thread.id === "gemini:session-2")?.name).toBe(
      "Custom Gemini title",
    );
  });

  it("uses catalog owner workspace when resolving aggregate custom titles", () => {
    const merged = mergeCodexCatalogSessionSummaries(
      [],
      [
        {
          sessionId: "claude:session-1",
          workspaceId: "child-workspace",
          title: "Native child title",
          updatedAt: 120,
          engine: "claude",
        },
      ],
      "parent-workspace",
      {},
      (workspaceId) =>
        workspaceId === "child-workspace"
          ? "Owner custom title"
          : "Parent fallback title",
    );

    expect(merged.find((thread) => thread.id === "claude:session-1")?.name).toBe(
      "Owner custom title",
    );
  });

  it("projects provider-backed Codex metadata from catalog rows", () => {
    const merged = mergeCodexCatalogSessionSummaries(
      [],
      [
        {
          sessionId: "codex-provider-session",
          workspaceId: "workspace-1",
          title: "Provider restored session",
          updatedAt: 120,
          engine: "codex",
          providerProfileId: "provider-a",
          providerProfileSource: "managed",
          providerProfileName: "AskUs",
          providerAvailability: "available",
          sourceLabel: "AskUs",
        },
      ],
      "workspace-1",
      {},
      () => undefined,
    );

    expect(merged[0]).toMatchObject({
      id: "codex-provider-session",
      engineSource: "codex",
      providerProfileId: "provider-a",
      providerProfileSource: "managed",
      providerProfileName: "AskUs",
      providerAvailability: "available",
      sourceLabel: "AskUs",
    });
  });

  it.each(["claude", "kimi"] as const)(
    "hydrates provider metadata for %s catalog rows",
    (engine) => {
      const merged = mergeCodexCatalogSessionSummaries(
        [],
        [
          {
            sessionId: `${engine}:session-1`,
            workspaceId: "workspace-1",
            title: "Provider restored session",
            updatedAt: 120,
            engine,
            providerProfileId: "provider-a",
            providerProfileSource: "managed",
            providerProfileName: "Provider A",
            providerAvailability: "available",
          },
        ],
        "workspace-1",
        {},
        () => undefined,
      );

      expect(merged[0]).toMatchObject({
        id: `${engine}:session-1`,
        engineSource: engine,
        providerProfileId: "provider-a",
        providerProfileSource: "managed",
        providerProfileName: "Provider A",
        providerAvailability: "available",
      });
    },
  );

  it("preserves provider-backed Codex rows during degraded continuity", () => {
    const merged = mergeDegradedCodexContinuitySummaries(
      [],
      [
        {
          id: "codex-provider-session",
          name: "Provider restored session",
          updatedAt: 120,
          engineSource: "codex",
          threadKind: "native",
          providerProfileId: "provider-a",
          providerProfileSource: "managed",
          providerProfileName: "AskUs",
          providerAvailability: "available",
        },
      ],
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      id: "codex-provider-session",
      providerProfileId: "provider-a",
      providerProfileSource: "managed",
      providerProfileName: "AskUs",
      providerAvailability: "available",
    });
  });

  it("does not resurrect excluded Claude rows during degraded continuity", () => {
    const merged = mergeDegradedClaudeContinuitySummaries(
      [],
      [
        {
          id: "claude:hidden-native",
          name: "Hidden native",
          updatedAt: 120,
          engineSource: "claude",
          threadKind: "native",
        },
        {
          id: "claude:visible-native",
          name: "Visible native",
          updatedAt: 100,
          engineSource: "claude",
          threadKind: "native",
        },
      ],
      new Set(["claude:hidden-native"]),
    );

    expect(merged.map((thread) => thread.id)).toEqual(["claude:visible-native"]);
  });

  it("rejects pending placeholders in engine-aware continuity filters", () => {
    const pendingByEngine = ["claude", "codex", "opencode"] as const;

    for (const engine of pendingByEngine) {
      const summary: ThreadSummary = {
        id: `${engine}-pending-123`,
        name: "Pending",
        updatedAt: 100,
        engineSource: engine,
        threadKind: "native",
      };

      expect(isRetainableEngineContinuitySummary(engine, summary)).toBe(false);
    }
  });

  it("does not seed pending OpenCode placeholders from last-good fallback", () => {
    const mergedById = new Map<string, ThreadSummary>();
    const seeded = seedLastGoodEngineIntoMerged(
      "opencode",
      mergedById,
      [
        {
          id: "opencode-pending-123",
          name: "Pending OpenCode",
          updatedAt: 100,
          engineSource: "opencode",
          threadKind: "native",
        },
        {
          id: "opencode:session-1",
          name: "Real OpenCode",
          updatedAt: 90,
          engineSource: "opencode",
          threadKind: "native",
        },
      ],
    );

    expect(seeded).toBe(1);
    expect([...mergedById.keys()]).toEqual(["opencode:session-1"]);
  });

  it("strips shared hidden binding summaries from any sidebar snapshot", () => {
    const hidden = new Set(["grok:bound-1", "kimi:bound-2"]);
    const input: ThreadSummary[] = [
      {
        id: "shared:s1",
        name: "Shared",
        updatedAt: 3,
        threadKind: "shared",
        engineSource: "grok",
      },
      {
        id: "grok:bound-1",
        name: "Leaked Grok",
        updatedAt: 2,
        engineSource: "grok",
      },
      {
        id: "grok:visible-1",
        name: "User Grok",
        updatedAt: 1,
        engineSource: "grok",
      },
    ];
    const stripped = stripHiddenSharedBindingSummaries(input, hidden);
    expect(stripped.map((row) => row.id)).toEqual([
      "shared:s1",
      "grok:visible-1",
    ]);
    // 空 hide set 且无 control-plane 标题时应返回原引用
    expect(stripHiddenSharedBindingSummaries(input, new Set())).toBe(input);
  });

  it("stripHiddenSharedBindingSummaries drops MOSSX_CONTEXT native spawn titles", () => {
    const packageTitle =
      `MOSSX_CONTEXT_PACKAGE:sha256:${"a".repeat(64)}:` +
      `sha256:${"b".repeat(64)}`;
    const input: ThreadSummary[] = [
      {
        id: "shared:s1",
        name: "Shared collab",
        updatedAt: 3,
        threadKind: "shared",
        engineSource: "claude",
      },
      {
        id: "claude:spawn-1",
        name: packageTitle,
        updatedAt: 2,
        engineSource: "claude",
      },
      {
        id: "claude:user-1",
        name: "正常用户会话",
        updatedAt: 1,
        engineSource: "claude",
      },
    ];
    const stripped = stripHiddenSharedBindingSummaries(input, new Set());
    expect(stripped.map((row) => row.id)).toEqual([
      "shared:s1",
      "claude:user-1",
    ]);
  });

  it("mergeGrok clears leaked baseline even when sessions filter empties", () => {
    const hidden = new Set(["grok:leaked-1"]);
    const baseline: ThreadSummary[] = [
      {
        id: "shared:s1",
        name: "Shared",
        updatedAt: 10,
        threadKind: "shared",
        engineSource: "grok",
      },
      {
        id: "grok:leaked-1",
        name: "分析一下给我结论",
        updatedAt: 9,
        engineSource: "grok",
      },
      {
        id: "grok:user-1",
        name: "User Grok",
        updatedAt: 8,
        engineSource: "grok",
      },
    ];
    // 全部 session 被调用方 filter 掉（或磁盘只有 hidden）→ 旧实现 early-return 原 base
    const mergedEmpty = mergeGrokSessionSummaries(
      baseline,
      [],
      "ws-1",
      {},
      () => undefined,
      undefined,
      hidden,
    );
    expect(mergedEmpty.map((row) => row.id)).toEqual([
      "shared:s1",
      "grok:user-1",
    ]);

    const mergedWithVisible = mergeGrokSessionSummaries(
      baseline,
      [
        {
          sessionId: "user-1",
          firstMessage: "User Grok refreshed",
          updatedAt: 20,
        },
        {
          sessionId: "leaked-1",
          firstMessage: "should stay hidden",
          updatedAt: 21,
        },
      ],
      "ws-1",
      {},
      () => undefined,
      undefined,
      hidden,
    );
    expect(mergedWithVisible.map((row) => row.id)).toEqual([
      "grok:user-1",
      "shared:s1",
    ]);
    expect(
      mergedWithVisible.find((row) => row.id === "grok:user-1")?.updatedAt,
    ).toBe(20);
  });

  it("mergeKimi clears leaked baseline with empty sessions", () => {
    const hidden = new Set(["kimi:leaked-k"]);
    const merged = mergeKimiSessionSummaries(
      [
        {
          id: "kimi:leaked-k",
          name: "Leaked",
          updatedAt: 1,
          engineSource: "kimi",
        },
        {
          id: "kimi:ok",
          name: "OK",
          updatedAt: 2,
          engineSource: "kimi",
        },
      ],
      [],
      "ws-1",
      {},
      () => undefined,
      hidden,
    );
    expect(merged.map((row) => row.id)).toEqual(["kimi:ok"]);
  });

});
