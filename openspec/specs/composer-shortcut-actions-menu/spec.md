# composer-shortcut-actions-menu Specification

## Purpose

定义 Composer 快捷动作入口与菜单交互契约，保证常用触发符插入、菜单可访问性与焦点管理稳定可预测。

## Requirements

### Requirement: Composer MUST Provide Dedicated Shortcut Actions Entry

输入区 MUST 提供独立“快捷动作”入口，以菜单方式触发常用输入动作。

#### Scenario: shortcut entry is visible when actions are available

- **WHEN** ChatInputBox 存在可用快捷动作
- **THEN** 系统 MUST 渲染独立快捷动作图标入口
- **AND** 入口 MUST 暴露可访问名称

#### Scenario: shortcut action inserts trigger text deterministically

- **WHEN** 用户点击任意快捷动作项（如 `@`, `@@`, `/`, `$`, `#`, `!`）
- **THEN** 系统 MUST 将对应触发符插入输入框
- **AND** MUST 保持已有输入内容与光标位置语义可恢复

### Requirement: Shortcut Actions Menu MUST Be Keyboard Accessible

快捷动作菜单 MUST 支持键盘导航与焦点回收。

#### Scenario: menu supports arrow/home/end traversal

- **WHEN** 用户在菜单中使用 `ArrowUp/ArrowDown/Home/End`
- **THEN** 焦点 MUST 在菜单项之间按预期移动
- **AND** 焦点顺序 MUST 循环或可预测

#### Scenario: escape closes menu and returns focus to trigger

- **WHEN** 用户按下 `Escape`
- **THEN** 菜单 MUST 关闭
- **AND** 焦点 MUST 返回快捷动作触发按钮

#### Scenario: outside click closes opened menu

- **WHEN** 菜单打开后用户点击组件外区域
- **THEN** 菜单 MUST 关闭
- **AND** 不得遗留悬空菜单状态
