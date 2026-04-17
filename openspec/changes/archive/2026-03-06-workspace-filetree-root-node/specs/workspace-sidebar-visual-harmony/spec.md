## ADDED Requirements

### Requirement: 右侧文件树根节点视觉层级必须稳定可辨识
系统 MUST 在右侧文件树中为工作区根节点提供稳定且可辨识的视觉层级，避免与普通目录节点混淆。

#### Scenario: root visual hierarchy is distinguishable
- **WHEN** 用户查看右侧文件树顶部区域
- **THEN** 工作区根节点 MUST 在字号、字重、间距、图标强度中至少一项与普通目录形成稳定差异
- **AND** 该差异 MUST 在主题切换与刷新后保持一致

#### Scenario: root row operation anchors remain aligned
- **WHEN** 根节点行展示右侧操作入口（如刷新、新建或更多操作）
- **THEN** 操作入口 MUST 与现有文件树头部视觉基线对齐
- **AND** MUST NOT 遮挡根节点文本、折叠箭头或影响点击命中区

### Requirement: 顶部工具行布局必须容纳搜索框与操作区
系统 MUST 在文件树顶部工具行中同时容纳搜索输入框、文件计数与右侧操作按钮，保持可读与可点击性。

#### Scenario: top row composition remains readable
- **WHEN** 顶部工具行渲染根节点标题、搜索框、文件计数与操作按钮
- **THEN** 各元素 MUST 保持可见且层级清晰
- **AND** MUST NOT 出现元素互相遮挡或文本裁剪

#### Scenario: narrow width fallback remains usable
- **WHEN** 文件树容器处于常见窄宽度（如截图布局）
- **THEN** 搜索框输入与 placeholder MUST 保持可读可输入
- **AND** 右侧计数与按钮 MUST 保持可点击

### Requirement: 根节点顶部区吸顶层级必须稳定
系统 MUST 保证根节点顶部区在文件树滚动时保持吸顶固定，并维持稳定层级与可交互性。

#### Scenario: sticky top zone remains pinned
- **WHEN** 用户滚动文件列表
- **THEN** 根节点顶部区 MUST 固定在文件树视口顶部
- **AND** 文件内容 MUST 在其下方滚动而非推动顶部区离开视口

#### Scenario: sticky top zone does not lose hit targets
- **WHEN** 滚动过程中内容经过顶部区下方
- **THEN** 顶部区按钮与菜单触发区域 MUST 保持可点击
- **AND** MUST NOT 出现点击穿透或层级被覆盖
