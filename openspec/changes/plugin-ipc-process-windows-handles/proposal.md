# Proposal: plugin-ipc-process-windows-handles

> Wave：1F8（插座本体 · Windows Restricted Process 不得继承额外 handle）  
> 依赖：1F7 Unix fd close  
> 论文对齐：隔离 = 独立上下文；未授权句柄不得进入子进程。

## Why

1F7 只在 Unix `pre_exec` 关闭 `fd >= 3`。Windows `CreateProcess` 默认 `bInheritHandle=TRUE`，Host 已打开的 inheritable handle（Named Pipe、sqlite、用户文件）会进 child。合同要求 handle leakage 防护。

## 边界

1. `windows_process_flags_ok` MUST 要求 `CREATE_NO_WINDOW`，且不得含会共享 console 的冲突 flag。
2. `windows_inherit_handles_ok` MUST 拒绝额外 inherit。
3. Windows spawn MUST 先过这两道闸门，再 `creation_flags(CREATE_NO_WINDOW)`。
4. 本机 macOS 验收政策闸门；完整 CreateProcess 只在 Windows 上跑。
5. 不切产品。

## Capabilities

- `plugin-ipc-process-windows-handles-v1`
