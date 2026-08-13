/**
 * useProjectMemoryEmbedModel 状态机测试。
 * 覆盖：disabled / missing / ready；下载进度；失败；remove。
 */
// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const healthMock = vi.fn<() => Promise<unknown>>();
const downloadMock = vi.fn<
  (
    onProgress?: (progress: {
      phase: "tokenizer" | "model";
      downloadedBytes: number;
      totalBytes: number;
    }) => void,
  ) => Promise<unknown>
>();

vi.mock("../../../services/tauri/projectMemoryEmbed", () => ({
  projectMemoryEmbedHealth: () => healthMock(),
}));
const removeMock = vi.fn<() => Promise<unknown>>();

vi.mock("../utils/projectMemoryEmbeddingProvider", () => ({
  downloadBundledEmbeddingModel: (
    onProgress?: Parameters<typeof downloadMock>[0],
  ) => downloadMock(onProgress),
  removeBundledEmbeddingModel: () => removeMock(),
  invalidateEmbeddingHealthCache: () => {},
  prewarmBundledEmbeddingRuntime: () => Promise.resolve(),
}));

import { useProjectMemoryEmbedModel } from "./useProjectMemoryEmbedModel";

describe("useProjectMemoryEmbedModel", () => {
  beforeEach(() => {
    healthMock.mockReset();
    downloadMock.mockReset();
    removeMock.mockReset();
  });

  it("ONNX runtime 已移除 → status=disabled", async () => {
    healthMock.mockResolvedValue({
      status: "unavailable",
      reason: "onnx_runtime_removed",
      downloadable: false,
      modelDir: "/home/u/.ccgui/models/embedding",
    });
    const { result } = renderHook(() => useProjectMemoryEmbedModel());
    await waitFor(() => expect(result.current.status).not.toBeNull());
    expect(result.current.status).toEqual({
      state: "disabled",
      reason: "onnx_runtime_removed",
      modelDir: "/home/u/.ccgui/models/embedding",
    });
    expect(result.current.modelDir).toBe("/home/u/.ccgui/models/embedding");
  });

  it("模型缺失且可下载 → status=missing", async () => {
    healthMock.mockResolvedValue({
      status: "unavailable",
      reason: "model_resource_missing",
      downloadable: true,
      modelDir: "/home/u/.ccgui/models/embedding",
    });
    const { result } = renderHook(() => useProjectMemoryEmbedModel());
    await waitFor(() => expect(result.current.status).not.toBeNull());
    expect(result.current.status).toEqual({
      state: "missing",
      downloadable: true,
      modelDir: "/home/u/.ccgui/models/embedding",
    });
    expect(result.current.modelDir).toBe("/home/u/.ccgui/models/embedding");
  });

  it("模型已就绪 → status=ready", async () => {
    healthMock.mockResolvedValue({
      status: "available",
      downloadable: false,
      modelDir: "/home/u/.ccgui/models/embedding",
      modelPath: "/home/u/.ccgui/models/embedding/memory-embed-v1.onnx",
    });
    const { result } = renderHook(() => useProjectMemoryEmbedModel());
    await waitFor(() => expect(result.current.status).not.toBeNull());
    expect(result.current.status).toEqual({
      state: "ready",
      modelDir: "/home/u/.ccgui/models/embedding",
      modelPath: "/home/u/.ccgui/models/embedding/memory-embed-v1.onnx",
    });
  });

  it("download 期间推送进度 → 完成后 ready", async () => {
    healthMock.mockResolvedValue({
      status: "unavailable",
      reason: "model_resource_missing",
      downloadable: true,
      modelDir: "/home/u/.ccgui/models/embedding",
    });
    downloadMock.mockImplementation(async (onProgress) => {
      onProgress?.({
        phase: "model",
        downloadedBytes: 50,
        totalBytes: 100,
      });
      return {
        status: "available",
        downloadable: false,
        modelDir: "/home/u/.ccgui/models/embedding",
        modelPath: "/home/u/.ccgui/models/embedding/memory-embed-v1.onnx",
      };
    });

    const { result } = renderHook(() => useProjectMemoryEmbedModel());
    await waitFor(() => expect(result.current.status).not.toBeNull());

    await act(async () => {
      await result.current.download();
    });

    expect(downloadMock).toHaveBeenCalledOnce();
    expect(result.current.status).toMatchObject({ state: "ready" });
  });

  it("download 失败 → status=error", async () => {
    healthMock.mockResolvedValue({
      status: "unavailable",
      downloadable: true,
      modelDir: "/home/u/.ccgui/models/embedding",
    });
    downloadMock.mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => useProjectMemoryEmbedModel());
    await waitFor(() => expect(result.current.status).not.toBeNull());

    await act(async () => {
      await result.current.download();
    });

    expect(result.current.status).toMatchObject({
      state: "error",
      error: "network down",
    });
  });

  it("remove 成功 → status=disabled（当前构建无 runtime）", async () => {
    healthMock.mockResolvedValue({
      status: "available",
      downloadable: false,
      modelDir: "/home/u/.ccgui/models/embedding",
      modelPath: "/home/u/.ccgui/models/embedding/memory-embed-v1.onnx",
    });
    removeMock.mockResolvedValue({
      status: "unavailable",
      reason: "onnx_runtime_removed",
      downloadable: false,
      modelDir: "/home/u/.ccgui/models/embedding",
    });

    const { result } = renderHook(() => useProjectMemoryEmbedModel());
    await waitFor(() => expect(result.current.status?.state).toBe("ready"));

    await act(async () => {
      await result.current.remove();
    });

    expect(removeMock).toHaveBeenCalledOnce();
    expect(result.current.status).toEqual({
      state: "disabled",
      reason: "onnx_runtime_removed",
      modelDir: "/home/u/.ccgui/models/embedding",
    });
  });
});
