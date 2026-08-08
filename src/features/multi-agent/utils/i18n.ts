import { getI18n } from "react-i18next";

/**
 * multi-agent 非 React 路径的 t()。
 * - 优先走 react-i18next 当前语言
 * - 测试 mock / 未初始化时回退 defaultValue（支持 {{var}} 插值）
 */
export function maT(
  key: string,
  options?: Record<string, unknown>,
): string {
  try {
    const i18n = getI18n();
    if (i18n && typeof i18n.t === "function") {
      return String(i18n.t(key, options as never));
    }
  } catch {
    // ignore — 走 defaultValue
  }
  const fallback = options?.defaultValue;
  if (fallback == null) return key;
  let text = String(fallback);
  for (const [paramKey, value] of Object.entries(options ?? {})) {
    if (paramKey === "defaultValue") continue;
    text = text.replace(
      new RegExp(`\\{\\{${paramKey}\\}\\}`, "g"),
      String(value),
    );
  }
  return text;
}
