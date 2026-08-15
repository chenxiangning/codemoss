# Proposal: plugin-ipc-process-cwd

> Wave：1F6（插座本体 · Restricted Process cwd 必须钉在 plugin-data）  
> 依赖：1F5 env_clear  
> 论文对齐：隔离 = 独立上下文；config 是真值。合同 cwd 默认 `plugin-data`。

## Why

合同写明 process `cwd` 仅 `plugin-data` \| `workspace-root`，默认 `plugin-data`。现在 `Command` 不设 `current_dir`，子进程继承 Host 工作目录，能看见仓库源码与用户 cwd。

## 边界

1. `plugin_data_cwd(root, plugin_id)` MUST 等于 `{root}/plugin-runtime/data/{plugin_id}`。
2. `process_cwd_ok` MUST 只接受该路径；相对路径 / `..` / 空路径 / 其他目录 MUST 失败。
3. spawn MUST `create_dir_all` 后 `current_dir` 到该路径，否则不得留下 child。
4. 本刀不开放 `workspace-root`。
5. 不切产品。

## Capabilities

- `plugin-ipc-process-cwd-v1`
