## Why

Phase 5 必须保持 conversation-native：用户从 Composer 明确开启 Squad，并在当前对话看到 plan 与进度，而不是跳入新的 Task Center。现有 `SubagentChatSplit` 已验证主 Conversation 不 remount、右侧 full-height inspector 可拖拽的交互形态，可抽成通用 host 后复用其体验。

## 目标与边界

- Shared Session Composer send 旁提供 one-shot `Squad` button；不提供显式命令或自动检测。
- 用户提交后在 Conversation 内看到 nested `Squad Run Card` 与 editable plan；一次确认后自动打开右侧 Squad overview inspector。
- Inspector 复用当前 SubAgent drawer/split 形态：desktop full-height resizable split，mobile overlay；关闭后可从 run card 恢复。
- UI 只消费 `SquadProjection`，不承担 scheduler、terminal 或 recovery authority。

## What Changes

- 抽取兼容 `SubagentChatSplit` 的 generic `ConversationInspectorSplit` host，不改变现有 SubAgent behavior。
- 新增 Composer `Squad` one-shot state、plan card、confirm/cancel、run status card、node graph/list、node detail、budget/verification/diagnostics panels。
- plan confirmation 自动打开 overview；node click 打开 detail；`Emergency Stop` 在 running state 始终可达。
- 新增 i18n、keyboard/accessibility、persisted width sanitize 与 responsive behavior。

## 非目标

- 不恢复旧 Task Center/Project Map UI，不新增独立路由或 sidebar primary surface。
- 不在普通 Native conversation 暴露 Squad V1。
- 不在 root hook 保存每事件日志数组，不因 node event 驱动 Messages/composer streaming 热路径。

## 方案取舍

- 采用 **Conversation card + right inspector**。相比独立页面，保留任务与原始对话上下文；相比把全部 DAG 塞进 message card，复杂信息可展开且不压缩正文。
- 复用 generic split host，而不是复制 `SubagentChatSplit`。这样保持 Messages DOM identity、drag ratio 与 mobile overlay contract，同时避免把 Squad 伪装成 engine-native SubAgent。

## Capabilities

### New Capabilities

- `conversation-squad-inspector`: Composer entry、plan confirmation、run card、right inspector、responsive 与 accessibility contract。

### Modified Capabilities

- `shared-session-thread`: Shared conversation 支持一个 active nested Squad surface，同时 hidden Worker sessions 仍不得成为 visible native conversations。

## Impact

- Frontend: `src/features/composer/**`、`src/features/layout/**`、`src/features/subagent-ui/**`、新增 `src/features/squad-orchestration/**`。
- Styling/i18n: feature-local stylesheet 与 localization keys。
- No new frontend dependency；不修改 message streaming cadence。

## 验收标准

- `Squad` 仅对 Shared Session 可见，切换为 one-shot 后下一次 send 创建 plan request，随后自动复位。
- plan 未确认前没有 Worker side effect；确认一次后 inspector 自动打开且不再出现中途确认。
- 打开/关闭/拖拽 inspector 不 remount Messages；typing 与 IME 在 streaming/node events 下保持 urgent。
- Desktop、mobile、keyboard、screen-reader labels 与 reduced-motion paths 通过 focused tests/visual verification。
