## 1. Claude 后端自动恢复链路（P0）

- [x] 1.1 在 `src-tauri/src/engine/claude.rs` 增加 `Prompt is too long` 识别与单次恢复开关（输入：Claude turn error/stream error；输出：是否触发恢复；验证：单测覆盖命中与不命中分支）。
- [x] 1.2 在 Claude 会话内实现一次性 `/compact` + 原请求重试编排（输入：当前 turn params + session/thread 上下文；输出：最多一次重试执行；验证：日志/事件确认仅一次恢复，不出现循环）。
- [x] 1.3 为 compact 失败与重试失败补齐终态错误收口（输入：compact 请求失败或重试失败；输出：确定性 turn error；验证：前端不残留 processing 状态）。

## 2. Claude compact 生命周期事件映射（P0）

- [x] 2.1 在 Claude `system` 事件解析中识别 `compacting` 与 `compact_boundary` 信号（输入：Claude stream system event；输出：可映射生命周期事件；验证：解析单测覆盖 snake/camel/subtype 变体）。
- [x] 2.2 将 Claude compact 信号映射到既有 `thread/compacting` / `thread/compacted` 事件（输入：内部 EngineEvent；输出：AppServerEvent 复用现有协议；验证：事件转发单测不破坏既有方法）。
- [x] 2.3 确认 `compact_boundary` 可落入现有 `Context compacted.` 消息链路并保持去重（输入：thread/compacted；输出：单条语义消息；验证：reducer/turn events 测试通过）。

## 3. 前端最小改动接入（P1）

- [x] 3.1 复用现有 `useAppServerEvents` 与 `useThreadTurnEvents`，确保 Claude 事件进入现有 compaction 状态流（输入：thread/compacting|compacted；输出：isContextCompacting 与 compacted message 正常更新；验证：前端 hook 单测）。
- [x] 3.2 按需增加“轻量 compacting 可视提示”（不新增大型组件）（输入：isContextCompacting=true；输出：可感知提示；验证：UI snapshot/组件测试，不影响布局与其他引擎）。

## 4. 引擎边界与回归保护（P0）

- [x] 4.1 增加“仅 Claude 生效”边界守卫测试（输入：claude/codex/opencode/gemini 线程；输出：自动恢复仅在 Claude 执行；验证：跨引擎回归测试）。
- [x] 4.2 回归 Codex/OpenCode/Gemini 现有 compaction/error 行为不变（输入：既有测试集；输出：无行为回退；验证：相关后端/前端测试全绿）。
- [x] 4.3 完成端到端验收脚本：长上下文触发 -> 自动 compact -> 重试成功/失败两条路径（输入：可复现实验数据；输出：验收记录；验证：日志与 UI 状态一致）。
