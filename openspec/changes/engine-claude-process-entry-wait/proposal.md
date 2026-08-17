# Proposal: engine-claude-process-entry-wait

> OpenSpec change id: `engine-claude-process-entry-wait`  
> Wave：P4.7 批次 14（第一根插头 · 收割 exit-status）  
> 依赖：`engine-claude-process-entry-resume-spawn`  
> 架构：产品 `send_message` 在 EOF 后 `child.wait()`，非零退出当失败。

## Why

批次 13 已能 flag-on spawn / 行读 / resume。产品结束时仍对 Process Entry 一律 `interrupt`，自然退出码被吃掉。非零 CLI 会静默当成功。

本刀补 `mossx.process.wait`：非阻塞试收割，返回 `exited` + `code`。`send_message` flag-on 在非 grace 路径 MUST 先 wait；未退出才 interrupt。默认路径 MUST 仍 `child.wait()`。不宣称 stream / interrupt conformance。

## 目标与边界

1. Process Entry MUST 实现 `mossx.process.wait`。
2. `ProcessEntryTurn::try_wait` MUST 上报 CLI 退出码。
3. **MUST NOT** 默认开 flag，**MUST NOT** Slim，**MUST NOT** 改 `boot_driver()`。

## Capabilities

- `engine-claude-process-entry-wait-v1`
