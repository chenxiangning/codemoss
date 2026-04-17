## ADDED Requirements

### Requirement: Main Topbar Composition MUST Reserve Stable Session Tab Zone

系统 MUST 在 desktop workspace chat 的主 topbar 标题区与右侧操作区之间保留稳定会话 tab 区域，并保持既有标题迁移规则不回退。

#### Scenario: sidebar expanded keeps title relocation and tab zone together
- **GIVEN** 用户位于 desktop workspace chat 且侧栏展开
- **WHEN** 主 topbar 渲染完成
- **THEN** 主 topbar MUST 保留会话 tabs 区域
- **AND** 右侧操作区 MUST 保持原有可点击行为

#### Scenario: sidebar collapsed keeps title return and tab zone coexistence
- **GIVEN** 用户位于 desktop workspace chat 且侧栏收起
- **WHEN** 主 topbar 渲染会话 tabs
- **THEN** 标题入口、会话 tabs、右侧操作区 MUST 同时可访问
- **AND** MUST NOT 相互覆盖

#### Scenario: phone and tablet keep existing topbar composition
- **WHEN** 用户位于 phone 或 tablet 布局
- **THEN** 系统 MUST 保持现有移动端顶部导航结构

### Requirement: Topbar Narrow-Width Fallback MUST Preserve Operability

在窄宽度布局下，系统 MUST 维持“active tab 可见 + 核心操作可点”。

#### Scenario: narrow width keeps active tab visible
- **GIVEN** 窗口宽度位于 `800px~1023px`
- **WHEN** topbar 可用宽度下降
- **THEN** active tab MUST 保持可见
- **AND** 非 active tabs MUST 允许收缩截断

#### Scenario: narrow width does not break core action hit targets
- **GIVEN** 窗口宽度位于 `800px~1279px`
- **WHEN** topbar 渲染会话 tabs
- **THEN** 运行控制、终端、solo 等核心按钮 MUST 可点击
- **AND** 核心按钮命中区 MUST NOT 小于 `28x28px`

### Requirement: Topbar Session Tab Group MUST Use Connected Square Buttons Without Outer Border

会话 tab 组 MUST 使用紧密连接的直角按钮风格，且不显示组外边框。

#### Scenario: tab group renders as connected square buttons
- **WHEN** topbar 会话 tabs 渲染
- **THEN** tabs MUST 以连接按钮组呈现（无圆角）
- **AND** tabs 之间 MAY 使用分隔语义

#### Scenario: tab group has no outer border
- **WHEN** topbar 会话 tabs 渲染
- **THEN** tab 组外框 MUST 不显示
- **AND** 不得因外框导致与标题区或操作区视觉冲突

### Requirement: Topbar Session Zone MUST Respect Platform Titlebar Insets

系统 MUST 在 Win/mac 下遵守既有 titlebar inset 与窗口控制区约束。

#### Scenario: macOS left inset contract remains valid
- **WHEN** 系统在 macOS desktop 渲染主 topbar
- **THEN** 会话 tabs 区域 MUST 遵循左侧 inset 规则
- **AND** MUST NOT 侵入 traffic-light 控件保留区

#### Scenario: Windows right controls inset contract remains valid
- **WHEN** 系统在 Windows desktop 渲染主 topbar
- **THEN** 会话 tabs 区域 MUST 为右侧窗口控制区预留空间
- **AND** MUST NOT 遮挡 close/minimize/maximize 控件

