import { describe, expect, it } from "vitest";
import type { ThreadSummary } from "../../../types";
import {
  isWeakSessionDisplayTitle,
  mergeSessionDisplaySummary,
  projectSessionDisplaySummaries,
} from "./sessionDisplayProjection";

describe("sessionDisplayProjection", () => {
  it("classifies ordinal agent and generic session names as weak titles", () => {
    expect(isWeakSessionDisplayTitle("Agent 202")).toBe(true);
    expect(isWeakSessionDisplayTitle("Claude Session")).toBe(true);
    expect(isWeakSessionDisplayTitle("Grok Session")).toBe(true);
    expect(isWeakSessionDisplayTitle("Kimi Session")).toBe(true);
    expect(isWeakSessionDisplayTitle("分析左侧栏消失问题")).toBe(false);
  });

  it("classifies clipped raw command-tag names as weak titles", () => {
    expect(isWeakSessionDisplayTitle("<command-m")).toBe(true);
    expect(isWeakSessionDisplayTitle("<local-command-stdout>")).toBe(true);
  });

  it("classifies project-memory-pack residue as weak and keeps prior readable title", () => {
    expect(isWeakSessionDisplayTitle("<project-memory-pack s")).toBe(true);
    expect(
      isWeakSessionDisplayTitle(
        '<project-memory-pack source="memory-pick" count="2"',
      ),
    ).toBe(true);

    const previous: ThreadSummary = {
      id: "grok:session-1",
      name: "你好啊",
      updatedAt: 100,
      engineSource: "grok",
      threadKind: "native",
    };
    const polluted = {
      ...previous,
      name: '<project-memory-pack source="memory-pick" count="2"',
      updatedAt: 120,
    };

    expect(mergeSessionDisplaySummary(previous, polluted).name).toBe("你好啊");
    expect(
      mergeSessionDisplaySummary(previous, polluted, {
        nativeTitle: "<project-memory-pack s",
      }).name,
    ).toBe("你好啊");
  });

  it("classifies Grok runtime-context titles as weak and upgrades to real prompt", () => {
    const pollutedTitle =
      "<user_info> OS Version: macos Shell: /bin/zsh Workspace Path: /Users/me/fx";
    expect(isWeakSessionDisplayTitle(pollutedTitle)).toBe(true);
    expect(isWeakSessionDisplayTitle("<rules> # Development Guidelines")).toBe(
      true,
    );

    const previous: ThreadSummary = {
      id: "grok:session-bootstrap",
      name: pollutedTitle,
      updatedAt: 100,
      engineSource: "grok",
      threadKind: "native",
    };
    const fixed = {
      ...previous,
      name: "阅读下本地未提交代码",
      updatedAt: 120,
    };

    expect(mergeSessionDisplaySummary(previous, fixed).name).toBe(
      "阅读下本地未提交代码",
    );
    expect(
      mergeSessionDisplaySummary(previous, {
        ...previous,
        name: pollutedTitle,
        updatedAt: 130,
      }).name,
    ).toBe("");
  });

  it("treats context protocol titles as weak and ignores mapped protocol titles", () => {
    const protocolTitle =
      `MOSSX_CONTEXT_PACKAGE:sha256:${"a".repeat(64)}:` +
      `sha256:${"b".repeat(64)}`;
    expect(isWeakSessionDisplayTitle(protocolTitle)).toBe(true);
    // 截断后的半截 package 也必须是 weak，避免粘在侧栏
    expect(
      isWeakSessionDisplayTitle("MOSSX_CONTEXT_PACKAGE:sha256:aaaaaaaaaaaaaa"),
    ).toBe(true);
    expect(
      mergeSessionDisplaySummary(
        undefined,
        {
          id: "claude:target",
          name: "继续：来源会话",
          updatedAt: 1,
          engineSource: "claude",
        },
        { mappedTitle: protocolTitle },
      ).name,
    ).toBe("继续：来源会话");
  });

  it("keeps a meaningful title when a later candidate only has Agent N", () => {
    const previous: ThreadSummary = {
      id: "claude:session-1",
      name: "分析左侧栏消失问题",
      updatedAt: 100,
      engineSource: "claude",
      threadKind: "native",
    };
    const next: ThreadSummary = {
      id: "claude:session-1",
      name: "Agent 202",
      updatedAt: 120,
      engineSource: "claude",
      threadKind: "native",
    };

    expect(mergeSessionDisplaySummary(previous, next).name).toBe("分析左侧栏消失问题");
  });

  it("does not downgrade a generic session fallback to ordinal Agent title", () => {
    const previous: ThreadSummary = {
      id: "claude:session-1",
      name: "Claude Session",
      updatedAt: 100,
      engineSource: "claude",
      threadKind: "native",
    };
    const next: ThreadSummary = {
      id: "claude:session-1",
      name: "Agent 202",
      updatedAt: 120,
      engineSource: "claude",
      threadKind: "native",
    };

    expect(mergeSessionDisplaySummary(previous, next).name).toBe("Claude Session");
  });

  it("lets custom titles override mapped titles and native candidates", () => {
    const previous: ThreadSummary = {
      id: "claude:session-1",
      name: "旧标题",
      updatedAt: 100,
      engineSource: "claude",
      threadKind: "native",
    };

    expect(
      mergeSessionDisplaySummary(
        previous,
        { ...previous, name: "新标题", updatedAt: 120 },
        { customTitle: "自定义标题" },
      ).name,
    ).toBe("自定义标题");
    expect(
      mergeSessionDisplaySummary(
        previous,
        { ...previous, name: "新标题", updatedAt: 120 },
        { mappedTitle: "映射标题", customTitle: "自定义标题" },
      ).name,
    ).toBe("自定义标题");
    expect(
      mergeSessionDisplaySummary(
        previous,
        { ...previous, name: "新标题", updatedAt: 120 },
        { mappedTitle: "映射标题" },
      ).name,
    ).toBe("映射标题");
  });

  it("preserves ordinal Agent titles when they are explicit custom names", () => {
    const previous: ThreadSummary = {
      id: "codex:session-1",
      name: "真实业务标题",
      updatedAt: 100,
      engineSource: "codex",
      threadKind: "native",
    };

    expect(
      mergeSessionDisplaySummary(
        previous,
        { ...previous, name: "Codex Session", updatedAt: 120 },
        { customTitle: "Agent 103" },
      ).name,
    ).toBe("Agent 103");
  });

  it.each(["Agent 12", "Claude Session", "deadbeef"])(
    "preserves weak-looking native title %s",
    (nativeTitle) => {
      const previous: ThreadSummary = {
        id: "claude:session-1",
        name: "First prompt fallback",
        updatedAt: 100,
        engineSource: "claude",
        threadKind: "native",
      };

      expect(
        mergeSessionDisplaySummary(
          previous,
          { ...previous, name: nativeTitle, updatedAt: 120 },
          { nativeTitle },
        ).name,
      ).toBe(nativeTitle);
    },
  );

  it("keeps GUI custom and mapped titles above native titles", () => {
    const previous: ThreadSummary = {
      id: "codex:session-1",
      name: "First prompt fallback",
      updatedAt: 100,
      engineSource: "codex",
      threadKind: "native",
    };
    const next = { ...previous, name: "Agent 12", updatedAt: 120 };

    expect(
      mergeSessionDisplaySummary(previous, next, {
        nativeTitle: "Agent 12",
        mappedTitle: "Mapped title",
      }).name,
    ).toBe("Mapped title");
    expect(
      mergeSessionDisplaySummary(previous, next, {
        nativeTitle: "Agent 12",
        mappedTitle: "Mapped title",
        customTitle: "Custom title",
      }).name,
    ).toBe("Custom title");
  });

  it("preserves parent relationship metadata during degraded continuity merges", () => {
    const previous: ThreadSummary = {
      id: "claude:child",
      name: "子任务",
      updatedAt: 100,
      engineSource: "claude",
      threadKind: "native",
      parentThreadId: "claude:parent",
    };
    const next: ThreadSummary = {
      id: "claude:child",
      name: "Claude Session",
      updatedAt: 120,
      engineSource: "claude",
      threadKind: "native",
    };

    expect(mergeSessionDisplaySummary(previous, next)).toMatchObject({
      name: "子任务",
      parentThreadId: "claude:parent",
    });
  });

  it("projects degraded continuity candidates without resurrecting excluded rows", () => {
    const projected = projectSessionDisplaySummaries({
      baseSummaries: [
        {
          id: "claude:current",
          name: "当前",
          updatedAt: 200,
          engineSource: "claude",
          threadKind: "native",
        },
      ],
      candidateSummaries: [
        {
          id: "claude:hidden",
          name: "隐藏",
          updatedAt: 150,
          engineSource: "claude",
          threadKind: "native",
        },
        {
          id: "claude:last-good",
          name: "上次可见",
          updatedAt: 140,
          engineSource: "claude",
          threadKind: "native",
        },
      ],
      excludedThreadIds: new Set(["claude:hidden"]),
    });

    expect(projected.map((entry) => entry.id)).toEqual([
      "claude:current",
      "claude:last-good",
    ]);
  });
});
