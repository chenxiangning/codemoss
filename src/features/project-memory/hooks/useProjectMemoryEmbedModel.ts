/**
 * 本地语义模型状态控制器。
 * 当前构建已移除 ONNX Runtime（Intel macOS 打包兼容）：health 为 disabled。
 * 状态机：disabled | missing → downloading → ready / error。
 */
import { useCallback, useEffect, useState } from "react";
import { projectMemoryEmbedHealth } from "../../../services/tauri/projectMemoryEmbed";
import {
  downloadBundledEmbeddingModel,
  invalidateEmbeddingHealthCache,
  prewarmBundledEmbeddingRuntime,
  removeBundledEmbeddingModel,
} from "../utils/projectMemoryEmbeddingProvider";

export type ProjectMemoryEmbedModelStatus =
  | {
      state: "disabled";
      reason: string;
      modelDir?: string | null;
    }
  | { state: "missing"; downloadable: boolean; modelDir?: string | null }
  | {
      state: "downloading";
      phase: "tokenizer" | "model";
      downloadedBytes: number;
      totalBytes: number;
      modelDir?: string | null;
    }
  | {
      state: "ready";
      modelPath?: string | null;
      modelDir?: string | null;
    }
  | {
      state: "error";
      error: string;
      modelDir?: string | null;
      modelPath?: string | null;
    };

type EmbedHealthLike = {
  status: string;
  reason?: string | null;
  downloadable?: boolean | null;
  modelPath?: string | null;
  modelDir?: string | null;
};

const ONNX_RUNTIME_REMOVED = "onnx_runtime_removed";

function toStatus(health: EmbedHealthLike): ProjectMemoryEmbedModelStatus {
  if (health.status === "available") {
    return {
      state: "ready",
      modelPath: health.modelPath,
      modelDir: health.modelDir,
    };
  }
  if (health.status === "error") {
    return {
      state: "error",
      error: health.reason ?? "unknown_error",
      modelDir: health.modelDir,
      modelPath: health.modelPath,
    };
  }
  // 构建未链接 ONNX：不可下载，诚实展示 disabled
  if (
    health.reason === ONNX_RUNTIME_REMOVED ||
    (health.status === "unavailable" && health.downloadable !== true)
  ) {
    return {
      state: "disabled",
      reason: health.reason ?? ONNX_RUNTIME_REMOVED,
      modelDir: health.modelDir,
    };
  }
  return {
    state: "missing",
    downloadable: health.downloadable === true,
    modelDir: health.modelDir,
  };
}

export type UseProjectMemoryEmbedModelResult = {
  status: ProjectMemoryEmbedModelStatus | null;
  modelDir: string | null;
  modelPath: string | null;
  refresh: () => Promise<void>;
  download: () => Promise<void>;
  remove: () => Promise<void>;
};

export function useProjectMemoryEmbedModel(): UseProjectMemoryEmbedModelResult {
  const [status, setStatus] = useState<ProjectMemoryEmbedModelStatus | null>(
    null,
  );

  const refresh = useCallback(async () => {
    try {
      const health = await projectMemoryEmbedHealth();
      setStatus(toStatus(health));
    } catch (error) {
      setStatus({
        state: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  // 挂载时探测一次模型状态；已就绪则后台预热
  useEffect(() => {
    let active = true;
    void projectMemoryEmbedHealth()
      .then((health) => {
        if (active) {
          setStatus(toStatus(health));
          if (health.status === "available") {
            void prewarmBundledEmbeddingRuntime();
          }
        }
      })
      .catch((error) => {
        if (active) {
          setStatus({
            state: "error",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const download = useCallback(async () => {
    const prevDir =
      status && "modelDir" in status ? status.modelDir : undefined;
    setStatus({
      state: "downloading",
      phase: "tokenizer",
      downloadedBytes: 0,
      totalBytes: 0,
      modelDir: prevDir,
    });
    try {
      invalidateEmbeddingHealthCache();
      const health = await downloadBundledEmbeddingModel((progress) => {
        setStatus((current) => ({
          state: "downloading",
          ...progress,
          modelDir:
            current && "modelDir" in current ? current.modelDir : prevDir,
        }));
      });
      setStatus(toStatus(health));
      if (health.status === "available") {
        void prewarmBundledEmbeddingRuntime();
      }
    } catch (error) {
      setStatus({
        state: "error",
        error: error instanceof Error ? error.message : String(error),
        modelDir: prevDir,
      });
    }
  }, [status]);

  const remove = useCallback(async () => {
    try {
      invalidateEmbeddingHealthCache();
      const health = await removeBundledEmbeddingModel();
      setStatus(toStatus(health));
    } catch (error) {
      setStatus({
        state: "error",
        error: error instanceof Error ? error.message : String(error),
        modelDir: status && "modelDir" in status ? status.modelDir : null,
      });
    }
  }, [status]);

  const modelDir =
    status && "modelDir" in status && status.modelDir
      ? status.modelDir
      : null;
  const modelPath =
    status && "modelPath" in status && status.modelPath
      ? status.modelPath
      : null;

  return { status, modelDir, modelPath, refresh, download, remove };
}
