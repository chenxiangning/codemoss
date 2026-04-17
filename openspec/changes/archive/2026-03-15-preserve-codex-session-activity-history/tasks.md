## 1. Artifact and Contract Baseline

- [x] 1.1 明确 Codex 历史恢复缺口的能力边界与 delta specs。[I: 现有主 specs 与问题现象][O: proposal/design/specs 初稿][V: OpenSpec status 可识别 artifacts][P: P0][depends: none]
- [x] 1.2 锁定回归场景：`resumeThread` 只有 message，但历史 reopening 仍要恢复 activity。[I: 现有 history/parity tests][O: 退化场景用例定义][V: 测试描述覆盖 reasoning/command/fileChange][P: P0][depends: 1.1]

## 2. Backend Session Fallback

- [x] 2.1 新增 `load_codex_session` Tauri command，按 workspace 解析本地 Codex session JSONL。[I: workspaceId + threadId][O: 原始 entries JSON 返回][V: 命令单测通过，workspace mismatch 安全处理][P: P0][depends: 1.2]
- [x] 2.2 将新命令注册到前端 IPC service。[I: Tauri command][O: `loadCodexSession` service wrapper][V: 前端可通过 invoke 调用][P: P0][depends: 2.1]

## 3. Frontend History Reconstruction

- [x] 3.1 实现 Codex JSONL fallback parser，把 `reasoning`、`function_call/function_call_output`、`custom_tool_call(apply_patch)` 映射到现有 `ConversationItem`。[I: 原始 JSONL entries][O: 结构化 fallback items][V: 单测覆盖 reasoning/command/fileChange][P: P0][depends: 2.2]
- [x] 3.2 在 `codexHistoryLoader` 中合并 `resumeThread` 与 fallback 结果，优先保留更丰富活动项。[I: thread snapshot + fallback items][O: 完整 history snapshot][V: 历史恢复后 activity 不为空且正文不被注入污染][P: P0][depends: 3.1]
- [x] 3.3 在线程恢复入口传递 workspacePath 与 Codex fallback loader，保证统一历史链路生效。[I: 当前 unified history loader][O: 运行时接线完成][V: 相关 hook 测试不回退][P: P1][depends: 3.2]

## 4. Verification Gate

- [x] 4.1 为 `history loaders` 增加退化场景回归测试。[I: fallback parser + codex loader][O: history loader regression tests][V: `vitest` 对应用例通过][P: P0][depends: 3.2]
- [x] 4.2 为 `realtime/history parity` 增加 Codex 历史 fallback 对齐测试。[I: realtime contract + degraded history source][O: parity regression test][V: fallback 后语义与 realtime 一致][P: P0][depends: 3.2]
- [x] 4.3 执行最小验证并记录结果。[I: Rust/TS 改动][O: 测试与构建结果][V: 目标测试通过，若有未跑项目需显式记录][P: P1][depends: 4.1, 4.2]
