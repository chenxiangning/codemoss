# Verification - add-topbar-session-tabs-bulk-close-actions

## Scope

本次校验覆盖三类同步内容：

1. topbar 批量关闭窗口管理能力（不涉及会话删除）。
2. “关闭全部已完成标签”的边界语义（未知状态不应被误删）。
3. Win/mac 桌面交互一致性中的键盘上下文菜单触发（`ContextMenu` / `Shift+F10`）。

## Code Alignment

- 纯函数边界语义：
  - `src/features/layout/hooks/topbarSessionTabs.ts`
  - `dismissCompletedTopbarSessionTabs` 改为仅在 `isProcessing === false` 时关闭。
- UI 菜单触发与兼容：
  - `src/features/app/components/TopbarSessionTabs.tsx`
  - 支持鼠标右键与键盘触发上下文菜单（`ContextMenu` / `Shift+F10`）。
- 菜单状态与执行：
  - `src/features/layout/hooks/useLayoutNodes.tsx`
  - 已完成判定使用显式 `=== false`，并保持禁用态语义。
- 文案：
  - `src/i18n/locales/en.part1.ts`
  - `src/i18n/locales/zh.part1.ts`

## Test & Gate Results

在源码仓库 `mossx` 执行，结果如下：

- `npm exec vitest run src/features/layout/hooks/topbarSessionTabs.test.ts src/features/app/components/TopbarSessionTabs.test.tsx src/features/app/components/MainHeader.topbar-session-tabs.test.tsx`
  - 结果：通过（`27/27`）。
- `npm run typecheck`
  - 结果：通过。
- `npm run check:large-files:gate`
  - 结果：通过（`threshold>3000, found=0`）。

## OpenSpec Validation

在规范仓库执行：

- `openspec validate add-topbar-session-tabs-bulk-close-actions --strict`
  - 结果：通过（`Change 'add-topbar-session-tabs-bulk-close-actions' is valid`）。

## Conclusion

本 change 的实现、回归测试与规范已完成同步，且边界语义与跨平台交互约束已落入主 spec 与 delta spec。
