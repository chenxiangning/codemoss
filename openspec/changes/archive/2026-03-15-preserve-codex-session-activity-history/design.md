## Context

当前 `Codex` 历史恢复只依赖 `resumeThread` 返回的线程快照。该快照在部分历史场景下只包含消息正文，缺少 `reasoning`、命令执行、补丁编辑等结构化活动项，导致消息区与右侧 `session activity` 的历史事实不完整。  
仓库已经存在 Codex 本地 session JSONL 扫描能力，但目前只用于 session summary / usage fallback，没有 full-history 读取接口。

## Goals / Non-Goals

**Goals:**

- 为 `Codex` 历史恢复提供稳定的本地 JSONL fallback。
- 将 fallback 结果映射为现有 `ConversationItem`，不引入新的前端渲染模型。
- 在退化 `resumeThread` 场景下恢复 `reasoning`、`commandExecution`、`fileChange`。

**Non-Goals:**

- 不改变 Claude / OpenCode 历史协议。
- 不把所有 Codex tool 类型都升级成完整历史播放器。
- 不修改实时 reducer、右侧面板组件或线程树结构。

## Decisions

### Decision 1: 新增独立的 `load_codex_session` Tauri command

- 备选方案 A：继续只用 `resumeThread`。
- 备选方案 B：在前端直接读本地文件。
- 采纳：A 无法修复事实缺失；B 不适合桌面前端权限边界。  
  因此在 Rust 侧新增只读命令，由后端解析工作区可见的 Codex sessions roots，返回指定 session 的原始 JSONL entries。

### Decision 2: 历史 fallback 在前端完成协议归一化

- 备选方案 A：Rust 直接产出最终 `ConversationItem`。
- 备选方案 B：Rust 只返回原始 entries，TypeScript 负责映射。
- 采纳：前端已经拥有 `buildConversationItemFromThreadItem`、消息规范化与 activity 语义，对齐成本更低，也更容易和现有测试一起演进。

### Decision 3: fallback 结果与 `resumeThread` 快照做“富信息优先合并”

- 备选方案 A：fallback 全量替换 `resumeThread` 结果。
- 备选方案 B：只在空快照时使用 fallback。
- 采纳：A 风险是丢掉 `resumeThread` 已经归一化好的消息与 plan/userInput；B 无法覆盖“有 message 但缺活动”的主故障场景。  
  因此采用合并策略：保留 `resumeThread` 为主事实源，再把本地 fallback 中更丰富的 `reasoning/tool` 项补进来。

### Decision 4: fallback 只补结构化活动，避免注入消息污染正文

- Codex JSONL 会包含 developer/user 注入内容、历史工具输出与最终 assistant message。
- 为避免把 AGENTS / system 注入块错误回放到消息区，fallback 默认只补 `reasoning`、`commandExecution`、`fileChange`；正文消息继续以 `resumeThread` 为准。

## Risks / Trade-offs

- [Risk] 读取本地 JSONL 会增加历史打开耗时。  
  Mitigation: 只在历史恢复时按 threadId 精确读取单个 session 文件，不做全量扫描结果展开。

- [Risk] Codex JSONL 协议后续扩展可能引入新的 tool item 形态。  
  Mitigation: fallback parser 先覆盖已知高价值类型，未知类型安全忽略，不影响现有渲染。

- [Risk] 同一 session 可能同时存在 `resumeThread` 与 fallback 的重复活动项。  
  Mitigation: 通过现有 `mergeThreadItems` 做按 id 合并，并优先保留更丰富内容。

## Migration Plan

1. 在 Rust 侧新增 `load_codex_session` 命令与最小单元测试。
2. 在前端新增 Codex session history parser，并接入 `codexHistoryLoader`。
3. 在线程历史恢复入口传入 workspacePath / fallback loader。
4. 补充退化场景测试并执行最小回归。

## Open Questions

- `custom_tool_call` 的更多类型是否需要后续继续映射为 `fileChange` 之外的结构化卡片。
- 是否要在后续版本把 `resumeThread` 后端持久化补齐到无需 fallback。
