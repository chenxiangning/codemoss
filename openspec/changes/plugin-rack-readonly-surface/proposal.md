# Proposal: plugin-rack-readonly-surface

> OpenSpec change id: `plugin-rack-readonly-surface`  
> Wave：UI-1（插排只读展示）  
> 依赖：Host boot 默认 off  
> 架构：[`01` Extensions 管理壳](../../../docs/architecture/plugin-platform/01-core-boundary.md) · [`08` P6 Marketplace 后置](../../../docs/architecture/plugin-platform/08-migration-roadmap-and-tasks.md)

## Why

插排本体已落地，但主 UI Extensions → Plugins 仍是空壳。用户在主界面看不到 Host / 插头状态，会误以为插座不存在。Marketplace 仍是 P6，不能先做下载市场。

## 目标与边界

1. Extensions → Plugins 展示只读插排：Host 默认 off、Claude / Notes 两个已声明插头。
2. 只读 command `get_plugin_rack_snapshot`。MUST NOT activate / disable / install。
3. 侧栏「市场」按钮保持 disabled。
4. MUST NOT 默认开 flag、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace。

## Capabilities

- `plugin-rack-readonly-surface-v1`
