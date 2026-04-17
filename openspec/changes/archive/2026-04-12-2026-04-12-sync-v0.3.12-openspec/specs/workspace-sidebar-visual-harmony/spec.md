## MODIFIED Requirements

### Requirement: Desktop Layout Mode Preference MUST Support Default and Swapped Modes
系统 MUST 提供 `default/swapped` 布局模式并保持中心对话区域连续可用。

#### Scenario: swapped mode mirrors side panels but keeps center flow stable
- **WHEN** 用户切换到 `swapped`
- **THEN** 左右面板与拖拽方向 MUST 镜像
- **AND** 中间消息/输入区域 MUST 持续可用

#### Scenario: invalid persisted layout mode falls back safely
- **WHEN** 持久化布局值缺失或非法
- **THEN** 系统 MUST 回退为 `default`
- **AND** topbar/titlebar 命中区 MUST 保持可点击

### Requirement: Swapped Quick Entry Order MUST Stay Deterministic
swapped 模式下侧栏快捷入口顺序与快捷键提示 MUST 保持一致可预测。

#### Scenario: swapped mode keeps shortcut order and labels aligned
- **WHEN** 用户在 swapped 模式查看侧栏快捷入口
- **THEN** 顺序 MUST 符合既定规则
- **AND** 快捷键文案 MUST 与实际动作一致
