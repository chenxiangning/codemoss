# Tasks: bound-command-execution-output-memory

## 1. 输出预算

- [x] 1.1 新增 `src/features/threads/utils/boundToolOutput.ts`（budget / head / omitted 累加 / flag）与单测
- [x] 1.2 `normalizeItem` 对 commandExecution / fileChange 走 `boundToolOutput`，更新 `threadItems.test.ts`
- [x] 1.3 `appendToolOutputDelta` 拼接后立刻 bound；补 assembler 超大输出用例
- [x] 1.4 `realtimePerfFlags` 增加 `ccgui.perf.toolOutputBudget`（默认 on）

## 2. 垃圾目录名单

- [x] 2.1 `is_special_build_artifact_dir_name` 增加 `temp` / `tmp` / `.tmp`，补 rust 测例
- [x] 2.2 同步 `fileTreePanelInternals.ts` 与 `file_classification.rs`
- [x] 2.3 实现 `.codexignore` 托管段 upsert，挂到 Shared `start_thread_core` 与 Native `start_thread`

## 3. 验收

- [x] 3.1 跑 focused vitest + 相关 cargo test
- [x] 3.2 `openspec validate bound-command-execution-output-memory --strict --no-interactive`
- [x] 3.3 写 verification 记录；**不 commit**
