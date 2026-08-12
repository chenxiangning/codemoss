# browser-dock-island-chrome

## ADDED Requirements

### Requirement: 默认态 MUST 渲染为悬浮岛

App 内 BrowserDock 与注入窗口工具条在默认（展开）态 MUST 渲染为居中悬浮胶囊岛，岛内容纳该表面的全部既有控件。

- App 内岛 MUST 包含：状态点、标签 pills（含单标签关闭）、新建标签、URL 输入、打开、状态徽标、关闭当前会话、info 气泡入口、坍缩键
- 注入工具条岛 MUST 包含：状态点、标签 pills、新建标签、状态徽标、URL 输入、打开、选择元素、关联浏览器上下文、关闭、坍缩键
- 任何既有功能按钮 MUST NOT 因布局改造被移除

#### Scenario: 展开态控件完整

- **WHEN** 浏览器 Dock 或浏览器窗口以默认态展示
- **THEN** 上述全部控件 MUST 在岛内可见且可交互
- **AND** 各控件触发的行为 MUST 与改造前一致（相同 bridge action / Tauri 命令）

### Requirement: 坍缩态 MUST 为底部 Powerline 状态条

激活坍缩键后，悬浮岛 MUST 收起为一条位于容器**底部**的 Powerline 斜切分段状态条，包含状态段（连接状态）、页面/域名段、workspace 标识与展开入口；点击状态条 MUST 恢复悬浮岛。

#### Scenario: 坍缩到底部并可恢复

- **WHEN** 用户点击岛内坍缩键
- **THEN** 岛 MUST 消失，底部 MUST 出现 Powerline 状态条
- **AND** 点击状态条任意位置 MUST 恢复悬浮岛

#### Scenario: 注入工具条坍缩不遮挡页面顶部

- **WHEN** 注入窗口工具条进入坍缩态
- **THEN** 页面 body 的顶部补偿 padding MUST 还原为原始值
- **AND** 底部 MUST 叠加 30px 补偿 padding

### Requirement: 页面偏移 MUST 随形变正确切换

注入工具条对宿主页面的布局补偿 MUST 跟随形态：展开态顶部 64px，坍缩态底部 30px；页面原始 padding MUST 被保存并在形变时先还原再叠加，MUST NOT 重复累加。

#### Scenario: 多次形变后 padding 不漂移

- **WHEN** 用户在展开/坍缩间反复切换
- **THEN** body 的 padding-top 与 padding-bottom MUST 始终等于「原始值 + 当前形态补偿」
- **AND** MUST NOT 出现补偿随切换次数增长

### Requirement: 注入工具条形变状态 SHOULD 持久化

注入窗口工具条的坍缩状态 SHOULD 经 localStorage 按 origin 记忆；当存储不可用（禁用/异常）时 MUST 静默退化为默认展开态，MUST NOT 阻断工具条渲染。

#### Scenario: 存储不可用时降级

- **WHEN** 宿主页面禁用 localStorage
- **THEN** 工具条 MUST 正常渲染并默认展开
- **AND** 坍缩/展开在当前页面内 MUST 仍可用

### Requirement: 形变交互 MUST 提供 i18n 文案

坍缩/展开控件 MUST 使用 i18n 文案：App 内经 `browserAgent.dock.collapseDock` / `expandDock`（覆盖全部已注册 WebView locale），注入工具条经 labels `collapse` / `expand`（zh/en）。

#### Scenario: 中文环境显示中文文案

- **WHEN** 界面语言为中文
- **THEN** 坍缩键与恢复条的辅助文案 MUST 为中文
