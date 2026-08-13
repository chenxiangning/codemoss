# Proposal: bound-command-execution-output-memory

> OpenSpec change id: `bound-command-execution-output-memory`  
> 触发：Shared 调 Codex 递归列出 `node_modules` / 构建产物后，32GB 内存被会话态吃光，整机硬重启

## Why

`useToolOutputTailGate` 只限制 dispatch 频率，不限制 `ConversationItem.output` 体积。`appendToolOutputDelta` 无界拼接，`normalizeItem` 又对 `commandExecution` 明文豁免截断。Codex 对 `node_modules`、`target`、`temp` 一类目录跑 `Get-ChildItem -Recurse` / `rg --files` 时，输出会在 Codex 进程、Rust 事件、JS store、WebView2 各留一份，物理内存被打穿。

## 目标与边界

1. **进 store 之前**对 `commandExecution` / `fileChange` 输出做 head+tail 硬预算。事件仍送达，组装后的正文有界。
2. 垃圾目录名单复用 `workspace_listing` 的 dependency + build artifact 清单，并补 `temp` / `tmp` / `.tmp`。
3. Shared / Native 拉起 Codex 时，幂等写入 workspace `.codexignore` 的 mossx 托管段，降低引擎再扫这些目录的概率。
4. 默认开启；可用 `ccgui.perf.toolOutputBudget=off` 回退。

## 非目标

- 不改侧栏 Session Index / catalog 扫盘。
- 不杀 Codex 进程，不改 `snapshot_throttle` / `BatchedTauriEventSink` 的 lossless `outputDelta` 契约。
- 不改 `.gitignore`，不在 GUI 里解析/拦截用户命令。
- 不宣称能挡住用户显式 `Get-ChildItem -Recurse .\target`；那条仍靠层 1 预算。

## What Changes

- 新增 `boundToolOutput`：`commandExecution` 256 KiB（64 KiB 头 + 尾），`fileChange` 1 MiB。
- `normalizeItem` 与 `appendToolOutputDelta` 统一走预算；history / snapshot 回放同样有界。
- `commandExecution` 不再享受「近 4 条全文豁免」。
- `temp` / `tmp` / `.tmp` 并入特殊构建目录；file tree / workspace listing / project-map builtin ignore 对齐。
- Codex thread start 前 upsert `.codexignore` 托管段（`# BEGIN mossx-managed-junk-dirs`）。

## 技术方案对比

| 方案 | 做法 | 取舍 |
|------|------|------|
| A. 丢弃/节流 `outputDelta` | 在 pacing / sink 丢事件 | 违反 `app-server-event-stream-pacing`；直播终端感被破坏 |
| B. 只在渲染层截 100 行 | `BashToolGroupBlock` 已有 | store / persist / history 仍会爆，治标不治本 |
| **C. assembler 硬预算 + 垃圾目录 ignore（采用）** | 进 `item.output` 前 head+tail；名单注入 `.codexignore` | 不破坏事件送达；挡不住用户手动递归，但挡得住 32GB 会话态 |

## Capabilities

### New Capabilities

- `conversation-tool-output-budget`：会话组装后的 tool output 字节预算与回退开关
- `workspace-junk-dir-ignore`：垃圾目录名单（含 `temp`/`tmp`/`.tmp`）与 Codex `.codexignore` 托管段

### Modified Capabilities

- `app-server-event-stream-pacing`：澄清 outputDelta 仍不可丢；预算发生在组装层，不是 sink

## Impact

- Frontend：`threadItems.ts`、`conversationAssembler.ts`、`realtimePerfFlags.ts`、file tree 特殊目录
- Rust：`workspace_listing.rs`、Codex `thread/start` 前 ignore upsert、project-map builtin ignore
- 测试：vitest（budget / assembler / threadItems）+ cargo（特殊目录 / `.codexignore` upsert）
- 不改 IPC 事件 schema，不改 pacing 数字

## 验收标准

1. 连续 append 10 MiB `commandExecution` delta 后，该 item `output.length ≤ 256 KiB`，含 omitted 标记，尾部是最后一段。
2. `item/completed` 带来 5 MiB snapshot，进 store 后同样有界。
3. history 回放超大 `commandExecution`，hydrate 后有界。
4. 日常小 `fileChange` diff 一字不丢；超过 1 MiB 才 head+tail。
5. `temp` / `tmp` / `.tmp` 被 `is_special_directory_path` 识别；`.codexignore` 托管段幂等，不覆盖用户手写规则。
6. `ccgui.perf.toolOutputBudget=off` 恢复旧「commandExecution 不截断」。
7. 现有 tail gate / pacing 测试不回退。
