import { describe, expect, it } from "vitest";
import {
  applyPendingClaudeMcpOutputNoticeToAgentCompleted,
  applyPendingClaudeMcpOutputNoticeToAgentDelta,
  clearPendingClaudeMcpOutputNotice,
  rewriteClaudePlaywrightAlias,
  setPendingClaudeMcpOutputNotice,
} from "./claudeMcpRuntimeSnapshot";

describe("claudeMcpRuntimeSnapshot", () => {
  it("injects pending MCP notice into first assistant delta and completed text", () => {
    const workspaceId = "ws-notice-delta";
    const threadId = "claude:session-1";
    const notice = "MCP 路由提示：检测到 `playwright-mcp`，当前会话已自动映射为 `chrome-devtools`。";

    setPendingClaudeMcpOutputNotice(workspaceId, threadId, notice);

    const firstDelta = applyPendingClaudeMcpOutputNoticeToAgentDelta(
      workspaceId,
      threadId,
      "这是正文首段。",
    );
    expect(firstDelta).toContain(notice);
    expect(firstDelta).toContain("这是正文首段。");

    const secondDelta = applyPendingClaudeMcpOutputNoticeToAgentDelta(
      workspaceId,
      threadId,
      "这是后续增量。",
    );
    expect(secondDelta).toBe("这是后续增量。");

    const completed = applyPendingClaudeMcpOutputNoticeToAgentCompleted(
      workspaceId,
      threadId,
      "这是最终正文。",
    );
    expect(completed).toContain(notice);
    expect(completed).toContain("这是最终正文。");

    const completedAfterClear = applyPendingClaudeMcpOutputNoticeToAgentCompleted(
      workspaceId,
      threadId,
      "第二次完成不应再注入。",
    );
    expect(completedAfterClear).toBe("第二次完成不应再注入。");
  });

  it("supports pending->finalized claude thread rename fallback for notice injection", () => {
    const workspaceId = "ws-notice-rename";
    const pendingThreadId = "claude-pending-abc";
    const finalizedThreadId = "claude:session-abc";
    const notice = "MCP 路由提示：fallback rename";

    setPendingClaudeMcpOutputNotice(workspaceId, pendingThreadId, notice);
    const delta = applyPendingClaudeMcpOutputNoticeToAgentDelta(
      workspaceId,
      finalizedThreadId,
      "正文",
    );
    expect(delta).toContain(notice);
    expect(delta).toContain("正文");

    clearPendingClaudeMcpOutputNotice(workspaceId, pendingThreadId);
    clearPendingClaudeMcpOutputNotice(workspaceId, finalizedThreadId);
  });

  it("does not inject notice when multiple pending claude threads are ambiguous", () => {
    const workspaceId = "ws-notice-ambiguous";
    setPendingClaudeMcpOutputNotice(workspaceId, "claude-pending-a", "notice-a");
    setPendingClaudeMcpOutputNotice(workspaceId, "claude-pending-b", "notice-b");

    const delta = applyPendingClaudeMcpOutputNoticeToAgentDelta(
      workspaceId,
      "claude:session-final",
      "正文",
    );
    expect(delta).toBe("正文");

    clearPendingClaudeMcpOutputNotice(workspaceId, "claude-pending-a");
    clearPendingClaudeMcpOutputNotice(workspaceId, "claude-pending-b");
  });

  it("returns diagnostics when playwright alias is mentioned without snapshot", () => {
    const result = rewriteClaudePlaywrightAlias(
      "ws-alias-no-snapshot",
      "请用 playwright-mcp 读取页面",
    );
    expect(result.aliasMentioned).toBe(true);
    expect(result.applied).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
});
