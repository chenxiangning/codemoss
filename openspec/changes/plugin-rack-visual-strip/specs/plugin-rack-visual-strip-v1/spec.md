## ADDED Requirements

### Requirement: Rack page MUST present a visual power strip not a settings card list

插排页 MUST 渲染一条可视化插排：Host 状态条、可插拔仓、只读仓。一级分区 MUST 是 writable / sealed，MUST NOT 再以 Engines / Features 作为唯一主分组。实现与独立 HTML 原型 MUST 只使用项目 design tokens（`design-tokens.md` / `tokens.css` 已列变量），MUST NOT 自造色值、字号或圆角。

#### Scenario: page shows strip banks instead of kind card groups

- **WHEN** 渲染已声明的 12 根插头快照
- **THEN** 页面 MUST 出现可插拔仓与只读仓两个 region
- **AND** MUST NOT 把 Engines / Features 当作唯一一级 heading 分区

#### Scenario: prototype and product share token-only palette

- **WHEN** 打开 `docs/prototypes/plugin-rack-visual/index.html` 或产品插排页
- **THEN** 颜色、字号、圆角 MUST 来自已列 token
- **AND** 源码 MUST NOT 引入新的 hex / oklch 色值作为插排主题色

### Requirement: Live bank MUST expose exactly three pluggable sockets

可插拔仓 MUST 且仅 MUST 包含 `com.mossx.engine.claude`、`com.mossx.notes`、`com.mossx.project-map`。每个插座 MUST 根据 `desiredState` 显示插入或空座，并提供一个安装或卸载 button。button MUST 调用产品 `install_plugin` / `uninstall_plugin`。页面上安装/卸载 button 的总数 MUST 为 3。

#### Scenario: installed live socket can be unplugged

- **WHEN** 三个 allowlisted 插头的 `desiredState` 均为 `installed`
- **THEN** 可插拔仓 MUST 有 3 个 Uninstall / 卸载 button
- **AND** 每个插座 MUST 呈现已插入态

#### Scenario: uninstalled live socket can be plugged

- **WHEN** 某个 allowlisted 插头的 `desiredState` 为 `uninstalled`
- **THEN** 该插座 MUST 呈现空座
- **AND** 其 button 文案 MUST 为 Install / 安装

### Requirement: Later bank MUST show nine sealed read-only sockets

只读仓 MUST 展示其余已声明 later-plugin（当前 9 根）。每个插座 MUST 可见名称与 pluginId，MUST 呈现封口/只读态，MUST NOT 渲染安装或卸载 button（含 disabled button）。点击封口座 MUST NOT 调用 `install_plugin` / `uninstall_plugin`。

#### Scenario: sealed sockets have no install actions

- **WHEN** 渲染含 Browser / Intent Canvas / Kanban / 其余 CLI 的快照
- **THEN** 只读仓 MUST 显示这些插头
- **AND** 只读仓内 MUST 没有 role=button 的安装或卸载控件

#### Scenario: marketplace stays closed copy

- **WHEN** 插排页渲染完成
- **THEN** 页脚 MUST 保留远程 Marketplace 仍关闭的文案
- **AND** 页面 MUST NOT 出现 Browse Marketplace
