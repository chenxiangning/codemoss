# Proposal: OpenCode 首轮会话绑定修复（pending 线程强约束）

## 目标与边界

目标：解决 OpenCode 首次新会话中“旧线程一直转圈、回复落到新 session”的残留问题，保证首条消息线程归属稳定。

边界：

- 仅改 OpenCode / Claude 的本地 CLI 会话线程绑定策略。
- 不改 UI 风格，不改 provider 协议。
- Codex 路径语义保持不变。

## 现状问题

在空白线程场景，前端可能只把 `engineSource` 标记为 `opencode`，但保留了非 `opencode-*` 的旧 threadId。
随后发送时，后端事件会切换到 `opencode:{sessionId}`，而前端 `thread/session` 回填在该场景缺乏稳定来源，导致：

- 首线程停留 processing
- 回复显示在新 session 线程

## 方案

1. 发送前强约束：对 `opencode/claude`，若当前 threadId 不属于该引擎前缀，必须新建 `*-pending-*` 再发送。
2. 事件补充引擎语义：后端 `thread/started` 事件附带 `engine` 字段。
3. 前端回填兜底：`onThreadSessionIdUpdated` 支持 `engine` hint，在 threadId 无前缀场景也能正确 rename。
4. 回归测试覆盖首轮空线程与无前缀 threadId 两个关键场景。
5. OpenCode 体验提示：当正在处理且长时间未收到首段输出时，UI 显示“模型可能非流式返回”提示，减少误判卡死。
6. 状态一致性收口：修复 `unknown/-` Provider/Model 展示错配，避免“绿色已连接但模型空值/unknown”的矛盾状态；并为非流式提示增加
   i18n key 泄漏兜底。

## 验收标准

1. 首次新会话切到 OpenCode 并发送第一条消息时，不再出现“旧线程卡住 + 新线程回复”。
2. `thread/started` 事件可提供 engine 语义，前端回填不依赖 threadId 前缀猜测。
3. Claude/Codex 既有发送与中断行为不变。
4. 对应 TS/Rust 测试通过。
5. OpenCode 慢首包场景中，用户可见非流式提示文案，避免“连接正常但无输出”的误解。
6. 管理面板在 provider/model 不可判定时不得展示 `unknown` 或 `-` 作为有效值；连接文案与匹配关系不再自相矛盾。

## 影响范围

- Frontend: `useThreadMessaging.ts`, `useThreadTurnEvents.ts`, `useAppServerEvents.ts`
- Backend: `src-tauri/src/engine/events.rs`
- Tests: `useThreadMessaging.test.tsx`, `useThreadTurnEvents.test.tsx`
