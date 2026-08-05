export type MultiAgentContextBlock =
  | "note-cards"
  | "manual-memory"
  | "memory-reference"
  | "skills"
  | null;

/** V1 只接收正文，引用上下文会污染 plan/execute 边界。 */
export function multiAgentContextBlockReason(input: {
  noteCardIds: string[];
  memoryIds: string[];
  memoryReferenceEnabled: boolean;
  skillNames: string[];
}): MultiAgentContextBlock {
  if (input.noteCardIds.length > 0) return "note-cards";
  if (input.memoryIds.length > 0) return "manual-memory";
  if (input.memoryReferenceEnabled) return "memory-reference";
  if (input.skillNames.length > 0) return "skills";
  return null;
}
