/** Pure helpers for layout nodes (T3.3). */
export const EMPTY_STRING_ARRAY: string[] = [];
Object.freeze(EMPTY_STRING_ARRAY);

export function formatWorkspaceAliasError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
