// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addKimiProvider,
  deleteKimiProvider,
  getCurrentKimiConfig,
  getKimiProviders,
  switchKimiProvider,
} from "../../../services/tauri";
import type { KimiCurrentConfig, KimiProviderConfig } from "../types";
import { useKimiProviderManagement } from "./useKimiProviderManagement";

vi.mock("../../../services/tauri", () => ({
  getKimiProviders: vi.fn(),
  getCurrentKimiConfig: vi.fn(),
  addKimiProvider: vi.fn(),
  updateKimiProvider: vi.fn(),
  deleteKimiProvider: vi.fn(),
  switchKimiProvider: vi.fn(),
}));

function kimiProvider(
  id: string,
  options: Partial<KimiProviderConfig> = {},
): KimiProviderConfig {
  return {
    id,
    name: `Provider ${id.toUpperCase()}`,
    baseUrl: "https://api.example.com/v1",
    apiKey: "sk-test",
    model: "kimi-for-coding",
    ...options,
  };
}

const currentConfig: KimiCurrentConfig = {
  apiKey: "sk-test",
  baseUrl: "https://api.example.com/v1",
  defaultModel: "kimi-for-coding",
  providerId: "a",
  providerName: "Provider A",
};

describe("useKimiProviderManagement", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getKimiProviders).mockResolvedValue([]);
    vi.mocked(getCurrentKimiConfig).mockResolvedValue(currentConfig);
    vi.mocked(addKimiProvider).mockResolvedValue(undefined);
    vi.mocked(deleteKimiProvider).mockResolvedValue({
      status: "success",
    });
    vi.mocked(switchKimiProvider).mockResolvedValue(undefined);
  });

  it("loads providers and current config on mount", async () => {
    const providers = [kimiProvider("a"), kimiProvider("b", { isActive: true })];
    vi.mocked(getKimiProviders).mockResolvedValue(providers);

    const { result } = renderHook(() => useKimiProviderManagement());

    await waitFor(() => {
      expect(result.current.kimiProviders).toEqual(providers);
    });
    expect(result.current.currentKimiConfig).toEqual(currentConfig);
    expect(result.current.kimiProviderError).toBeNull();
  });

  it("keeps the provider list when current config refresh fails", async () => {
    const providers = [kimiProvider("a")];
    vi.mocked(getKimiProviders).mockResolvedValue(providers);
    vi.mocked(getCurrentKimiConfig).mockRejectedValue(new Error("no config"));

    const { result } = renderHook(() => useKimiProviderManagement());

    await waitFor(() => {
      expect(result.current.kimiProviders).toEqual(providers);
    });
    expect(result.current.currentKimiConfig).toBeNull();
    expect(result.current.kimiProviderError).toBe("no config");
  });

  it("adds a provider and reloads the list", async () => {
    const { result } = renderHook(() => useKimiProviderManagement());
    await waitFor(() => {
      expect(getKimiProviders).toHaveBeenCalledTimes(1);
    });

    const draft = kimiProvider("new");
    act(() => {
      result.current.handleAddKimiProvider();
    });
    expect(result.current.kimiProviderDialog).toEqual({
      isOpen: true,
      provider: null,
    });

    await act(async () => {
      await result.current.handleSaveKimiProvider(draft);
    });

    expect(addKimiProvider).toHaveBeenCalledWith(draft);
    expect(result.current.kimiProviderDialog).toEqual({
      isOpen: false,
      provider: null,
    });
    expect(getKimiProviders).toHaveBeenCalledTimes(2);
  });

  it("optimistically switches provider without list loading flicker", async () => {
    const providers = [kimiProvider("a"), kimiProvider("b", { isActive: true })];
    vi.mocked(getKimiProviders).mockResolvedValue(providers);

    const { result } = renderHook(() => useKimiProviderManagement());
    await waitFor(() => {
      expect(result.current.kimiProviders).toEqual(providers);
    });

    const loadsAfterMount = vi.mocked(getKimiProviders).mock.calls.length;

    await act(async () => {
      await result.current.handleSwitchKimiProvider("a");
    });

    expect(switchKimiProvider).toHaveBeenCalledWith("a");
    expect(result.current.kimiProviderError).toBeNull();
    expect(vi.mocked(getKimiProviders).mock.calls.length).toEqual(
      loadsAfterMount,
    );
    expect(result.current.kimiLoading).toBe(false);
    expect(
      result.current.kimiProviders.map((entry) => [
        entry.id,
        Boolean(entry.isActive),
      ]),
    ).toEqual([
      ["a", true],
      ["b", false],
    ]);
  });

  it("surfaces delete errors while closing the confirm dialog", async () => {
    const providers = [kimiProvider("a")];
    vi.mocked(getKimiProviders).mockResolvedValue(providers);
    vi.mocked(deleteKimiProvider).mockRejectedValue(new Error("delete failed"));

    const { result } = renderHook(() => useKimiProviderManagement());
    await waitFor(() => {
      expect(result.current.kimiProviders).toEqual(providers);
    });

    act(() => {
      result.current.handleDeleteKimiProvider(providers[0]);
    });
    expect(result.current.deleteKimiConfirm).toEqual({
      isOpen: true,
      provider: providers[0],
    });

    await act(async () => {
      await result.current.confirmDeleteKimiProvider();
    });

    expect(deleteKimiProvider).toHaveBeenCalledWith("a");
    expect(result.current.kimiProviderError).toBe("delete failed");
    expect(result.current.deleteKimiConfirm).toEqual({
      isOpen: false,
      provider: null,
    });
  });

  it("surfaces partial cleanup warning after durable provider deletion", async () => {
    const providers = [kimiProvider("a")];
    vi.mocked(getKimiProviders).mockResolvedValue(providers);
    vi.mocked(deleteKimiProvider).mockResolvedValueOnce({
      status: "partial-warning",
      warning: "residual config remains",
    });

    const { result } = renderHook(() => useKimiProviderManagement());
    await waitFor(() => expect(result.current.kimiProviders).toEqual(providers));
    act(() => result.current.handleDeleteKimiProvider(providers[0]));
    await act(async () => {
      await result.current.confirmDeleteKimiProvider();
    });

    expect(result.current.kimiProviderError).toBe("residual config remains");
  });
});
