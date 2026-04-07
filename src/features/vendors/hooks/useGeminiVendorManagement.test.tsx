// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getGeminiVendorPreflight,
  getGeminiVendorSettings,
  saveGeminiVendorSettings,
} from "../../../services/tauri";
import { useGeminiVendorManagement } from "./useGeminiVendorManagement";

vi.mock("../../../services/tauri", () => ({
  getGeminiVendorPreflight: vi.fn(),
  getGeminiVendorSettings: vi.fn(),
  saveGeminiVendorSettings: vi.fn(),
}));

describe("useGeminiVendorManagement", () => {
  beforeEach(() => {
    vi.mocked(getGeminiVendorPreflight).mockResolvedValue({ checks: [] });
    vi.mocked(saveGeminiVendorSettings).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads enabled flag from backend settings", async () => {
    vi.mocked(getGeminiVendorSettings).mockResolvedValue({
      enabled: false,
      authMode: "login_google",
      env: {},
    });

    const { result } = renderHook(() => useGeminiVendorManagement());

    await waitFor(() => {
      expect(result.current.draft.enabled).toBe(false);
    });
  });

  it("persists enabled flag from draft instead of forcing true", async () => {
    vi.mocked(getGeminiVendorSettings).mockResolvedValue({
      enabled: false,
      authMode: "login_google",
      env: {},
    });

    const { result } = renderHook(() => useGeminiVendorManagement());

    await waitFor(() => {
      expect(result.current.draft.enabled).toBe(false);
    });

    await act(async () => {
      await result.current.handleSaveConfig();
    });

    expect(saveGeminiVendorSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: false,
        authMode: "login_google",
      }),
    );
  });
});
