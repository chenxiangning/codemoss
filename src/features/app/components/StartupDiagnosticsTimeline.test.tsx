// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { StartupTraceEvent } from "../../startup-orchestration/utils/startupTrace";
import { StartupDiagnosticsTimeline } from "./StartupDiagnosticsTimeline";

const TRANSLATIONS: Record<string, string> = {
  "runtimeNotice.startupTimeline.title": "后台工作时间轴",
  "runtimeNotice.startupTimeline.summary":
    "{{rawCount}} 条原始记录 · 合并为 {{nodeCount}} 个节点",
  "runtimeNotice.startupTimeline.sections.startup": "启动阶段",
  "runtimeNotice.startupTimeline.sections.startupHint": "按 startup trace 顺序",
  "runtimeNotice.startupTimeline.sections.runtime": "运行阶段",
  "runtimeNotice.startupTimeline.sections.runtimeHint": "按 runtime notice 时间",
  "runtimeNotice.startupTimeline.empty": "暂无记录",
  "runtimeNotice.startupTimeline.globalProject": "全局",
  "runtimeNotice.startupTimeline.projectSummary": "{{name}} +{{count}}",
  "runtimeNotice.startupTimeline.count": "×{{count}}",
  "runtimeNotice.startupTimeline.duration.single": "用时 {{duration}}",
  "runtimeNotice.startupTimeline.duration.total": "累计 {{duration}}",
  "runtimeNotice.startupTimeline.duration.unavailable": "耗时 —",
  "runtimeNotice.startupTimeline.status.completed": "完成",
  "runtimeNotice.startupTimeline.detail.label": "查看 {{title}} 详情",
  "runtimeNotice.startupTimeline.detail.project": "项目",
  "runtimeNotice.startupTimeline.detail.workspacePath": "完整路径",
  "runtimeNotice.startupTimeline.detail.workspaceId": "Workspace ID",
  "runtimeNotice.startupTimeline.detail.workspaceCatalog":
    "项目清单（来自本地缓存）",
  "runtimeNotice.startupTimeline.detail.phase": "阶段",
  "runtimeNotice.startupTimeline.detail.sources": "来源",
  "runtimeNotice.startupTimeline.detail.technical": "技术标识",
  "runtimeNotice.startupTimeline.detail.timing": "耗时明细",
  "runtimeNotice.startupTimeline.detail.first": "首次",
  "runtimeNotice.startupTimeline.detail.latest": "最近",
  "runtimeNotice.startupTimeline.detail.max": "最慢",
  "runtimeNotice.startupTimeline.detail.total": "累计",
  "runtimeNotice.startupTimeline.detail.durationSamples": "{{count}} 次记录到耗时",
  "runtimeNotice.startupTimeline.detail.noPath": "未记录完整路径",
  "runtimeNotice.startupTimeline.operations.session-catalog.title": "刷新会话列表",
  "runtimeNotice.startupTimeline.operations.session-catalog.description":
    "读取该项目下各 CLI 的会话索引、标题与归属，更新侧边栏可恢复会话；不加载完整对话正文。",
  "runtimeNotice.startupTimeline.operations.workspace-catalog.title": "获取工作区",
  "runtimeNotice.startupTimeline.operations.workspace-catalog.description":
    "读取工作区清单、项目名称与路径。",
};

function translate(
  key: string,
  params?: Record<string, string | number | boolean | null | undefined>,
) {
  let value = TRANSLATIONS[key] ?? key;
  for (const [name, replacement] of Object.entries(params ?? {})) {
    value = value.replaceAll(`{{${name}}}`, String(replacement));
  }
  return value;
}

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: translate }),
}));

function sessionCommand(
  sequence: number,
  durationMs: number,
): Extract<StartupTraceEvent, { type: "command" }> {
  return {
    type: "command",
    sequence,
    timestamp: sequence,
    commandLabel: "list_threads",
    workspaceScope: { workspaceId: "ws-alpha" },
    durationMs,
    status: "completed",
  };
}

describe("StartupDiagnosticsTimeline", () => {
  it("renders one compact project-aware timeline node for repeated work", () => {
    render(
      <StartupDiagnosticsTimeline
        events={[sessionCommand(1, 120), sessionCommand(2, 80)]}
        notices={[]}
        workspaces={[
          { id: "ws-alpha", name: "mossx", path: "/repo/mossx" },
        ]}
      />,
    );

    expect(screen.getByTestId("startup-gate-timeline")).toBeTruthy();
    expect(screen.getByTestId("startup-timeline-section-startup")).toBeTruthy();
    expect(screen.getByTestId("startup-timeline-section-runtime")).toBeTruthy();
    const node = screen.getByTestId("startup-timeline-node");
    expect(node.getAttribute("data-operation")).toBe("session-catalog");
    expect(node.textContent).toContain("刷新会话列表");
    expect(node.textContent).toContain("mossx");
    expect(node.textContent).toContain("×2");
    expect(node.textContent).toContain("累计 200ms");
    expect(node.textContent).toContain("不加载完整对话正文");
  });

  it("exposes path, technical identifiers, and timing by keyboard focus and click", () => {
    render(
      <StartupDiagnosticsTimeline
        events={[sessionCommand(1, 120), sessionCommand(2, 80)]}
        notices={[]}
        workspaces={[
          { id: "ws-alpha", name: "mossx", path: "/repo/mossx" },
        ]}
      />,
    );

    const node = screen.getByRole("button", { name: "查看 刷新会话列表 详情" });
    fireEvent.focus(node);
    const detail = screen.getByRole("tooltip");
    expect(detail.textContent).toContain("/repo/mossx");
    expect(detail.textContent).toContain("ws-alpha");
    expect(detail.textContent).toContain("cmd:list_threads");
    expect(detail.textContent).toContain("首次");
    expect(detail.textContent).toContain("120ms");
    expect(detail.textContent).toContain("最近");
    expect(detail.textContent).toContain("80ms");
    expect(detail.textContent).toContain("最慢");
    expect(detail.textContent).toContain("累计");

    fireEvent.keyDown(node, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.click(node);
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });

  it("lists cached project names and paths for workspace discovery", () => {
    render(
      <StartupDiagnosticsTimeline
        events={[
          {
            type: "command",
            sequence: 1,
            timestamp: 1,
            commandLabel: "list_workspaces",
            workspaceScope: "global",
            durationMs: 26,
            status: "completed",
          },
        ]}
        notices={[]}
        workspaces={[
          { id: "ws-alpha", name: "mossx", path: "/repo/mossx" },
          { id: "ws-beta", name: "docs", path: "/repo/docs" },
        ]}
      />,
    );

    const node = screen.getByRole("button", { name: "查看 获取工作区 详情" });
    expect(node.textContent).toContain("mossx +1");
    fireEvent.focus(node);
    const detail = screen.getByRole("tooltip");
    expect(detail.textContent).toContain("项目清单（来自本地缓存）");
    expect(detail.textContent).toContain("mossx");
    expect(detail.textContent).toContain("/repo/mossx");
    expect(detail.textContent).toContain("docs");
    expect(detail.textContent).toContain("/repo/docs");
  });
});
