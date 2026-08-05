// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SessionOverviewSection } from "./SessionOverviewSection";
import { buildSessionOverview } from "../utils/sessionOverviewViewModel";

const NOW = 1_800_000_000_000;

describe("SessionOverviewSection", () => {
  it("renders the empty state when no session content exists", () => {
    const overview = buildSessionOverview({
      sessionId: null,
      engine: null,
      model: null,
      workspaceName: null,
      workspacePath: null,
      sessionDiskPath: null,
      isProcessing: false,
      threadStatus: null,
      items: [],
      tokenUsage: null,
      rateLimits: null,
      usageShowRemaining: false,
      codingPlanQuota: null,
      nowMs: NOW,
    });

    render(<SessionOverviewSection overview={overview} />);

    expect(screen.getByLabelText("Overview")).toBeTruthy();
    expect(screen.getByText("No active session yet")).toBeTruthy();
  });

  it("renders codex quota windows with remaining mode and session path", () => {
    const overview = buildSessionOverview({
      sessionId: "thread-42",
      engine: "codex",
      model: "gpt-5",
      workspaceName: "mossx",
      workspacePath: "/Users/dev/code/mossx",
      sessionDiskPath: "/Users/dev/.codex/sessions/thread-42.jsonl",
      isProcessing: true,
      threadStatus: { isProcessing: true, processingStartedAt: NOW - 65_000 },
      items: [
        { id: "u1", kind: "message", role: "user", text: "hi" },
        { id: "a1", kind: "message", role: "assistant", text: "hello" },
      ],
      tokenUsage: {
        contextUsedPercent: 42,
        contextUsedTokens: 84_000,
        modelContextWindow: 200_000,
      } as Parameters<typeof buildSessionOverview>[0]["tokenUsage"],
      rateLimits: {
        primary: {
          usedPercent: 40,
          windowDurationMins: 300,
          resetsAt: null,
        },
        secondary: {
          usedPercent: 20,
          windowDurationMins: 10_080,
          resetsAt: null,
        },
        credits: { hasCredits: true, unlimited: false, balance: "3.2" },
        planType: "plus",
      },
      usageShowRemaining: true,
      codingPlanQuota: null,
      nowMs: NOW,
    });

    const { container } = render(<SessionOverviewSection overview={overview} />);

    expect(container.querySelector(".sp-session-overview")).toBeTruthy();
    // 状态文案已迁到 Tab badge，内容区不再重复渲染 Running/Idle
    expect(screen.queryByText("Running")).toBeNull();
    expect(screen.getByText("thread-42")).toBeTruthy();
    expect(screen.getByText("/Users/dev/code/mossx")).toBeTruthy();
    expect(
      screen.getByText("/Users/dev/.codex/sessions/thread-42.jsonl"),
    ).toBeTruthy();
    expect(screen.getByText("Codex account limits")).toBeTruthy();
    expect(screen.getByText("plus")).toBeTruthy();
    expect(screen.getByText("5h limit")).toBeTruthy();
    expect(screen.getByText("Weekly limit")).toBeTruthy();
    expect(screen.getByText(/60% remaining/)).toBeTruthy();
    expect(screen.getByText(/80% remaining/)).toBeTruthy();
    expect(screen.getByText("Credits")).toBeTruthy();
    expect(screen.getByText("3.2")).toBeTruthy();
    expect(screen.queryByText(/Rate limit used/)).toBeNull();
  });

  it("does not paint codex windows onto kimi sessions; shows coding-plan windows instead", () => {
    const overview = buildSessionOverview({
      sessionId: "kimi-1",
      engine: "kimi",
      model: "k2",
      workspaceName: "mossx",
      workspacePath: "/tmp/mossx",
      sessionDiskPath: null,
      isProcessing: false,
      threadStatus: null,
      items: [],
      tokenUsage: null,
      rateLimits: {
        primary: { usedPercent: 90, windowDurationMins: 300, resetsAt: null },
        secondary: null,
        credits: null,
        planType: "plus",
      },
      usageShowRemaining: false,
      codingPlanQuota: {
        source: "kimi",
        success: true,
        windows: [
          {
            id: "five_hour",
            usedPercent: 20,
            remainingPercent: 80,
            resetsAt: null,
          },
          {
            id: "weekly_limit",
            usedPercent: 5,
            remainingPercent: 95,
            resetsAt: null,
          },
        ],
      },
      nowMs: NOW,
    });

    render(<SessionOverviewSection overview={overview} />);

    expect(screen.getByText("kimi-1")).toBeTruthy();
    expect(screen.getByText("Session file path not resolved")).toBeTruthy();
    expect(screen.getByText("kimi plan limits")).toBeTruthy();
    expect(screen.getByText("5小时")).toBeTruthy();
    expect(screen.getByText("7天")).toBeTruthy();
    expect(screen.getByText(/20% used/)).toBeTruthy();
    expect(screen.getByText(/5% used/)).toBeTruthy();
    // Codex 账号窗口不得串到 kimi
    expect(screen.queryByText("5h limit")).toBeNull();
    expect(screen.queryByText(/90%/)).toBeNull();
  });

  it("renders multiple provider quota cards for shared-session history", () => {
    const overview = buildSessionOverview({
      sessionId: "shared:abc",
      engine: "claude",
      model: "MiniMax-M3",
      workspaceName: "demo",
      workspacePath: "/tmp/demo",
      sessionDiskPath: null,
      isProcessing: false,
      threadStatus: null,
      items: [],
      tokenUsage: null,
      rateLimits: null,
      usageShowRemaining: false,
      nowMs: NOW,
      quotaEntries: [
        {
          key: "claude::local",
          title: "Claude · 本地配置",
          subtitle: "k3",
          engine: "claude",
          providerProfileId: "local",
          codingPlanQuota: {
            source: "kimi",
            success: true,
            windows: [
              { id: "five_hour", usedPercent: 24, remainingPercent: 76 },
            ],
          },
        },
        {
          key: "claude::minimax",
          title: "Claude · Minimax-m3",
          subtitle: "MiniMax-M3",
          engine: "claude",
          providerProfileId: "minimax",
          codingPlanQuota: {
            source: "minimax",
            success: true,
            windows: [
              { id: "five_hour", usedPercent: 1, remainingPercent: 99 },
              { id: "weekly_limit", usedPercent: 11, remainingPercent: 89 },
            ],
          },
        },
      ],
    });

    render(<SessionOverviewSection overview={overview} />);

    expect(screen.getByText("Providers")).toBeTruthy();
    // 供应商行 + 各额度卡标题都会出现
    expect(screen.getAllByText(/Claude · 本地配置/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Claude · Minimax-m3/).length).toBeGreaterThan(0);
    expect(screen.getByText("kimi plan limits")).toBeTruthy();
    expect(screen.getByText("minimax plan limits")).toBeTruthy();
    expect(screen.getByText("24% used")).toBeTruthy();
    expect(screen.getByText("1% used")).toBeTruthy();
    expect(screen.getByText("11% used")).toBeTruthy();
  });

  it("renders deepseek balance credits without coding-plan empty placeholder", () => {
    const overview = buildSessionOverview({
      sessionId: "thread-ds",
      engine: "codex",
      model: "deepseek-v4-flash",
      workspaceName: "demo",
      workspacePath: "/tmp/demo",
      sessionDiskPath: null,
      isProcessing: false,
      threadStatus: null,
      items: [],
      tokenUsage: null,
      rateLimits: {
        primary: { usedPercent: 50, windowDurationMins: 300, resetsAt: null },
        secondary: null,
        credits: null,
        planType: "plus",
      },
      usageShowRemaining: false,
      nowMs: NOW,
      codingPlanQuota: {
        source: "deepseek",
        success: true,
        planLabel: "available",
        windows: [],
        balance: {
          isAvailable: true,
          items: [{ currency: "CNY", totalBalance: "110.00" }],
        },
      },
    });

    render(<SessionOverviewSection overview={overview} />);

    // 余额型两行：标题 +「额度 / 金额」，去掉 available 与套餐副标题
    expect(screen.getByText("deepseek plan limits")).toBeTruthy();
    expect(screen.getByText("Credits")).toBeTruthy();
    expect(screen.getByText("CNY 110.00")).toBeTruthy();
    expect(screen.queryByText("available")).toBeNull();
    // 无 windows 时不得渲染 coding plan empty
    expect(
      screen.queryByText(
        "Coding-plan provider recognized, but no limit windows were returned.",
      ),
    ).toBeNull();
    // 不得展示 Codex 官方百分比窗口
    expect(screen.queryByText("5h limit")).toBeNull();
    expect(screen.queryByText(/50%/)).toBeNull();
  });

  it("renders multi-entry deepseek balance as two rows without plan subhead", () => {
    const overview = buildSessionOverview({
      sessionId: "shared:ds",
      engine: "codex",
      model: "deepseek-v4-flash",
      workspaceName: "demo",
      workspacePath: "/tmp/demo",
      sessionDiskPath: null,
      isProcessing: false,
      threadStatus: null,
      items: [],
      tokenUsage: null,
      rateLimits: null,
      usageShowRemaining: false,
      nowMs: NOW,
      quotaEntries: [
        {
          key: "codex::deepseek",
          title: "Codex · DeepSeek-codex",
          subtitle: "deepseek-v4-flash",
          engine: "codex",
          providerProfileId: "deepseek",
          codingPlanQuota: {
            source: "deepseek",
            success: true,
            planLabel: "available",
            windows: [],
            balance: {
              isAvailable: true,
              items: [{ currency: "CNY", totalBalance: "17.26" }],
            },
          },
        },
        {
          key: "claude::minimax",
          title: "Claude · Minimax",
          subtitle: "MiniMax-M3",
          engine: "claude",
          providerProfileId: "minimax",
          codingPlanQuota: {
            source: "minimax",
            success: true,
            windows: [
              { id: "five_hour", usedPercent: 1, remainingPercent: 99 },
            ],
          },
        },
      ],
    });

    const { container } = render(<SessionOverviewSection overview={overview} />);

    expect(
      screen.getByText("Codex · DeepSeek-codex · deepseek-v4-flash"),
    ).toBeTruthy();
    expect(screen.getByText("Credits")).toBeTruthy();
    expect(screen.getByText("CNY 17.26")).toBeTruthy();
    // 不出现「deepseek 套餐额度」副标题 / available
    expect(screen.queryByText("deepseek plan limits")).toBeNull();
    expect(screen.queryByText("available")).toBeNull();
    // MiniMax 百分比卡仍正常
    expect(screen.getByText("1% used")).toBeTruthy();
    expect(
      container.querySelector(".sp-session-overview-quota.is-balance-only"),
    ).toBeTruthy();
  });
});
