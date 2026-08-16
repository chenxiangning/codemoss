# Proposal: plugin-rack-lockfile-version

> OpenSpec change id: `plugin-rack-lockfile-version`

## Why

本地目录已显示 lockfile version。Host 插排还只显示 staged / idle。用户需要在插排上也看见装的是哪一版。

## 目标与边界

1. 插排卡片 MUST 显示 lockfile version 或默认 `1.0.0`。
2. version MUST NOT 改变 Host `state`。
3. MUST NOT 激活 Host。

## Capabilities

- `plugin-rack-lockfile-version-v1`
