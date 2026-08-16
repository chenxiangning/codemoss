import { useCallback } from "react";
import { requestVendorModelManager } from "@mossx/plugin-vendors/runtime";

/**
 * 打开自定义模型管理弹窗(当前页 overlay),不再跳转设置页。
 * 实际 UI 由 VendorModelManagerDialogHost 消费 request 事件渲染。
 */
export function useAppShellModelSettingsAction() {
  return useCallback((providerId?: string) => {
    const target =
      providerId === "codex"
        ? "codex"
        : providerId === "gemini"
          ? "gemini"
          : "claude";
    requestVendorModelManager({ target, addMode: true });
  }, []);
}
