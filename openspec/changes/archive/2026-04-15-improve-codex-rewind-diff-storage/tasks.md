## 1. 入口与回溯模型对齐（P0）

- [x] 1.1 扩展 rewind 入口可见性矩阵到 `Codex`（依赖: 无；输入: 当前引擎与会话状态；输出: Claude+Codex 可见、其他引擎隐藏；验证: 输入区/上下文栏可见性单测通过）
- [x] 1.2 抽离共享 rewind preview model，并补齐 Codex preview builder（依赖: 1.1；输入: 会话消息与 tool/file change facts；输出: 引擎无关 preview 数据；验证: preview 构建测试覆盖文件聚合与空态）
- [x] 1.3 接入 Codex rewind target 传递与确认 handler（依赖: 1.2；输入: preview.targetMessageId；输出: 可触发 Codex 回溯确认流程；验证: 交互测试覆盖取消/确认链路）
- [x] 1.4 实现首条 user message 命中时的回溯生命周期策略（依赖: 1.3；输入: 首条锚点 target；输出: 避免无意义 fork 的专用处理；验证: 首条锚点单测通过）

## 2. 审查面复用与导出接线（P0）

- [x] 2.1 将现有 `ClaudeRewindConfirmDialog` 提升为可复用 rewind review surface（依赖: 1.2；输入: 共享 preview props；输出: Codex/Claude 均可复用的文件 rail + diff panel；验证: 组件测试覆盖文件切换和默认选中）
- [x] 2.2 复用 `export_rewind_files` 完成 Codex “存储变更”接线（依赖: 2.1；输入: engine/sessionId/targetMessageId/files；输出: `~/.ccgui/chat-diff/codex/{YYYY-MM-DD}/{sessionId}/{targetMessageId}/` 快照；验证: 前端调用参数测试 + Rust 导出路径测试）
- [x] 2.3 确保 missing diff 与导出失败均为可恢复状态（依赖: 2.1, 2.2；输入: 无 diff 文件或导出异常；输出: 空态/错误提示但不阻断回溯确认；验证: 失败场景单测）
- [x] 2.4 接入无 inline diff 的恢复策略（依赖: 1.2, 2.3；输入: kind 与 structured `old_string/new_string`；输出: 无 diff 场景仍可回溯；验证: no-diff 场景测试通过）
- [x] 2.5 统一 kind 冲突决策优先级（依赖: 2.4；输入: `modified` 与 `add/delete/rename` 混合来源；输出: 具体语义优先；验证: kind 冲突测试通过）
- [x] 2.6 追加 rewind/fork 失败自动回滚快照链路（依赖: 1.3, 2.4；输入: 模拟 fork 失败；输出: 工作区文件自动恢复到回溯前；验证: 回滚双写顺序测试通过）

## 3. 契约一致性与回归验证（P1）

- [x] 3.1 对齐 `sourcePath` 契约到 Codex rewind preview / manifest / local replay（依赖: 1.2, 2.2；输入: file change path；输出: 三处身份一致；验证: 契约测试覆盖相对路径、绝对路径、file URI）
- [x] 3.2 扩展前后端最小回归测试集（依赖: 2.3, 2.6, 3.1；输入: 变更后的入口、弹层、导出与回滚行为；输出: 新增或更新的 TS/Rust 测试；验证: 目标测试用例通过）
- [x] 3.3 增加首条锚点与无 diff 恢复专项回归（依赖: 1.4, 2.4, 2.5；输入: 首条 target/no-diff/add-like 样例；输出: 稳定回归断言；验证: 专项测试全绿）
- [x] 3.4 运行实现前质量门禁（依赖: 3.2, 3.3；输入: 代码与测试变更；输出: 可执行验证记录；验证: `pnpm vitest` 目标集 + `pnpm tsc --noEmit` 通过）
