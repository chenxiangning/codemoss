# plugin-rack-kind-groups-v1 Spec Delta

## ADDED Requirements

### Requirement: Market rack MUST group declared plugs by kind

市场只读插排 MUST 按 `engine` 与 `feature` 分组展示。分组 MUST NOT 改变插头状态，MUST NOT 提供安装 / 启用按钮。

#### Scenario: engines and features are grouped

- **WHEN** 快照包含 Claude 与 Notes
- **THEN** 页面 MUST 分别展示 Engine 组与 Feature 组
- **AND** Claude MUST 出现在 Engine 组
- **AND** Notes MUST 出现在 Feature 组
- **AND** 页面 MUST NOT 出现安装按钮
