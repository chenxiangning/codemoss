// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  piAuthDeleteCredential,
  piAuthListProviders,
  piAuthSetApiKey,
  type PiAuthListResult,
  type PiAuthProviderSnapshot,
} from "../../../services/tauri/piAuth";
import { PI_AUTH_APIKEY_PROVIDERS } from "../piAuthProviderCatalog";
import { PiProviderAuthSection } from "./PiProviderAuthSection";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      options?.defaultValue ?? key,
  }),
}));

vi.mock("../../../services/tauri/piAuth", () => ({
  piAuthListProviders: vi.fn(),
  piAuthSetApiKey: vi.fn(),
  piAuthDeleteCredential: vi.fn(),
}));

const mockList = vi.mocked(piAuthListProviders);
const mockSet = vi.mocked(piAuthSetApiKey);
const mockDelete = vi.mocked(piAuthDeleteCredential);

function snap(
  id: string,
  state: PiAuthProviderSnapshot["state"],
  extra: Partial<PiAuthProviderSnapshot> = {},
): PiAuthProviderSnapshot {
  return {
    id,
    envVar: `${id.toUpperCase().replace(/-/g, "_")}_API_KEY`,
    state,
    oauthSubscribed: false,
    ...extra,
  };
}

function snapshotFixture(): PiAuthListResult {
  const providers: PiAuthProviderSnapshot[] = [
    snap("anthropic", "configured", {
      maskedKey: "sk-ant········3f2a",
      keySource: "literal",
      oauthSubscribed: true,
      envVar: "ANTHROPIC_API_KEY",
    }),
    snap("openai", "none", { envVar: "OPENAI_API_KEY" }),
    snap("deepseek", "env", { envVar: "DEEPSEEK_API_KEY" }),
    snap("github-copilot", "none", { envVar: null }),
    snap("xai", "none", { envVar: "XAI_API_KEY" }),
    snap("openrouter", "none", { envVar: "OPENROUTER_API_KEY" }),
    snap("radius", "none", { envVar: "RADIUS_API_KEY" }),
  ];
  return {
    authFile: { path: "/home/u/.pi/agent/auth.json", exists: true },
    providers,
  };
}

