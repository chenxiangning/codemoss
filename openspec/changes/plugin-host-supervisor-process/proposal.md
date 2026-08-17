# Proposal: plugin-host-supervisor-process

> OpenSpec change id: `plugin-host-supervisor-process`  
> Wave：P4.7 批次 27（插排 · Host supervisor 独立进程）  
> 架构：`02` §1 Host 是 supervisor，不是业务容器。当前 `BootHost` 把 UDS 值守放在 Core 线程。

## Why

设计要求 Extension Host 独立于 Core。现在 supervisor accept 循环在 `boot.rs` 的 in-process 线程。Core crash 会带走插排。

本刀把 supervisor 编成独立 executable：绑私有 UDS，对意外连接回 `host-disabled`，不激活 Claude / Notes。`BootHost` 监督该子进程；drop 杀组并 unlink。`boot_driver()` 仍 `missing_executable()`。不 Slim，不接产品激活。

## 目标与边界

1. supervisor 必须是独立 OS 进程。
2. 连接 MUST 收到 `host-disabled`，MUST NOT 激活产品插头。
3. `boot_driver()` MUST 仍 missing。
4. **MUST NOT** Slim，**MUST NOT** 默认激活插件。

## Capabilities

- `plugin-host-supervisor-process-v1`
