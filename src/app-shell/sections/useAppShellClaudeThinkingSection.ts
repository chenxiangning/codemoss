import { useCallback } from "react";

export function useAppShellClaudeThinkingSection() {
  // ponytail: 思考过程写死为常开、不可关闭。
  // claudeThinkingVisible 是「发送端是否注入 CLAUDE_CODE_DISABLE_THINKING」与
  // 「显示端是否隐藏思考块」的共同中枢开关。恒定 true 可确保 Claude 的思考既不被
  // 前端强制禁用、也不被隐藏；并忽略下游上报的可见性，避免设置读取时机/供应商配置
  // 把它翻成 false 而重现「开了设置却没有思考过程」的问题。
  const claudeThinkingVisible = true;
  const handleResolvedClaudeThinkingVisibleChange = useCallback(
    (_enabled: boolean) => {
      // 思考写死常开，忽略上报的可见性变化。
    },
    [],
  );

  return {
    claudeThinkingVisible,
    handleResolvedClaudeThinkingVisibleChange,
  };
}
