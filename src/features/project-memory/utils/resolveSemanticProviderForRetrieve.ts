/**
 * 解析检索用 semantic provider：health available 才返回生产 provider。
 * 不检查 index 是否非空——空 index 由 retrieve 路径诚实降级 lexical。
 */
import {
  createBundledProjectMemoryEmbeddingProvider,
  prewarmBundledEmbeddingRuntime,
  __resetBundledEmbeddingProviderCacheForTests,
} from "./projectMemoryEmbeddingProvider";
import { isSemanticRetrievalEnabledByUser } from "./semanticRetrievalPreference";
import type { ProjectMemoryEmbeddingProvider } from "./projectMemorySemanticRetrieval";

export type ResolveSemanticProviderOptions = {
  /** 注入覆盖（单测 / Scout 注入 mock） */
  override?: ProjectMemoryEmbeddingProvider | null;
  /** 显式禁用生产 provider（永远 lexical） */
  disabled?: boolean;
  /**
   * 忽略用户设置偏好（仅测试）。
   * 默认会读 localStorage：用户关闭「使用语义模型」时强制 null。
   */
  ignoreUserPreference?: boolean;
};

/**
 * 返回可用的 production provider，或 null（调用方走 lexical）。
 * 失败不抛；null 即「无语义」。
 * 用户可在设置中关闭语义检索（即使模型已下载）。
 * 首次 available 时 fire-and-forget 预热 runtime（不 await，避免拖慢本次检索）。
 */
export async function resolveSemanticProviderForRetrieve(
  options: ResolveSemanticProviderOptions = {},
): Promise<ProjectMemoryEmbeddingProvider | null> {
  if (options.disabled) return null;
  if (
    !options.ignoreUserPreference &&
    options.override === undefined &&
    !isSemanticRetrievalEnabledByUser()
  ) {
    return null;
  }
  if (options.override !== undefined) {
    if (!options.override) return null;
    try {
      const health = await options.override.health();
      return health.status === "available" ? options.override : null;
    } catch {
      return null;
    }
  }

  try {
    const provider = createBundledProjectMemoryEmbeddingProvider();
    const health = await provider.health();
    if (health.status !== "available") {
      return null;
    }
    // 后台预热，不阻塞本轮检索
    void prewarmBundledEmbeddingRuntime();
    return provider;
  } catch {
    return null;
  }
}

export { __resetBundledEmbeddingProviderCacheForTests };
