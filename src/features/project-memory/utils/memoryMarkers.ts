import type { ProjectMemoryItem } from "../../../services/tauri";

export const MEMORY_CONTEXT_SUMMARY_PREFIX = "【记忆上下文摘要】";
/**
 * 记忆参考空/超时/失败状态（主幕时间线轻量 status，非旧摘要卡）。
 * 正文格式：
 *   【记忆参考状态】
 *   <emptyReason>
 *   <title>
 *   <message>
 */
export const MEMORY_PICK_STATUS_PREFIX = "【记忆参考状态】";

const POLLUTION_MARKERS = [
  "<project-memory",
  "[对话记录]",
  MEMORY_CONTEXT_SUMMARY_PREFIX,
  MEMORY_PICK_STATUS_PREFIX,
];

function containsMarker(text: string): boolean {
  const normalized = text.toLowerCase();
  return POLLUTION_MARKERS.some((marker) => normalized.includes(marker.toLowerCase()));
}

export function isLikelyPollutedMemory(item: ProjectMemoryItem): boolean {
  if (containsMarker(item.title)) {
    return true;
  }
  if (containsMarker(item.summary)) {
    return true;
  }
  if (item.detail && containsMarker(item.detail)) {
    return true;
  }
  if (item.rawText && containsMarker(item.rawText)) {
    return true;
  }
  if (containsMarker(item.cleanText)) {
    return true;
  }
  return false;
}

