import { describe, expect, it } from "vitest";
import {
  assemblePanelPrompt,
  assembleSinglePrompt,
  assembleSkillInvocations,
  expandLeadingManagedCommand,
  shouldAssemblePrompt,
} from "./promptAssembler";

describe("promptAssembler", () => {
  it("keeps slash command out of assembly", () => {
    expect(
      shouldAssemblePrompt({
        userInput: "/review src/App.tsx",
        selectedSkillCount: 1,
        selectedCommonsCount: 1,
      }),
    ).toBe(false);
  });

  it("assembles prompt with fixed section order", () => {
    const assembled = assembleSinglePrompt({
      userInput: "请帮我审查这段代码",
      skills: [{ name: "Code Review", description: "找 bug 和风险" }],
      commons: [{ name: "team-rules" }],
    });

    expect(assembled).toContain("/Code-Review");
    expect(assembled).toContain("/team-rules");
    expect(assembled.endsWith("请帮我审查这段代码")).toBe(true);
  });

  it("assembles panel prompt with panel skill and optional extra input", () => {
    const assembled = assemblePanelPrompt({
      workspaceQuestion: "给我一个排查方案",
      panelSkill: { name: "Debug", description: "定位问题根因" },
      inheritedCommons: [{ name: "project-context" }],
      panelExtraInput: "重点关注连接池",
    });

    expect(assembled).toContain("/Debug");
    expect(assembled).toContain("/project-context");
    expect(assembled).toContain("/重点关注连接池");
    expect(assembled.endsWith("给我一个排查方案")).toBe(true);
  });
});

describe("assembleSkillInvocations", () => {
  it("normalizes names with the same rule as slash tokens", () => {
    const invocations = assembleSkillInvocations({
      skills: [{ name: "/Code Review" }, { name: "team rules" }],
      commons: [{ name: "project-context" }],
    });

    expect(invocations).toEqual([
      { name: "Code-Review" },
      { name: "team-rules" },
      { name: "project-context" },
    ]);
  });

  it("preserves skill path for collab body injection", () => {
    const invocations = assembleSkillInvocations({
      skills: [
        {
          name: "code-review",
          path: "/repo/.claude/skills/code-review/SKILL.md",
        },
      ],
      commons: [{ name: "team", path: "/repo/.agents/skills/team" }],
    });
    expect(invocations).toEqual([
      {
        name: "code-review",
        path: "/repo/.claude/skills/code-review/SKILL.md",
      },
      { name: "team", path: "/repo/.agents/skills/team" },
    ]);
  });

  it("drops empty names", () => {
    const invocations = assembleSkillInvocations({
      skills: [{ name: "   " }, { name: "/" }],
      commons: [],
    });

    expect(invocations).toEqual([]);
  });
});

describe("expandLeadingManagedCommand", () => {
  const commands = [
    {
      name: "my-review",
      content: "按仓库规范审查 $ARGUMENTS 的改动。",
      source: "workspace_managed",
    },
    {
      name: "checklist",
      content: "逐项核对发布清单。",
      source: "workspace_managed",
    },
    {
      name: "status",
      content: "engine-owned",
      source: "project_claude",
    },
  ];

  it("expands a managed command and substitutes $ARGUMENTS", () => {
    expect(expandLeadingManagedCommand("/my-review src/App.tsx", commands)).toBe(
      "按仓库规范审查 src/App.tsx 的改动。",
    );
  });

  it("appends args when the template has no placeholder", () => {
    expect(expandLeadingManagedCommand("/checklist v1.2", commands)).toBe(
      "逐项核对发布清单。\n\nv1.2",
    );
  });

  it("returns the bare template when no args are given", () => {
    expect(expandLeadingManagedCommand("/checklist", commands)).toBe("逐项核对发布清单。");
  });

  it("leaves engine-owned commands untouched", () => {
    expect(expandLeadingManagedCommand("/status", commands)).toBe("/status");
  });

  it("leaves unknown commands untouched for the engine to report", () => {
    expect(expandLeadingManagedCommand("/nope args", commands)).toBe("/nope args");
  });

  it("leaves plain text untouched", () => {
    expect(expandLeadingManagedCommand("帮我审查代码", commands)).toBe("帮我审查代码");
  });
});
