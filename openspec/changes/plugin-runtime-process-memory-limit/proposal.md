# Proposal: plugin-runtime-process-memory-limit

> Wave：1F9（插座本体 · Restricted Process 必须有内存上限）  
> 依赖：1F5 env_clear、1F7 关闭继承 FD  
> 论文对齐：隔离 = 独立上下文；未声明无限预算是未声明依赖，必须 fail closed。

## Why

1QJ12 给 Worker 加了 128 MiB。Restricted Process 合同默认 512 MiB、硬上限 2048 MiB。现在 spawn 不设 rlimit，`0` 等于无限。子进程可以吃光 Host。

## 边界

1. `process_memory_limit_ok` MUST 拒绝 `0` 与超过 2048 MiB。
2. Unix spawn MUST 在 `pre_exec` 设 `RLIMIT_AS` 为 512 MiB。
3. 子进程若看到无限或超默认上限 MUST 不能完成 handshake。
4. 不切产品。Windows 本刀只验闸门。

## Capabilities

- `plugin-runtime-process-memory-limit-v1`
