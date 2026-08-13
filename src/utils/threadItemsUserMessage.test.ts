import { describe, expect, it } from "vitest";
import {
  extractCollaborationModeFromUserMessageItem,
  extractFallbackUserMessagePayload,
  extractLatestUserInputTextPreserveFormatting,
  extractModeFallbackMode,
  extractSelectedAgentIconFromUserMessageItem,
  extractSelectedAgentNameFromUserMessageItem,
  normalizeUserMessageText,
  previewThreadName,
  stripAgentPromptBlockFromTail,
  stripInjectedPrefixLines,
} from "./threadItemsUserMessage";

describe("threadItemsUserMessage", () => {
  it("normalizes injected project memory out of user text", () => {
    const text = [
      '<project-memory source="project-memory" count="1" truncated="false">',
      "[对话记录] 测试记忆",
      "</project-memory>",
      "",
      "继续拆分用户消息 helper",
    ].join("\n");

    expect(normalizeUserMessageText(text)).toBe("继续拆分用户消息 helper");
  });

  it("strips project-memory-pack from default thread title and visible user text", () => {
    const text = [
      '<project-memory-pack source="memory-pick" count="3" cleaned="true" cleanerStatus="cleaned" truncated="false">',
      "Cleaned Context:",
      "记忆摘要",
      "</project-memory-pack>",
      "",
      "你好啊",
    ].join("\n");

    expect(normalizeUserMessageText(text)).toBe("你好啊");
    expect(previewThreadName(text, "Agent 1")).toBe("你好啊");
  });

  it("does not name threads from truncated unclosed project-memory-pack firstMessage", () => {
    // Grok/native 常把 firstMessage 截到半截 open tag，闭合标签丢失
    const truncated = [
      '<project-memory-pack source="memory-pick" count="2" cleaned="true"',
      ' cleanerStatus="cleaned" truncated="false">',
      "Cleaned Context:",
      "你好啊",
    ].join("");

    expect(previewThreadName(truncated, "Grok Session")).toBe("Grok Session");
    expect(previewThreadName(truncated.slice(0, 48), "Grok Session")).toBe(
      "Grok Session",
    );
  });

  it("does not name threads from Grok runtime-context firstMessage pollution", () => {
    // 后端旧缓存 / 未过滤路径可能把 bootstrap 截断成侧栏 first_message
    const polluted =
      "<user_info> OS Version: macos Shell: /bin/zsh Workspace Path: /Users/me/fx-data-web";
    expect(previewThreadName(polluted, "阅读下本地未提交代码")).toBe(
      "阅读下本地未提交代码",
    );
    expect(
      previewThreadName(
        "<rules> # Development Guidelines AGENTS.md ...",
        "Grok Session",
      ),
    ).toBe("Grok Session");
    // 正常用户首句仍保留
    expect(previewThreadName("git pull 更新下代码 解决下冲突", "Grok Session")).toBe(
      "git pull 更新下代码 解决下冲突",
    );
  });

  it("normalizes shared-session and mode fallback wrappers", () => {
    const sharedSessionText = [
      "Shared session context sync. Continue from these recent turns before answering the new request:",
      "",
      "Turn 1",
      "User: 之前的问题",
      "codex: 之前的回答",
      "",
      "Current user request:",
      "继续推进",
    ].join("\n");
    const modeFallbackText = [
      "Execution policy (plan mode): planning-only.",
      "",
      "User request: 只输出方案",
    ].join("\n");

    expect(normalizeUserMessageText(sharedSessionText)).toBe("继续推进");
    expect(extractModeFallbackMode(modeFallbackText)).toBe("plan");
    expect(normalizeUserMessageText(modeFallbackText)).toBe("只输出方案");
  });

  it("extracts the latest user input while preserving formatting", () => {
    const text = [
      "[System] internal",
      "[User Input] 第一轮",
      "",
      "保留换行",
      "[User Input] 第二轮",
      "1. 第一项",
      "2. 第二项",
    ].join("\n");

    expect(extractLatestUserInputTextPreserveFormatting(text)).toBe(
      "第二轮\n1. 第一项\n2. 第二项",
    );
  });

  it("strips injected title prefixes", () => {
    const text = [
      "[System] 你是 ccgui Agent。",
      "[Skill Prompt] tr-zh-en-jp",
      "[Commons Prompt] follow project rules",
      "真正的标题内容",
    ].join("\n");

    expect(stripInjectedPrefixLines(text)).toBe("真正的标题内容");
  });

  it("extracts selected agent metadata from prompt tail", () => {
    const text = [
      "请继续优化。",
      "",
      "## Agent Role and Instructions",
      "",
      "Agent Name: 后端架构师",
      "Agent Icon: agent-robot-04",
      "",
      "你是一位资深后端架构师。",
    ].join("\n");

    expect(stripAgentPromptBlockFromTail(text)).toBe("请继续优化。");
    expect(extractSelectedAgentNameFromUserMessageItem({}, text)).toBe("后端架构师");
    expect(extractSelectedAgentIconFromUserMessageItem({}, text)).toBe("agent-robot-04");
  });

  it("previews default thread names from the visible user request", () => {
    const text = [
      "[System] internal",
      "[User Input] 请帮我继续拆分模块吧",
      "",
      "## Agent Role and Instructions",
      "",
      "Agent Name: 前端架构师",
    ].join("\n");

    expect(previewThreadName(text, "Agent 1")).toBe("请帮我继续拆分模块吧");
  });

  it("builds fallback user message payload from direct text and image fields", () => {
    const payload = extractFallbackUserMessagePayload({
      text: "Collaboration mode: code.\n\nUser request: 继续实现",
      images: [" /tmp/a.png ", { url: "https://example.com/b.png" }],
    });

    expect(payload).toEqual({
      text: "继续实现",
      collaborationMode: "code",
      images: ["/tmp/a.png", "https://example.com/b.png"],
    });
  });

  it("extracts collaboration mode from user message metadata with fallback", () => {
    expect(
      extractCollaborationModeFromUserMessageItem(
        { metadata: { collaboration_mode: "plan" } },
        "code",
      ),
    ).toBe("plan");
    expect(
      extractCollaborationModeFromUserMessageItem(
        { selectedUiMode: { id: "default" } },
        null,
      ),
    ).toBe("code");
    expect(
      extractCollaborationModeFromUserMessageItem({ mode: "unknown" }, "plan"),
    ).toBe("plan");
  });
});
