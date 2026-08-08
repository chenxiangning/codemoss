import { describe, expect, it, vi } from "vitest";
import {
  buildSkillBlock,
  injectCollabSkillContext,
  injectSkillBodiesContext,
  resolveSkillMarkdownPath,
  stripLeadingSkillSlashTokens,
  stripSkillFrontmatter,
} from "./skillContextInjection";

describe("skillContextInjection", () => {
  it("resolveSkillMarkdownPath maps dir and file", () => {
    expect(resolveSkillMarkdownPath("/repo/.claude/skills/review/SKILL.md")).toBe(
      "/repo/.claude/skills/review/SKILL.md",
    );
    expect(resolveSkillMarkdownPath("/repo/.claude/skills/review")).toBe(
      "/repo/.claude/skills/review/SKILL.md",
    );
    expect(resolveSkillMarkdownPath("")).toBeNull();
    expect(resolveSkillMarkdownPath(null)).toBeNull();
  });

  it("stripSkillFrontmatter removes yaml fence", () => {
    const md = `---\nname: review\n---\n\n# Review\nbody`;
    expect(stripSkillFrontmatter(md)).toBe("# Review\nbody");
    expect(stripSkillFrontmatter("plain body")).toBe("plain body");
  });

  it("injectSkillBodiesContext prepends skill blocks and strips slash tokens", () => {
    const result = injectSkillBodiesContext({
      userText: "/code-review /docs 请审查 PR",
      skills: [
        { name: "code-review", body: "---\nname: x\n---\n\n找 bug" },
        { name: "docs", body: "写文档规范" },
      ],
    });
    expect(result.injectedCount).toBe(2);
    expect(result.finalText).toContain("【技能上下文】");
    expect(result.finalText).toContain("<skill name=\"code-review\">");
    expect(result.finalText).toContain("找 bug");
    expect(result.finalText).toContain("写文档规范");
    expect(result.finalText).toContain("请审查 PR");
    expect(result.finalText).not.toMatch(/^\/code-review/);
    expect(result.finalText).not.toContain("/docs ");
  });

  it("stripLeadingSkillSlashTokens only strips known tokens", () => {
    expect(
      stripLeadingSkillSlashTokens("/a /b keep /c", ["a", "b"]),
    ).toBe("keep /c");
    expect(stripLeadingSkillSlashTokens("no tokens", ["a"])).toBe("no tokens");
  });

  it("buildSkillBlock clamps and escapes quotes in name", () => {
    const block = buildSkillBlock({
      name: 'weird"name',
      body: "x".repeat(20),
    });
    expect(block).toContain('name="weird\'name"');
  });

  it("injectCollabSkillContext reads files and skips failures", async () => {
    const readFile = vi.fn(async (_ws: string, path: string) => {
      if (path.includes("missing")) throw new Error("enoent");
      return { content: `---\ntitle: t\n---\n\nbody from ${path}` };
    });
    const result = await injectCollabSkillContext({
      workspaceId: "ws-1",
      userText: "/ok /missing 任务",
      skills: [
        { name: "ok", path: "/skills/ok/SKILL.md" },
        { name: "missing", path: "/skills/missing/SKILL.md" },
        { name: "nopath" },
      ],
      readFile,
    });
    expect(result.injectedCount).toBe(1);
    expect(result.injectedNames).toEqual(["ok"]);
    expect(result.finalText).toContain("body from /skills/ok/SKILL.md");
    expect(result.finalText).toContain("任务");
    // missing 未注入 → slash 保留给引擎回退
    expect(result.finalText).toContain("/missing");
    expect(readFile).toHaveBeenCalledTimes(2);
  });
});
