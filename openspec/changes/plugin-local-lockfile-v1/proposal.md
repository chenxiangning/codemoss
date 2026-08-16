# Proposal: plugin-local-lockfile-v1

> OpenSpec change id: `plugin-local-lockfile-v1`

## Why

市场本地安装现在只存 pluginId 列表。P2.5 要求 staged candidate 有 lockfile 形状，否则卸载/重装没有可回放记录。

## 目标与边界

1. 本地 lockfile MUST 记录 `pluginId` + `version`。
2. 未知 pluginId MUST fail closed。
3. lockfile MUST NOT 激活 Host、MUST NOT 远程下载。
4. 卸载 MUST 只删 lockfile 行，MUST NOT 删产品源码。

## Capabilities

- `plugin-local-lockfile-v1`
