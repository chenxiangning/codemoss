# Wave 1F3 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-runtime-process-manifest-kind`  
> 论文对齐：隔离粒度必须等于组件声明；UI / Worker 不是 OS 进程。  
> 结论：**方向正确。这是实洞。** Restricted Process 只给 `kind=process` 开 child。Notes 激活不留进程；Claude 只留 `claude-cli`。`evil-cli` 不得 spawn。不切产品，不进 boot。
