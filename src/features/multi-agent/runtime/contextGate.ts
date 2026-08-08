export type MultiAgentContextBlock =
  | "note-cards"
  | "manual-memory"
  | "memory-reference"
  | "skills"
  | null;

/**
 * 历史：V1 曾拦截便签/记忆/skill，避免污染 plan/execute 边界。
 * 现契约（§8.6 Context Fan-in）：上下文全部放行，由首段消化、后续只吃文字。
 * 保留函数签名供调用方兼容；恒返回 null（不拦截）。
 */
export function multiAgentContextBlockReason(_input: {
  noteCardIds: string[];
  memoryIds: string[];
  memoryReferenceEnabled: boolean;
  skillNames: string[];
}): MultiAgentContextBlock {
  return null;
}
