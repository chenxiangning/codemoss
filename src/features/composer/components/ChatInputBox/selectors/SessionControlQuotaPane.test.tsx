// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionControlQuotaPane } from "./SessionControlQuotaPane";
import type { SessionOverviewQuotaView } from "../../../../status-panel/utils/sessionOverviewViewModel";

const windowsQuota: SessionOverviewQuotaView = {
  source: "coding_plan",
  providerLabel: "minimax",
  showRemaining: false,
  planType: null,
  windows: [
    {
      id: "five_hour",
      label: "5小时",
      displayPercent: 42,
      usedPercent: 42,
      resetsAt: null,
    },
  ],
  creditsBalance: null,
  creditsUnlimited: false,
  hasCredits: false,
  error: null,
  loading: false,
};

const balanceQuota: SessionOverviewQuotaView = {
  source: "coding_plan",
  providerLabel: "deepseek",
  showRemaining: false,
  planType: null,
  windows: [],
  creditsBalance: "CNY 110.00",
  creditsUnlimited: false,
  hasCredits: true,
  error: null,
  loading: false,
};

describe("SessionControlQuotaPane", () => {
  it("renders coding-plan window metrics from overview view model", () => {
    render(<SessionControlQuotaPane quota={windowsQuota} />);

    const pane = screen.getByTestId("composer-session-quota-pane");
    expect(pane.textContent).toMatch(/42%/);
    expect(pane.textContent).toMatch(/minimax/i);
  });

  it("renders balance-only deepseek credits without windows", () => {
    render(<SessionControlQuotaPane quota={balanceQuota} />);

    const pane = screen.getByTestId("composer-session-quota-pane");
    expect(pane.textContent).toContain("CNY 110.00");
    expect(pane.textContent).toMatch(/deepseek/i);
  });

  it("invokes onRefresh when refresh is clicked", () => {
    const onRefresh = vi.fn();
    render(
      <SessionControlQuotaPane quota={windowsQuota} onRefresh={onRefresh} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
