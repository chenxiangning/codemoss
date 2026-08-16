# Proposal: plugin-local-lockfile-version

> OpenSpec change id: `plugin-local-lockfile-version`

## Why

lockfile 已有 version，市场卡片还只显示安装 / 未安装。用户需要看见装的是哪一版。

## 目标与边界

1. 已 stage 的卡片 MUST 显示 lockfile version。
2. 未 stage 的卡片 MUST 显示过渡仓 version `1.0.0`。
3. MUST NOT 激活 Host。

## Capabilities

- `plugin-local-lockfile-version-v1`
