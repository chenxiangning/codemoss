# Proposal: plugin-local-catalog-v1

> OpenSpec change id: `plugin-local-catalog-v1`

## Why

市场安装/卸载的第一步是让市场看见仓库内过渡仓。本刀只列本地目录，不下载、不安装、不启用。

## 目标与边界

1. 本地目录只包含仓库内 `packages/plugin-*` 过渡仓。
2. 市场页只读展示这些包。
3. MUST NOT 远程 Registry、MUST NOT install command、MUST NOT 默认开 flag。

## Capabilities

- `plugin-local-catalog-v1`
