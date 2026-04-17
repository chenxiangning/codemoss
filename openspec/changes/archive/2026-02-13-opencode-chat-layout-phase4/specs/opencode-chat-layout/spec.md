## ADDED Requirements

### Requirement: OpenCode Chat Layout Prioritizes Conversation Flow
系统 MUST 在 OpenCode 模式下将主聊天区设为最高优先级布局层，配置操作不得持续占用主视图区。

#### Scenario: keep chat area primary
- **WHEN** 用户进入 OpenCode 模式并进行连续对话
- **THEN** 界面 MUST 保持消息区与输入区稳定可见
- **AND** 详细配置项 SHALL 通过按需展开的面板进入

### Requirement: OpenCode Drawer-based Control Surface
系统 MUST 提供 OpenCode 专属抽屉式控制面板，承载 Provider / MCP / Sessions / Advanced。

#### Scenario: open and operate control drawer
- **WHEN** 用户点击“打开面板”
- **THEN** 系统 MUST 展示包含 Provider、MCP、Sessions、Advanced 的抽屉 Tab
- **AND** 抽屉关闭后 MUST 立即回到纯聊天主视图

### Requirement: OpenCode Provider Picker Supports Search and Grouping
系统 MUST 在 OpenCode Provider 选择中支持搜索与 Popular/Other 分组展示。

#### Scenario: select provider from long list
- **WHEN** Provider 列表包含大量选项
- **THEN** 用户 MUST 可通过关键词过滤
- **AND** 系统 MUST 以 Popular/Other 分组呈现

### Requirement: OpenCode Keyboard Layering Is Predictable
系统 SHALL 在 OpenCode 控制层提供一致的键盘关闭与焦点行为。

#### Scenario: close layered overlays with Escape
- **WHEN** Provider 弹窗与抽屉同时存在
- **THEN** 按下 Esc SHALL 先关闭 Provider 弹窗，再关闭抽屉
