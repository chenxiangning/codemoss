# Proposal: engine-claude-process-entry-resume-gate

> OpenSpec change id: `engine-claude-process-entry-resume-gate`  
> Wave：P4.7 批次 12（第一根插头 · resume 闸门）  
> 依赖：`engine-claude-process-entry-line-cutover`  
> 架构：[`15` §3 Dual-run](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

批次 11 已把 `send_message` 行读接到 cursor。approval / AskUser resume 仍各有一处 `cmd.spawn()`，会在 flag-on 时拉第二条 Core Child。同一时刻两个 owner，插头立刻假。

本刀不切 resume 语义。flag-on 时 MUST 拒绝这两条 resume，杀掉已有 Process Entry generation，返回 `process-entry-resume-not-cutover`。默认路径 MUST 仍 `cmd.spawn()` 第二条 Core Child。

## 目标与边界

1. `refuse_process_entry_resume`：flag on → 杀组 + 该错误码。
2. `handle_file_approval_resume` / `handle_ask_user_question_resume` MUST 在 `cmd.spawn()` 前过闸。
3. **MUST NOT** 默认开 flag，**MUST NOT** Slim，**MUST NOT** 宣称 resume conformance。

## Capabilities

- `engine-claude-process-entry-resume-gate-v1`
