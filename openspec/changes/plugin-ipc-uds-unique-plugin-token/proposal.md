# Proposal: plugin-ipc-uds-unique-plugin-token

> Wave：1UDS10（插座本体 · 私有 UDS 目录 token 必须绑定完整 pluginId）  
> 依赖：1UDS9 按 plugin 隔离  
> 论文对齐：isolation = 独立上下文；同后缀的 pluginId 不得共享目录。

## Why

1UDS9 用 pluginId 最后一段前 6 字符作目录名。`com.mossx.notes` 与 `com.evil.notes` 都会落到 `notes`。这不是独立上下文。

## 边界

1. `private_uds_dir` token MUST 由完整 pluginId 派生，不得只取最后一段。
2. `com.mossx.notes` 与 `com.evil.notes` MUST 不得共享目录。
3. 非法 pluginId 仍 MUST 失败。
4. 路径仍 MUST 短于 `sockaddr_un` 上限。
5. 不切产品。

## Capabilities

- `plugin-ipc-uds-unique-plugin-token-v1`
