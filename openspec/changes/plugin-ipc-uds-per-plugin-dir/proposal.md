# Proposal: plugin-ipc-uds-per-plugin-dir

> Wave：1UDS9（插座本体 · 私有 UDS 目录必须按 plugin 隔离）  
> 依赖：1UDS6 父目录 0700、1UDS8 connect 也核 0700  
> 论文对齐：isolation = 独立上下文；Notes 与 Claude 不得共享 socket 目录。

## Why

`private_uds_dir()` 现在是 `/tmp/m{pid}`，全进程共享。Worker / UDS driver / MXPD 都落在同一目录。一个插件枚举目录就能看见另一个插件的 socket 名。

## 边界

1. `private_uds_dir(plugin_id)` MUST 为每个 reverse-DNS plugin 建独立 0700 目录。
2. Notes 与 Claude MUST 不得共享父目录。
3. 非法 pluginId MUST 不得创建目录。
4. 目录仍 MUST 恰好 0700，且不得回落到 `/tmp` 直绑。
5. 不切产品。

## Capabilities

- `plugin-ipc-uds-per-plugin-dir-v1`
