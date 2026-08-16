# plugin-rack-market-sibling-v1 Spec Delta

## ADDED Requirements

### Requirement: plugin rack MUST live on Market, sibling of Extensions

侧栏「市场」MUST 打开独立 surface。只读插排 MUST 出现在该 surface。拓展 Plugins tab MUST 不再承载插排。Marketplace 安装 MUST 仍关闭。

#### Scenario: Market button opens the rack

- **WHEN** 用户点击侧栏「市场」
- **THEN** `appMode` MUST 为 `market`
- **AND** 页面 MUST 展示 Host 只读插排

#### Scenario: Extensions Plugins stays empty

- **WHEN** 用户打开拓展 → Plugins
- **THEN** 页面 MUST 仍是空壳
- **AND** MUST NOT 出现安装按钮
