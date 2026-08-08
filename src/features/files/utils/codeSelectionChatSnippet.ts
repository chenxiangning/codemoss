export type CodeSelectionChatSnippetInput = {
  path: string;
  content: string;
  startLine: number;
  endLine: number;
  language?: string | null;
};

function needsQuotedPath(path: string): boolean {
  return /[\s"'`]/.test(path);
}

/**
 * Build a composer-ready file-tag reference for a code selection.
 * ChatInputBox renders `@path#L…` as an elegant inline file chip.
 *
 * Examples:
 *   @src/app.ts#L10-L11
 *   @"docs/my file.ts#L3"
 */
export function buildCodeSelectionChatSnippet(
  input: CodeSelectionChatSnippetInput,
): string | null {
  const path = input.path.trim();
  const content = input.content;
  if (
    !path ||
    !content.trim() ||
    !Number.isInteger(input.startLine) ||
    !Number.isInteger(input.endLine) ||
    input.startLine <= 0 ||
    input.endLine < input.startLine
  ) {
    return null;
  }

  const lineFragment =
    input.startLine === input.endLine
      ? `#L${input.startLine}`
      : `#L${input.startLine}-L${input.endLine}`;
  const referencePath = `${path}${lineFragment}`;
  if (needsQuotedPath(path)) {
    return `@"${referencePath}"`;
  }
  return `@${referencePath}`;
}

/**
 * Build a whole-file composer reference (no line range).
 */
export function buildFileChatReference(path: string): string | null {
  const normalized = path.trim();
  if (!normalized) {
    return null;
  }
  if (needsQuotedPath(normalized)) {
    return `@"${normalized}"`;
  }
  return `@${normalized}`;
}
