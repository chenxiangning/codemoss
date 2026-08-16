import {
  getClientStoreSync,
  writeClientStoreValue,
} from "./clientStorage";
import { migrateLegacyRendererDiagnostics } from "./rendererDiagnostics";
import {
  MAX_THREAD_SESSION_LOG_ENTRIES,
  isBlockedThreadSessionLogLabel,
  normalizeThreadSessionLogPayload,
} from "@mossx/plugin-debug/runtime";
import {
  pruneCustomNames,
  type CustomNamesMap,
} from "../features/threads/utils/threadStorage";

const THREAD_SESSION_LOG_KEY = "diagnostics.threadSessionLog";

type ThreadSessionLogEntry = {
  timestamp: number;
  source: string;
  label: string;
  payload: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isThreadSessionLogEntry(value: unknown): value is ThreadSessionLogEntry {
  return (
    isRecord(value) &&
    typeof value.timestamp === "number" &&
    typeof value.source === "string" &&
    typeof value.label === "string"
  );
}

/**
 * 清理 diagnostics store 中 threadSessionLog 的存量：
 * 黑名单 label 过滤（上一轮只挡新增、未清存量，遗留约 5.7MB）+ 单条 payload 截断 + 条数上限。
 */
function cleanThreadSessionLogBacklog(): void {
  const stored = getClientStoreSync<unknown>("diagnostics", THREAD_SESSION_LOG_KEY);
  if (!Array.isArray(stored) || stored.length === 0) {
    return;
  }
  const cleaned = stored
    .filter(isThreadSessionLogEntry)
    .filter((entry) => !isBlockedThreadSessionLogLabel(entry.label))
    .map((entry) => ({
      ...entry,
      payload: normalizeThreadSessionLogPayload(entry.payload),
    }))
    .slice(-MAX_THREAD_SESSION_LOG_ENTRIES);
  writeClientStoreValue("diagnostics", THREAD_SESSION_LOG_KEY, cleaned);
}

/**
 * legacy `app` store 里的诊断死数据（threadSessionLog 已迁到 diagnostics store，
 * app store 中的存量只会被反复读出参与 fallback / merge）置空。
 */
function clearLegacyAppDiagnostics(): void {
  const legacyThreadSessionLog = getClientStoreSync<unknown>("app", THREAD_SESSION_LOG_KEY);
  if (Array.isArray(legacyThreadSessionLog) && legacyThreadSessionLog.length > 0) {
    writeClientStoreValue("app", THREAD_SESSION_LOG_KEY, []);
  }
  migrateLegacyRendererDiagnostics();
}

/** threads store 的 customNames 只增不减（实测约 21,000 条），裁剪到容量上限。 */
function pruneCustomNamesBacklog(): void {
  const stored = getClientStoreSync<CustomNamesMap>("threads", "customNames");
  if (!isRecord(stored)) {
    return;
  }
  const pruned = pruneCustomNames(stored);
  if (pruned !== stored) {
    writeClientStoreValue("threads", "customNames", pruned);
  }
}

/**
 * 启动期 client store 存量止血。必须在 preloadClientStores 完成后调用
 * （依赖同步 cache 读取）。幂等：清理后的存量再跑一遍是 no-op。
 */
export function runClientStoreMaintenance(): void {
  try {
    cleanThreadSessionLogBacklog();
  } catch {
    // 维护任务 best-effort，任何一步失败都不能阻断启动。
  }
  try {
    clearLegacyAppDiagnostics();
  } catch {
    // 同上。
  }
  try {
    pruneCustomNamesBacklog();
  } catch {
    // 同上。
  }
}
