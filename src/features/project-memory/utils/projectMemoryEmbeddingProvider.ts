/**
 * 生产侧 ProjectMemoryEmbeddingProvider。
 * 当前构建未链接 ONNX Runtime（Intel macOS 打包兼容），health 恒为 unavailable → lexical。
 * 命令面仍保留，便于后续恢复推理而不改前端 contract。
 */
import {
  projectMemoryEmbedDownload,
  projectMemoryEmbedHealth,
  projectMemoryEmbedRemove,
  projectMemoryEmbedText,
  type ProjectMemoryEmbedHealthDto,
} from "../../../services/tauri/projectMemoryEmbed";
import type {
  ProjectMemoryEmbeddingProvider,
  ProjectMemoryEmbeddingProviderHealth,
} from "./projectMemorySemanticRetrieval";

export const BUNDLED_EMBEDDING_PROVIDER_ID = "mossx-bundled-onnx";
export const BUNDLED_EMBEDDING_MODEL_ID = "memory-embed-v1";
export const BUNDLED_EMBEDDING_VERSION = "memory-embed-v1";
export const BUNDLED_EMBEDDING_DIMENSIONS = 384;

let cachedProvider: ProjectMemoryEmbeddingProvider | null = null;
let cachedHealth: ProjectMemoryEmbeddingProviderHealth | null = null;
let healthCheckedAt = 0;
const HEALTH_TTL_MS = 30_000;

export type EmbedDownloadState = {
  phase: "tokenizer" | "model";
  downloadedBytes: number;
  totalBytes: number;
};

async function probeHealth(): Promise<
  ProjectMemoryEmbeddingProviderHealth & {
    modelPath?: string | null;
    modelDir?: string | null;
  }
> {
  const now = Date.now();
  if (cachedHealth && now - healthCheckedAt < HEALTH_TTL_MS) {
    return cachedHealth;
  }
  try {
    const dto = await projectMemoryEmbedHealth();
    cachedHealth = healthFromDto(dto);
  } catch (error) {
    cachedHealth = {
      status: "unavailable" as const,
      reason: error instanceof Error ? error.message : String(error),
      downloadable: false,
    };
  }
  healthCheckedAt = now;
  return cachedHealth;
}

function healthFromDto(
  dto: ProjectMemoryEmbedHealthDto,
): ProjectMemoryEmbeddingProviderHealth & {
  modelPath?: string | null;
  modelDir?: string | null;
} {
  const status =
    dto.status === "available"
      ? ("available" as const)
      : dto.status === "error"
        ? ("error" as const)
        : ("unavailable" as const);
  return {
    status,
    reason: dto.reason ?? undefined,
    downloadable: dto.downloadable,
    modelPath: dto.modelPath,
    modelDir: dto.modelDir,
  };
}

/** 触发模型下载到 ~/.ccgui/models/embedding/；完成后刷新 health */
export async function downloadBundledEmbeddingModel(
  onProgress?: (state: EmbedDownloadState) => void,
): Promise<
  ProjectMemoryEmbeddingProviderHealth & {
    modelPath?: string | null;
    modelDir?: string | null;
  }
> {
  // 监听 download progress events
  const unlisten = await import("@tauri-apps/api/event").then(({ listen }) =>
    listen<EmbedDownloadState>("embed-download-progress", (event) => {
      onProgress?.(event.payload);
    }),
  );

  try {
    const dto = await projectMemoryEmbedDownload();
    const health = healthFromDto(dto);
    cachedHealth = {
      status: health.status,
      reason: health.reason,
      downloadable: health.downloadable,
    };
    healthCheckedAt = Date.now();
    return health;
  } finally {
    unlisten();
  }
}

/** 删除本地语义模型文件并卸载 runtime */
export async function removeBundledEmbeddingModel(): Promise<
  ProjectMemoryEmbeddingProviderHealth & {
    modelPath?: string | null;
    modelDir?: string | null;
  }
> {
  invalidateEmbeddingHealthCache();
  const dto = await projectMemoryEmbedRemove();
  const health = healthFromDto(dto);
  cachedHealth = {
    status: health.status,
    reason: health.reason,
    downloadable: health.downloadable,
  };
  healthCheckedAt = Date.now();
  return health;
}

/** 重置 health 缓存（下载后、测试用） */
export function invalidateEmbeddingHealthCache() {
  cachedHealth = null;
  healthCheckedAt = 0;
}

/**
 * 单例生产 provider。scope=production；不可用时 health 诚实返回 unavailable。
 */
export function createBundledProjectMemoryEmbeddingProvider(): ProjectMemoryEmbeddingProvider {
  if (cachedProvider) return cachedProvider;

  cachedProvider = {
    providerId: BUNDLED_EMBEDDING_PROVIDER_ID,
    modelId: BUNDLED_EMBEDDING_MODEL_ID,
    dimensions: BUNDLED_EMBEDDING_DIMENSIONS,
    embeddingVersion: BUNDLED_EMBEDDING_VERSION,
    scope: "production",
    health: () => probeHealth(),
    embed: async (text: string) => {
      const result = await projectMemoryEmbedText(text);
      return result.vector;
    },
  };
  return cachedProvider;
}

let prewarmPromise: Promise<void> | null = null;

/**
 * 后台预热 ONNX runtime（设置就绪后 / 首次检索前调用）。
 * 失败静默；不阻塞发送。
 */
export function prewarmBundledEmbeddingRuntime(): Promise<void> {
  if (prewarmPromise) return prewarmPromise;
  prewarmPromise = (async () => {
    try {
      const provider = createBundledProjectMemoryEmbeddingProvider();
      const health = await provider.health();
      if (health.status !== "available") return;
      // 短文本触发一次推理，把模型装进内存
      await provider.embed("ok");
    } catch {
      // ignore
    }
  })();
  return prewarmPromise;
}

/** 测试 / 热更新后清缓存 */
export function __resetBundledEmbeddingProviderCacheForTests() {
  cachedProvider = null;
  cachedHealth = null;
  healthCheckedAt = 0;
  prewarmPromise = null;
}
