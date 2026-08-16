# Proposal: plugin-local-lockfile-hash

> OpenSpec change id: `plugin-local-lockfile-hash`

## Why

P0.9 要求 `pluginId + version` 绑定 artifactHash。本地 lockfile 现在只有 version，重复绑定无法 fail closed。

## 目标与边界

1. lockfile 行 MUST 带 `artifactHash`。
2. 同一 `pluginId + version` 换 hash MUST 拒绝。
3. MUST NOT 激活 Host、MUST NOT 读入口文件。

## Capabilities

- `plugin-local-lockfile-hash-v1`
