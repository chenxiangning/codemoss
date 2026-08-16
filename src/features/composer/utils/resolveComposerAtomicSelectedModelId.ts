import type { ExecutionTarget } from "@mossx/plugin-shared-session/runtime";

/**
 * Composer → Atomic ModelSelect 的 selectedModelId 投影。
 *
 * - Shared：只信 selectedNextTarget（executionTarget）；缺失时 MUST 返回空串，
 *   禁止回落全局/Native selectedModelId（防串台）。
 * - Native / create-session：有 Atomic target 时用 target 身份；否则回落全局
 *   selectedModelId（Native 会话选择权威仍在 per-thread composer selection）。
 */
export function resolveComposerAtomicSelectedModelId(input: {
  isSharedSession: boolean;
  executionTarget: ExecutionTarget | null | undefined;
  globalSelectedModelId: string | null | undefined;
}): string {
  const fromTarget =
    input.executionTarget?.modelCatalogEntryId?.trim() ||
    input.executionTarget?.model?.trim() ||
    "";

  if (input.isSharedSession) {
    return fromTarget;
  }

  if (fromTarget) {
    return fromTarget;
  }

  return input.globalSelectedModelId?.trim() || "";
}
