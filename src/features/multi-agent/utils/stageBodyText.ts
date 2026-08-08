/**
 * 多候选阶段正文择优：取最长非空文本。
 * 避免 live 半截碎片通过 `a || b` 盖住 fullOutcome 全文。
 * 边界：仅比 trim 后长度；不改写内容；不依赖引擎/会话类型。
 */
export function pickLongestStageBody(
  ...parts: Array<string | null | undefined>
): string {
  let best = "";
  for (const part of parts) {
    if (typeof part !== "string") continue;
    const trimmed = part.trim();
    if (trimmed.length > best.length) {
      best = trimmed;
    }
  }
  return best;
}
