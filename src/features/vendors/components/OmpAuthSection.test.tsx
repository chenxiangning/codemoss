// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ompAuthBrokerListProviders,
  ompAuthBrokerStatus,
  ompAuthLocalAccounts,
} from "../../../services/tauri/ompAuth";
import { requestTerminalCommand } from "../../terminal/utils/terminalCommandRequestEvent";
import { OmpAuthSection } from "./OmpAuthSection";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

vi.mock("../../../services/tauri/ompAuth", () => ({
  ompAuthBrokerListProviders: vi.fn(),
  ompAuthBrokerStatus: vi.fn(),
  ompAuthLocalAccounts: vi.fn(),
}));

vi.mock("../../terminal/utils/terminalCommandRequestEvent", () => ({
  requestTerminalCommand: vi.fn(),
}));

const statusMock = vi.mocked(ompAuthBrokerStatus);
const listMock = vi.mocked(ompAuthBrokerListProviders);
const localAccountsMock = vi.mocked(ompAuthLocalAccounts);
const terminalMock = vi.mocked(requestTerminalCommand);

beforeEach(() => {
  vi.clearAllMocks();
  statusMock.mockResolvedValue({ state: "not-configured", configured: false });
  listMock.mockResolvedValue([
    { id: "anthropic", name: "Anthropic (Claude Pro/Max)" },
  ]);
  localAccountsMock.mockResolvedValue([]);
});

describe("OmpAuthSection", () => {
  it("lists providers and launches provider login in the terminal", async () => {
    render(<OmpAuthSection ompBin="/opt/omp/omp" />);

    expect(await screen.findByText("Anthropic (Claude Pro/Max)")).toBeTruthy();
    expect(screen.getByText("尚未登录任何供应商")).toBeTruthy();
    expect(screen.getByTestId("omp-auth-section").querySelector(".vendor-omp-auth-provider-card")).toBeTruthy();
    expect(screen.getByTestId("omp-auth-section").querySelector(".vendor-omp-auth-provider-icon img")).toBeTruthy();
    expect(screen.getByText("1 个可登录供应商")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    expect(terminalMock).toHaveBeenCalledWith({
      terminalId: "omp-auth-login-anthropic",
      title: "omp auth-broker login anthropic",
      command: "'/opt/omp/omp' auth-broker login 'anthropic'",
    });
  });

  it("reflects local login state with a badge and offers logout", async () => {
    localAccountsMock.mockResolvedValue([
      {
        provider: "anthropic",
        credentialType: "oauth",
        identity: "dev@example.com",
        disabledCause: null,
        updatedAt: 1788156480,
      },
    ]);
    render(<OmpAuthSection />);

    expect(await screen.findByText("已登录 1 个供应商")).toBeTruthy();
    expect(screen.getByText("已登录")).toBeTruthy();
    expect(screen.getByText("dev@example.com")).toBeTruthy();

    // 摘要区与供应商列表行各有一个退出入口，行为一致。
    const logoutButtons = screen.getAllByRole("button", { name: "退出登录" });
    expect(logoutButtons.length).toBe(2);
    fireEvent.click(logoutButtons[0]!);

    expect(terminalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        terminalId: "omp-auth-logout-anthropic",
        command: "'omp' auth-broker logout 'anthropic'",
      }),
    );
  });
  it("renders an authenticated provider that is absent from the broker catalog", async () => {
    listMock.mockResolvedValue([]);
    localAccountsMock.mockResolvedValue([
      {
        provider: "minimax-code-cn",
        credentialType: "api_key",
        identity: null,
        disabledCause: null,
        updatedAt: 1788156480,
      },
    ]);
    render(<OmpAuthSection />);

    expect(await screen.findByText("minimax-code-cn")).toBeTruthy();
    expect(screen.getByText("已登录 1 个供应商")).toBeTruthy();
  });

  it("degrades gracefully when the local account probe fails", async () => {
    localAccountsMock.mockRejectedValue(new Error("OMP agent database not found"));
    render(<OmpAuthSection />);

    expect(
      await screen.findByText("无法读取本地登录信息（请确认 OMP CLI 已安装）"),
    ).toBeTruthy();
    // 供应商目录仍可用，登录入口不丢。
    expect(await screen.findByRole("button", { name: "登录" })).toBeTruthy();
  });
});
