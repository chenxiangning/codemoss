import { describe, expect, it } from "vitest";
import {
  buildNativeOwnerToSharedThreadMap,
  buildSharedSidebarHiddenParentKeys,
  expandHiddenSharedBindingIds,
  isSharedSidebarHiddenPup,
  lookupSharedOwnerByNativeParent,
  normalizeSharedSessionSummary,
  remapParentThreadIdToSharedOwner,
  remapThreadParentsToSharedOwners,
} from "./sharedSessionSummaries";

describe("sharedSessionSummaries", () => {
  it("keeps native thread ids for all five supported Shared engines", () => {
    const summary = normalizeSharedSessionSummary({
      id: "shared-session-1",
      threadId: "shared:shared-session-1",
      title: "Shared Session",
      updatedAt: 1_730_000_000_000,
      selectedEngine: "grok",
      nativeThreadIds: [
        "claude:session-1",
        "claude-pending-shared-2",
        "019d767b-5541-7010-a30d-a454864bccd8",
        "grok:session-3",
        "kimi:session-4",
        "opencode:session-5",
        "gemini:session-3",
        "gemini-pending-4",
      ],
    });

    expect(summary).toMatchObject({
      id: "shared-session-1",
      threadId: "shared:shared-session-1",
      selectedEngine: "grok",
    });
    expect(summary?.nativeThreadIds).toEqual([
      "claude:session-1",
      "claude-pending-shared-2",
      "019d767b-5541-7010-a30d-a454864bccd8",
      "grok:session-3",
      "kimi:session-4",
      "opencode:session-5",
    ]);
  });

  it("rejects malformed non-shared thread ids from shared summaries", () => {
    expect(
      normalizeSharedSessionSummary({
        id: "not-shared",
        threadId: "gemini:session-1",
        selectedEngine: "claude",
      }),
    ).toBeNull();
  });

  it("expands hidden binding ids for raw and engine-prefixed forms", () => {
    const expanded = expandHiddenSharedBindingIds([
      "grok:real-session-1",
      "kimi-pending-shared-2",
      "019d767b-5541-7010-a30d-a454864bccd8",
      "opencode:ses_opc_1",
    ]);

    expect(expanded.has("grok:real-session-1")).toBe(true);
    expect(expanded.has("real-session-1")).toBe(true);
    expect(expanded.has("kimi:kimi-pending-shared-2")).toBe(true);
    expect(expanded.has("kimi-pending-shared-2")).toBe(true);
    expect(expanded.has("019d767b-5541-7010-a30d-a454864bccd8")).toBe(true);
    expect(expanded.has("codex:019d767b-5541-7010-a30d-a454864bccd8")).toBe(
      true,
    );
    expect(expanded.has("opencode:ses_opc_1")).toBe(true);
    expect(expanded.has("ses_opc_1")).toBe(true);
  });

  it("remaps grok subagent parents from hidden native owner to shared thread", () => {
    const summary = normalizeSharedSessionSummary({
      id: "shared-session-1",
      threadId: "shared:shared-session-1",
      title: "Shared Session",
      updatedAt: 1,
      selectedEngine: "grok",
      nativeThreadIds: ["grok:parent-native"],
    });
    expect(summary).not.toBeNull();
    const map = buildNativeOwnerToSharedThreadMap([summary!]);
    expect(map.get("grok:parent-native")).toBe("shared:shared-session-1");
    expect(map.get("parent-native")).toBe("shared:shared-session-1");

    const remapped = remapThreadParentsToSharedOwners(
      [
        {
          id: "grok:child-1",
          name: "子代理 1",
          updatedAt: 2,
          engineSource: "grok",
          parentThreadId: "grok:parent-native",
        },
        {
          id: "shared:shared-session-1",
          name: "Shared Session",
          updatedAt: 3,
          engineSource: "grok",
          threadKind: "shared",
        },
      ],
      map,
    );
    expect(remapped.find((t) => t.id === "grok:child-1")?.parentThreadId).toBe(
      "shared:shared-session-1",
    );
  });

  it("lookupSharedOwnerByNativeParent matches codex raw vs engine-prefixed owners", () => {
    const summary = normalizeSharedSessionSummary({
      id: "shared-codex",
      threadId: "shared:shared-codex",
      title: "Shared Codex",
      updatedAt: 1,
      selectedEngine: "codex",
      nativeThreadIds: ["codex:019d767b-5541-7010-a30d-a454864bccd8"],
    });
    expect(summary).not.toBeNull();
    const map = buildNativeOwnerToSharedThreadMap([summary!]);
    const sharedId = "shared:shared-codex";

    // binding 带 codex:，child parent 为 raw uuid（live Codex 常见）
    expect(
      lookupSharedOwnerByNativeParent(
        "019d767b-5541-7010-a30d-a454864bccd8",
        map,
      ),
    ).toBe(sharedId);
    expect(
      lookupSharedOwnerByNativeParent(
        "codex:019d767b-5541-7010-a30d-a454864bccd8",
        map,
      ),
    ).toBe(sharedId);

    // binding 为 raw，child parent 为 codex:
    const rawBinding = normalizeSharedSessionSummary({
      id: "shared-codex-2",
      threadId: "shared:shared-codex-2",
      title: "Shared Codex 2",
      updatedAt: 1,
      selectedEngine: "codex",
      nativeThreadIds: ["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"],
    });
    const mapRaw = buildNativeOwnerToSharedThreadMap([rawBinding!]);
    expect(
      lookupSharedOwnerByNativeParent(
        "codex:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        mapRaw,
      ),
    ).toBe("shared:shared-codex-2");
  });

  it("remaps codex/claude/grok parent variants onto shared without touching unrelated trees", () => {
    const sessions = [
      normalizeSharedSessionSummary({
        id: "s-codex",
        threadId: "shared:s-codex",
        title: "S Codex",
        updatedAt: 1,
        selectedEngine: "codex",
        nativeThreadIds: ["codex:parent-codex"],
      })!,
      normalizeSharedSessionSummary({
        id: "s-claude",
        threadId: "shared:s-claude",
        title: "S Claude",
        updatedAt: 1,
        selectedEngine: "claude",
        nativeThreadIds: ["claude:parent-claude"],
      })!,
      normalizeSharedSessionSummary({
        id: "s-grok",
        threadId: "shared:s-grok",
        title: "S Grok",
        updatedAt: 1,
        selectedEngine: "grok",
        nativeThreadIds: ["grok:parent-grok"],
      })!,
    ];
    const map = buildNativeOwnerToSharedThreadMap(sessions);

    const input = [
      {
        id: "child-codex",
        name: "Archimedes",
        updatedAt: 2,
        engineSource: "codex" as const,
        parentThreadId: "parent-codex", // raw vs codex: binding
      },
      {
        id: "claude:child-1",
        name: "Explore",
        updatedAt: 2,
        engineSource: "claude" as const,
        parentThreadId: "parent-claude", // bare vs claude: binding
      },
      {
        id: "grok:child-1",
        name: "子代理",
        updatedAt: 2,
        engineSource: "grok" as const,
        parentThreadId: "grok:parent-grok",
      },
      {
        id: "codex:normal-child",
        name: "Native nest",
        updatedAt: 2,
        engineSource: "codex" as const,
        parentThreadId: "codex:visible-parent", // 非 shared owner
      },
      {
        id: "orphan-no-parent",
        name: "Top level",
        updatedAt: 2,
        engineSource: "codex" as const,
      },
    ];

    const remapped = remapThreadParentsToSharedOwners(input, map);
    expect(remapped.find((t) => t.id === "child-codex")?.parentThreadId).toBe(
      "shared:s-codex",
    );
    expect(remapped.find((t) => t.id === "claude:child-1")?.parentThreadId).toBe(
      "shared:s-claude",
    );
    expect(remapped.find((t) => t.id === "grok:child-1")?.parentThreadId).toBe(
      "shared:s-grok",
    );
    expect(
      remapped.find((t) => t.id === "codex:normal-child")?.parentThreadId,
    ).toBe("codex:visible-parent");
    expect(remapped.find((t) => t.id === "orphan-no-parent")?.parentThreadId).toBe(
      undefined,
    );

    // 无 map / 空 parent：恒等
    expect(remapThreadParentsToSharedOwners(input, new Map())).toBe(input);
    expect(remapParentThreadIdToSharedOwner(null, map)).toBeNull();
    expect(lookupSharedOwnerByNativeParent("codex:visible-parent", map)).toBeNull();
  });

  it("isSharedSidebarHiddenPup hides shared-owned pups by parent id shapes only", () => {
    const threads = [
      {
        id: "shared:s1",
        name: "S",
        updatedAt: 1,
        engineSource: "codex" as const,
        threadKind: "shared" as const,
        nativeThreadIds: ["codex:hidden-owner"],
      },
    ];
    const keys = buildSharedSidebarHiddenParentKeys(threads);
    expect(keys.has("shared:s1")).toBe(true);
    expect(keys.has("codex:hidden-owner")).toBe(true);
    expect(keys.has("hidden-owner")).toBe(true);

    expect(
      isSharedSidebarHiddenPup(
        { id: "pup-1" },
        "shared:s1",
        keys,
      ),
    ).toBe(true);
    expect(
      isSharedSidebarHiddenPup(
        { id: "pup-2" },
        "hidden-owner",
        keys,
      ),
    ).toBe(true);
    expect(
      isSharedSidebarHiddenPup(
        { id: "pup-3" },
        "codex:hidden-owner",
        keys,
      ),
    ).toBe(true);
    // Native 父子 / 无 parent / Shared 自身
    expect(
      isSharedSidebarHiddenPup(
        { id: "codex:child" },
        "codex:visible-parent",
        keys,
      ),
    ).toBe(false);
    expect(isSharedSidebarHiddenPup({ id: "solo" }, null, keys)).toBe(false);
    expect(
      isSharedSidebarHiddenPup(
        { id: "shared:s1", threadKind: "shared" },
        null,
        keys,
      ),
    ).toBe(false);
  });
});
