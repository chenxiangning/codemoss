# Proposal: plugin-ipc-process-fds

> Wave：1F7（插座本体 · Restricted Process 不得继承父进程额外 FD）  
> 依赖：1F5 env_clear / 1F6 plugin-data cwd  
> 论文对齐：隔离 = 独立上下文；未授权句柄不得进入子进程。

## Why

合同 Security Boundary 要求 process inheritance / handle leakage 防护。1F5 清了环境，1F6 钉了 cwd。`Command::spawn` 默认仍继承 Host 已打开的 FD。子进程能拿到 Host 的 socket / sqlite / 用户文件。

## 边界

1. Unix spawn MUST 在 `exec` 前关闭 `fd >= 3`。
2. 子进程 handshake 路径只保留 stdin / stdout；stderr 为 null。
3. peer 若发现 `fd >= 3` MUST 退出，handshake 不得完成。
4. Host 打开的探测 FD MUST 不得让 handshake 失败——证明已关闭。
5. 本刀不处理 Windows handle inheritance。不切产品。

## Capabilities

- `plugin-ipc-process-fds-v1`
