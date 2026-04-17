## 1. Artifact and Contract Baseline

- [x] 1.1 固化历史丢失子会话问题边界与能力映射（输入: 现有 specs + 问题截图；输出: proposal/specs/design 初稿；验证: `openspec status` 显示 artifacts 可识别）
- [x] 1.2 明确验收口径“实时子会话数 = 历史 reopening 子会话数”（输入: 现有 session activity 行为；输出: 可测试场景定义；验证: tasks/specs 均包含该口径）

## 2. Codex History Parsing

- [x] 2.1 扩展 `codexSessionHistory` 协作调用解析（输入: response_item/function_call payload；输出: `collabToolCall` 语义 item；验证: parser 单测覆盖 `spawn_agent / send_input / wait`）
- [x] 2.2 规范化协作调用 detail/output 字段（输入: 变体字段命名；输出: 可被 fallback linking 解析的 `From ... → ...` 事实；验证: `buildFallbackParentById` 场景测试通过）

## 3. Unified Reopen Link Recovery

- [x] 3.1 在 unified history loader 路径补 thread link 回填（输入: history snapshot items；输出: `threadParentById` 可恢复；验证: reopen 后 `relevantThreadIds` 包含 child）
- [x] 3.2 确保回填逻辑幂等且不覆盖已有 parent（输入: 现有 parent map；输出: 无冲突更新；验证: 关系冲突单测通过）

## 4. Session Activity Parity Verification

- [x] 4.1 新增回归测试：实时多子会话 -> 历史 reopening 保持可见（输入: codex history fixtures；输出: parity test；验证: 目标 vitest 通过）
- [x] 4.2 保护非 Codex 引擎不受影响（输入: Claude/OpenCode 既有历史用例；输出: 回归结果记录；验证: 既有用例不回退）

## 5. Quality Gate

- [x] 5.1 执行最小验证命令并记录结果（输入: 代码改动；输出: `vitest` + `tsc --noEmit` 结果；验证: 全通过或明确记录失败原因）
- [x] 5.2 汇总变更影响与回滚点（输入: 实施结果；输出: 变更说明；验证: 可追踪到文件与测试）
