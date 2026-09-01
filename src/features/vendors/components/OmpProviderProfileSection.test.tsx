// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings } from "@/types";
import { getAppSettings, getEngineModels, updateAppSettings } from "@/services/tauri";
import { OmpProviderProfileSection } from "./OmpProviderProfileSection";
import {
  persistOmpProviderProfile,
  readOmpProviderProfile,
} from "../../engine/omp/ompProviderProfile";
import { OMP_LOCAL_PROVIDER_PROFILE_ID } from "../../threads/constants/codexProviderProfiles";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_key: string, options?: { defaultValue?: string; count?: number }) => options?.defaultValue ?? _key }),
}));

vi.mock("@/services/tauri", () => ({
  getAppSettings: vi.fn(),
  getEngineModels: vi.fn(),
  updateAppSettings: vi.fn(),
}));

vi.mock("../../engine/omp/ompProviderProfile", () => ({
  normalizeOmpProviderProfile: (value: { binaryPath?: string | null; profileId?: string | null; profileName?: string | null }) => {
    const profileId = value.profileId?.trim();
    const profileName = value.profileName?.trim();
    if (!profileId || !profileName) return null;
    return {
      binaryPath: value.binaryPath?.trim() || null,
      profileId,
      profileName,
    };
  },
  persistOmpProviderProfile: vi.fn(),
  readOmpProviderProfile: vi.fn(() => null),
}));

const getAppSettingsMock = vi.mocked(getAppSettings);
const getEngineModelsMock = vi.mocked(getEngineModels);
const updateAppSettingsMock = vi.mocked(updateAppSettings);
const persistMock = vi.mocked(persistOmpProviderProfile);
const readMock = vi.mocked(readOmpProviderProfile);

function openAdvanced() {
  fireEvent.click(screen.getByText("高级：配置方案（Profile）"));
}

beforeEach(() => {
  vi.clearAllMocks();
  getAppSettingsMock.mockResolvedValue({} as AppSettings);
  getEngineModelsMock.mockResolvedValue([]);
  updateAppSettingsMock.mockResolvedValue({} as AppSettings);
  readMock.mockReturnValue(null);
});

describe("OmpProviderProfileSection", () => {
  it("renders the binary path up front and keeps profile fields behind advanced", () => {
    render(<OmpProviderProfileSection />);

    expect(screen.getByLabelText("OMP 可执行文件路径")).toBeTruthy();
    // Profile 元数据是高级选项：details 默认折叠（jsdom 中子元素仍在 DOM，
    // 以 open 属性断言折叠态），展开后表单可编辑。
    const advanced = screen
      .getByText("高级：配置方案（Profile）")
      .closest("details");
    expect(advanced).toBeTruthy();
    expect(advanced?.hasAttribute("open")).toBe(false);
    openAdvanced();
    expect(advanced?.hasAttribute("open")).toBe(true);
    expect(screen.getByLabelText("配置方案标识（Profile id）")).toBeTruthy();
    expect(screen.getByLabelText("配置方案显示名")).toBeTruthy();
    expect(screen.getByTestId("omp-catalog-status").textContent).toContain(
      "尚未检测",
    );
  });

  it("applies runtime config before persisting a valid profile", async () => {
    render(<OmpProviderProfileSection />);
    openAdvanced();
    fireEvent.change(screen.getByLabelText("OMP 可执行文件路径"), {
      target: { value: "/opt/omp" },
    });
    fireEvent.change(screen.getByLabelText("配置方案标识（Profile id）"), {
      target: { value: "team.local" },
    });
    fireEvent.change(screen.getByLabelText("配置方案显示名"), {
      target: { value: "Team local" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(getAppSettingsMock).toHaveBeenCalledTimes(1);
      expect(updateAppSettingsMock).toHaveBeenCalledWith({
        ompBin: "/opt/omp",
      });
      expect(persistMock).toHaveBeenCalledWith({
        binaryPath: "/opt/omp",
        profileId: "team.local",
        profileName: "Team local",
      });
    });
    expect(screen.getByText("已保存。")).toBeTruthy();
  });

  it("detects the model catalog without requiring a saved profile", async () => {
    getEngineModelsMock.mockResolvedValue([]);
    render(<OmpProviderProfileSection />);
    fireEvent.click(screen.getByRole("button", { name: "检测模型目录" }));

    await waitFor(() => {
      expect(getEngineModelsMock).toHaveBeenCalledWith("omp", {
        forceRefresh: true,
        providerProfileId: OMP_LOCAL_PROVIDER_PROFILE_ID,
      });
      expect(screen.getByTestId("omp-catalog-status").textContent).toContain(
        "没有返回任何模型",
      );
    });
    expect(screen.queryByText(/models available/)).toBeNull();
  });

  it("surfaces catalog failures verbatim", async () => {
    getEngineModelsMock.mockRejectedValue(new Error("native catalog unavailable"));
    render(<OmpProviderProfileSection />);
    fireEvent.click(screen.getByRole("button", { name: "检测模型目录" }));

    expect(await screen.findByText("native catalog unavailable")).toBeTruthy();
  });
});
