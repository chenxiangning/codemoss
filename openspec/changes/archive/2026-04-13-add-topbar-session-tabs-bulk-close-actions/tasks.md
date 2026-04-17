## 1. 窗口模型扩展

- [x] 1.1 [P0][depends: none] 在 `topbarSessionTabs.ts` 新增批量关闭纯函数（关闭全部、关闭左侧、关闭右侧、关闭全部已完成），输入为 `TopbarSessionWindows + targetTab + threadStatus`，输出为新的窗口模型。
- [x] 1.2 [P0][depends: 1.1] 将 `TOPBAR_SESSION_TAB_MAX`、当前 change 文档与主规范统一到 `5`，并同步修正相关测试。
- [x] 1.3 [P0][depends: 1.1] 为 active tab 被批量关闭场景实现“右侧最近邻 -> 左侧最近邻 -> 清空高亮”的 fallback 选择策略。

## 2. Topbar 菜单接入

- [x] 2.1 [P0][depends: 1.1] 在 `TopbarSessionTabs.tsx` 增加 tab 级 `onContextMenu` 入口，并把目标 `workspaceId/threadId` 透传给上层。
- [x] 2.2 [P0][depends: 2.1] 在 `useLayoutNodes.tsx` 构建 Tauri 右键菜单，增加 `关闭标签 / 关闭左侧标签 / 关闭右侧标签 / 关闭全部标签 / 关闭全部已完成标签` 五个动作。
- [x] 2.3 [P1][depends: 2.2] 为不可执行动作提供禁用态，避免 silent no-op。

## 3. 文案与契约对齐

- [x] 3.1 [P0][depends: 2.2] 在 `en.part1.ts` 与 `zh.part1.ts` 补齐 topbar 批量关闭菜单文案。
- [x] 3.2 [P0][depends: 1.2] 在代码、tests 与规范中统一 `max=5`，消除漂移。

## 4. 回归测试

- [x] 4.1 [P0][depends: 1.1,1.2,1.3] 在 `topbarSessionTabs.test.ts` 补齐批量关闭纯函数测试：关闭全部、关闭左侧、关闭右侧、关闭全部已完成、active fallback。
- [x] 4.2 [P0][depends: 2.1,2.2] 在 `TopbarSessionTabs.test.tsx` 补齐右键事件与单 tab 关闭行为回归。
- [x] 4.3 [P0][depends: 4.1,4.2] 运行定向 vitest，确认窗口管理能力不回退且不触碰会话删除链路。
- [x] 4.4 [P0][depends: 4.1,4.2] 增加边界回归：`isProcessing` 未知状态不得被“关闭全部已完成标签”误删，并覆盖 `ContextMenu/Shift+F10` 键盘触发菜单链路。

## 5. OpenSpec 校验

- [x] 5.1 [P0][depends: 1.x,2.x,3.x,4.x] 执行 `openspec validate add-topbar-session-tabs-bulk-close-actions --strict`，确保 proposal/design/tasks/spec delta 一致。
- [x] 5.2 [P0][depends: 5.1] 生成 `verification.md`，记录代码修复点与验证命令结果，确保“实现-测试-规范”三方一致。
