# Proposal: plugin-local-permission-preview

> OpenSpec change id: `plugin-local-permission-preview`

## Why

P0.8 要求安装前能看见 permission preview，且不加载入口。市场本地安装现在只打标记，还没把预览展示出来。

## 目标与边界

1. 本地目录卡片 MUST 显示声明的 capability。
2. 数据 MUST 来自过渡仓 Manifest metadata，MUST NOT 读 entry path。
3. MUST NOT 激活 Host。

## Capabilities

- `plugin-local-permission-preview-v1`
