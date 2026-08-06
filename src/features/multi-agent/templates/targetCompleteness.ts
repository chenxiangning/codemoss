import type { AgentExecutionTarget } from "../types";

/**
 * UI 层「是否看起来配齐」：与发送前 merge 策略配合。
 * 未配齐时发送会回退会话 target，需在模板管理中提示用户。
 */
export function isCompleteAgentTargetForUi(
  target: AgentExecutionTarget | null | undefined,
): boolean {
  if (!target?.engine) return false;
  const model = target.model?.trim() || "";
  const catalog = target.modelCatalogEntryId?.trim() || "";
  const name = target.providerProfileNameSnapshot?.trim() || "";
  const source = target.providerProfileSource?.trim() || "";
  if (!model || !catalog || !name) return false;
  // source 可能在保存前为空；有 model+catalog+name 即视为用户已点选
  if (source === "managed" && !target.providerProfileId?.trim()) return false;
  return true;
}
