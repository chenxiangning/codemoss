# Proposal: plugin-rack-declared-later-plugs

> OpenSpec change id: `plugin-rack-declared-later-plugs`  
> 依赖：`plugin-rack-market-sibling`

## Why

市场只读插排目前只声明 Claude / Notes。路线图下一组插头已有 inventory 身份，但 UI 看不见。本刀只把它们写进只读清单。

## 目标与边界

1. 只读清单补上 `com.mossx.project-map`、`com.mossx.browser`、`com.mossx.intent-canvas`。
2. 身份必须来自现有 ownership inventory，禁止发明新 pluginId。
3. MUST NOT 激活、disable、安装。
4. MUST NOT 默认开 flag、删 `engine/claude*`、迁 `note_cards`。

## Capabilities

- `plugin-rack-declared-later-plugs-v1`