beforeEach(() => {
  mockList.mockResolvedValue(snapshotFixture());
  mockSet.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

async function renderSection() {
  const view = render(<PiProviderAuthSection />);
  await waitFor(() => expect(mockList).toHaveBeenCalledTimes(1));
  return view;
}

describe("PiProviderAuthSection", () => {
  it("renders configured / env / none states with distinct actions", async () => {
    await renderSection();

    // configured：mask chip + 编辑 + 删除
    expect(screen.getByText("sk-ant········3f2a")).toBeTruthy();
    expect(screen.getByText("编辑")).toBeTruthy();
    expect(screen.getByText("删除")).toBeTruthy();
    // env：覆盖设置
    expect(screen.getByText("环境变量生效中")).toBeTruthy();
    expect(screen.getByText("覆盖设置")).toBeTruthy();
    // none：设置 Key（openai / xai / openrouter 等 featured）
    expect(screen.getAllByText("设置 Key").length).toBeGreaterThan(0);
  });

  it("shows oauth subscription states and requests terminal login", async () => {
    const events: CustomEvent[] = [];
    const listener = (event: Event) => events.push(event as CustomEvent);
    document.addEventListener("mossx:terminal-command-request", listener);
    try {
      await renderSection();

      expect(screen.getByText("已授权 · 自动刷新")).toBeTruthy();
      expect(screen.getAllByText("未授权").length).toBeGreaterThan(0);

      const loginButtons = screen.getAllByText("登录");
      expect(loginButtons).toHaveLength(6);
      fireEvent.click(loginButtons[1]); // openai 行
      expect(events).toHaveLength(1);
      expect(events[0].detail).toEqual({
        terminalId: "pi-login-openai",
        title: "pi /login openai",
        command: "pi",
        followUpCommand: "/login openai",
        followUpDelayMs: 1500,
      });
    } finally {
      document.removeEventListener("mossx:terminal-command-request", listener);
    }
  });

  it("quotes a custom pi bin containing spaces", async () => {
    const events: CustomEvent[] = [];
    const listener = (event: Event) => events.push(event as CustomEvent);
    document.addEventListener("mossx:terminal-command-request", listener);
    try {
      render(<PiProviderAuthSection piBin="/opt/my tools/pi" />);
      await waitFor(() => expect(mockList).toHaveBeenCalled());
      fireEvent.click(screen.getAllByText("登录")[0]); // anthropic 行
      expect(events[0].detail.command).toBe('"/opt/my tools/pi"');
      expect(events[0].detail.followUpCommand).toBe("/login anthropic");
    } finally {
      document.removeEventListener("mossx:terminal-command-request", listener);
    }
  });

  it("opens inline editor, cancels on empty save, persists on value save", async () => {
    await renderSection();

    const setButtons = screen.getAllByText("设置 Key");
    fireEvent.click(setButtons[0]); // openai
    const editor = await screen.findByTestId("pi-auth-editor-openai");
    expect(editor).toBeTruthy();

    // 留空保存 = 取消，不调用后端
    fireEvent.click(screen.getByText("保存"));
    expect(mockSet).not.toHaveBeenCalled();
    expect(screen.queryByTestId("pi-auth-editor-openai")).toBeNull();

    // 重新展开并输入保存
    fireEvent.click(screen.getAllByText("设置 Key")[0]);
    const input = await screen.findByPlaceholderText(/粘贴 OPENAI_API_KEY/);
    fireEvent.change(input, { target: { value: "  sk-proj-abc  " } });
    fireEvent.click(screen.getByText("保存"));
    await waitFor(() =>
      expect(mockSet).toHaveBeenCalledWith("openai", "sk-proj-abc"),
    );
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
  });

  it("keeps only one editor expanded at a time", async () => {
    await renderSection();
    fireEvent.click(screen.getAllByText("设置 Key")[0]); // openai
    await screen.findByTestId("pi-auth-editor-openai");
    fireEvent.click(screen.getByText("覆盖设置")); // deepseek
    await screen.findByTestId("pi-auth-editor-deepseek");
    expect(screen.queryByTestId("pi-auth-editor-openai")).toBeNull();
  });

  it("requires confirmation before deleting a credential", async () => {
    await renderSection();
    fireEvent.click(screen.getByText("删除"));
    // 确认前不调用后端
    expect(mockDelete).not.toHaveBeenCalled();
    const confirm = await screen.findByText(
      "settings.vendor.deleteConfirm.confirm",
    );
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(mockDelete).toHaveBeenCalledWith("anthropic"),
    );
    await waitFor(() => expect(mockList).toHaveBeenCalledTimes(2));
  });

  it("filters providers by search and toggles the full catalog", async () => {
    await renderSection();

    // 默认只展示 featured（16），Baseten 折叠
    expect(screen.queryByText("Baseten")).toBeNull();
    fireEvent.click(screen.getByText(/显示全部/));
    expect(screen.getByText("Baseten")).toBeTruthy();
    expect(screen.getAllByText("设置 Key").length).toBeGreaterThan(10);

    const search = screen.getByPlaceholderText("筛选供应商…");
    fireEvent.change(search, { target: { value: "deep" } });
    expect(screen.getByText("DeepSeek")).toBeTruthy();
    expect(screen.queryByText("Mistral")).toBeNull();
    expect(
      screen.getByText(/没有匹配|DeepSeek/, { exact: false }),
    ).toBeTruthy();
  });

  it("collapses search across non-featured providers", async () => {
    await renderSection();
    const search = screen.getByPlaceholderText("筛选供应商…");
    fireEvent.change(search, { target: { value: "baseten" } });
    expect(screen.getByText("Baseten")).toBeTruthy();
    expect(screen.queryByText("Anthropic")).toBeNull();
  });

  it("renders load failure without crashing", async () => {
    mockList.mockRejectedValueOnce(new Error("[PI_AUTH_CORRUPTED] bad json"));
    await renderSection();
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText(/PI_AUTH_CORRUPTED/)).toBeTruthy();
  });

  it("catalog stays aligned with the 35 api-key provider ids", () => {
    expect(PI_AUTH_APIKEY_PROVIDERS).toHaveLength(35);
    const featured = PI_AUTH_APIKEY_PROVIDERS.filter((p) => p.featured);
    expect(featured).toHaveLength(16);
    const ids = new Set(PI_AUTH_APIKEY_PROVIDERS.map((p) => p.id));
    expect(ids.size).toBe(35);
    expect(ids.has("github-copilot")).toBe(false);
  });
});
