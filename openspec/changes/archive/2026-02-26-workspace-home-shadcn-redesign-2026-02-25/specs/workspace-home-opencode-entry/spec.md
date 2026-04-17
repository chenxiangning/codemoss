# workspace-home-opencode-entry Specification Delta

## MODIFIED Requirements

### Requirement: 首页引擎下拉必须开放 OpenCode 入口

Workspace Home 的引擎选择器 MUST 将 OpenCode 作为可用选项展示，不得以“即将支持”禁用，并且在新首页 Hero 区 MUST 保持首屏可发现。

#### Scenario: render engine selector

- **GIVEN** 用户进入 Workspace Home
- **WHEN** 引擎下拉渲染
- **THEN** OpenCode MUST 可被选择
- **AND** OpenCode 选项 MUST NOT 带禁用态文案
- **AND** 引擎选择控件 MUST 位于首页主操作上下文区域内

### Requirement: OpenCode 新建会话必须连通既有聊天链路

用户从 Workspace Home 选择 OpenCode 后新建会话时，系统 MUST 走现有 OpenCode chat 启动流程，并在新首页重构后保持调用参数语义不变。

#### Scenario: start new opencode conversation from home

- **GIVEN** 用户在首页将引擎选为 OpenCode
- **WHEN** 点击“新建会话”
- **THEN** 系统 MUST 使用 `engine=opencode` 启动会话
- **AND** 会话 MUST 出现在最近会话列表中
- **AND** 会话启动参数契约 MUST 与重构前保持兼容
