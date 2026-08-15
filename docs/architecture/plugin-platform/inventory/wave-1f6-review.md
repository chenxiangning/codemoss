# Wave 1F6 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-process-cwd`  
> 论文对齐：隔离 = 独立上下文；config 是真值。合同 cwd 默认 `plugin-data`。  
> 结论：**方向正确。这是实洞。** Restricted Process 不再继承 Host 工作目录。`cwd` 必须是 `{root}/plugin-runtime/data/{plugin_id}`。相对路径 / `..` / 其他目录不得留下 child。peer fixture 核对 `cwd == MOSSX_PLUGIN_DATA`。本刀不开放 `workspace-root`。不切产品。
