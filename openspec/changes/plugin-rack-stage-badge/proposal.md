# Proposal: plugin-rack-stage-badge

> OpenSpec change id: `plugin-rack-stage-badge`

## Why

本地安装后，用户应在 Host 插排上看到 staged 标记，同时插头仍必须 idle。展示不是 activation。

## 目标与边界

1. 插排卡片 MUST 显示本地 staged / 未安装。
2. staged MUST NOT 改变 Host `state`。
3. MUST NOT 调 `activate_plugin`。

## Capabilities

- `plugin-rack-stage-badge-v1`
