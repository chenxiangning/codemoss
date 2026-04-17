## Context

现有 `/status` 在 `useThreadMessaging.startStatus()` 内已实现 limits 文本化展示；实时数据由 `rateLimitsByWorkspace` 提供。旧 `ComposerInput` 已有 usage popover 逻辑，但新 ChatInputBox 未接入 `accountRateLimits` 与刷新回调。

## Design Summary

采用“复用数据源 + 新入口渲染”的小改方案：

1. 数据层
- 继续使用 `accountRateLimits`（由 App 维护并注入 Composer）。
- 继续使用 `onRefreshAccountRateLimits` 触发刷新。
- 不新增 IPC，不新增状态源。

2. 组件透传
- `Composer` 不再丢弃 `accountRateLimits/usageShowRemaining/onRefreshAccountRateLimits`。
- 透传到 `ChatInputBoxAdapter -> ChatInputBoxFooter -> ButtonArea -> ConfigSelect`。

3. UI 行为
- 在 `ConfigSelect` 中增加 `usage` 子菜单。
- 仅 `providerId === 'codex'` 时显示入口。
- 子菜单展示：
  - 5h limit 百分比 + 进度条 + reset 文案
  - Weekly limit（可选）
  - 刷新中状态

4. 兼容与隔离
- 非 Codex 分支不渲染入口，不执行刷新逻辑。
- 不触碰 `/status` 解析逻辑，仅共享同一数据源。

5. `default/plan` 切换（ComposerInput）
- 在输入区附件区域新增“计划模式”开关，仅 `selectedEngine === 'codex'` 渲染。
- 开关 `off` 表示 `default`（映射到 collaboration `code`），`on` 表示 `plan`。
- 底部操作区新增当前模式徽标（`默认`/`计划`），与开关状态保持同步，可点击快速切换。
- 继续复用既有 `selectedCollaborationModeId` 与 `onSelectCollaborationMode`，不新增状态源和 IPC。

## Risks & Mitigation

- 风险：透传链改动导致 TS props 断裂。
  - 缓解：全链路类型补齐并跑 typecheck。
- 风险：配置下拉交互冲突（provider/agent/usage 子菜单切换）。
  - 缓解：统一 `activeSubmenu` 状态机，补 outside-click 收敛。

## Rollback

- 回滚仅需移除 `ConfigSelect` 的 usage 入口与透传 props，恢复为原有菜单结构；不影响后端与 `/status`。
