# Proposal: plugin-local-catalog-groups

> OpenSpec change id: `plugin-local-catalog-groups`

## Why

本地目录已有 45 个过渡仓。不分组会把试点和后续插件混在一起。

## 目标与边界

1. 本地目录 MUST 先显示 pilot，再显示 later-plugin。
2. MUST NOT 改变 stage 语义，MUST NOT 激活 Host。

## Capabilities

- `plugin-local-catalog-groups-v1`
