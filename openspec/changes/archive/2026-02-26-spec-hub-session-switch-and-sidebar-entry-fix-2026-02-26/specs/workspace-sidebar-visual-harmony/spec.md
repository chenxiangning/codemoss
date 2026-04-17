## ADDED Requirements

### Requirement: Sidebar Rail SHALL Provide Spec Hub Entry at Bottom

系统 SHALL 在左侧侧栏 rail 底部提供 Spec Hub icon 入口，使用户在会话工作流中可直接进入 Spec Hub。

#### Scenario: Bottom rail entry is visible in workspace session view

- **GIVEN** 用户位于任意 workspace 会话视图
- **WHEN** 左侧 rail 渲染完成
- **THEN** rail 底部 SHALL 展示 Spec Hub icon 入口
- **AND** 入口 SHALL 提供可识别 tooltip 或可访问性标签
- **AND** tooltip/可访问性标签文案 SHALL 通过 i18n key 渲染并随 locale 切换

#### Scenario: Open Spec Hub from bottom rail entry

- **GIVEN** 用户位于会话视图
- **WHEN** 用户点击 rail 底部 Spec Hub icon
- **THEN** 系统 SHALL 打开 Spec Hub 视图
- **AND** 欢迎页原有 Spec Hub 入口 SHALL 继续可用
