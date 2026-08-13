# Design: bound-command-execution-output-memory

## Context

现场：Shared → Codex → PowerShell 递归列出 `proxy-server/cf-pages/node_modules/**`，32GB 拉满硬重启。

已有 `useToolOutputTailGate` 把 pending buffer 限制在 1 MiB，溢出后 **整段 flush 进 store**。`appendToolOutputDelta` 做 `` `${existing}${delta}` ``。`normalizeItem` 对 `NO_TRUNCATE_TOOL_TYPES`（含 `commandExecution`）保留全文。闸门修在错误的层：限速 ≠ 限存。

mossx 自己扫文件树已经跳过 `node_modules` / `target`，但名单缺 `temp`/`tmp`/`.tmp`；Codex shell 不受这套约束。

## Goals

1. 会话态 `item.output` 对 commandExecution / fileChange 永远有界。
2. 垃圾目录名单单一事实源，补 temp 族。
3. Codex thread start 幂等写入托管 `.codexignore`，不改用户手写段。

## Non-Goals

- 不丢 `item/commandExecution/outputDelta`。
- 不改侧栏 catalog / Session Index。
- 不修改用户 `.gitignore`。
- 不在渲染层假装已经止血。

## Decisions

### D1. 预算发生在 assembler 边界，不在 pacing

`replaceItemAtIndex` 已调用 `normalizeItem`。把 `boundToolOutput` 挂在：

- `normalizeItem`：直播 append、snapshot merge、history 回放
- `appendToolOutputDelta`：拼接后立刻 bound，避免先造巨型中间串（existing 已有界时 concat 只多一个 delta）

`app-server-event-stream-pacing` 保持「outputDelta 不可丢」。tail gate 继续做 32ms 合流；溢出 flush 的文本进 store 前仍走预算。

### D2. 数字

| kind | budget | head |
|------|--------|------|
| `commandExecution` | 256 KiB | 64 KiB |
| `fileChange` | 1 MiB | 128 KiB |

超限格式：`{head}\n…[omitted N chars]…\n{tail}`。

已有 omitted 标记时再 append：保留原 head，更新 tail，累加 omitted。禁止二次 bound 把 N 算成「本轮丢掉的几 KB」。

### D3. 回退开关

`ccgui.perf.toolOutputBudget`，默认 on。`off` 时 `boundToolOutput` 原样返回。与 `toolOutputTailGate` 独立。

### D4. 垃圾目录单一事实源

`is_special_build_artifact_dir_name` 增加 `temp` | `tmp` | `.tmp`。

同步：

- `src/features/files/components/fileTreePanelInternals.ts`
- `src-tauri/src/project_map_relations/file_classification.rs`

`.codexignore` 托管段由 `workspace_junk_dir_ignore_patterns()` 生成，与上述名单同源。

### D5. `.codexignore` 托管段，不写 `.gitignore`

标记：

```
# BEGIN mossx-managed-junk-dirs
...
# END mossx-managed-junk-dirs
```

- 文件不存在则创建。
- 已有托管段则整体替换该段。
- 段外用户规则原样保留。
- Shared `start_thread_core` 与 Native `start_thread` 在 `thread/start` 前 best-effort upsert；失败只记日志，不阻断开会话。
- Remote mode 不写本地盘。

## Risks

| 风险 | 缓解 |
|------|------|
| 用户源码目录就叫 `temp` | 与现有 `target`/`build` 同一产品取舍；层 1 仍保底 |
| Codex 不读 `.codexignore` | 层 1 仍防 32GB；ignore 是降概率 |
| 超大单次 snapshot 仍会先分配再截 | 可接受一次性尖峰；不在本 change 改 IPC |
| omitted 计数在二次截断后漂移 | 解析已有 marker 再累加 |

## Migration

无数据迁移。已持久化的超大 history 在 hydrate 时被 `normalizeItem` 截断。
