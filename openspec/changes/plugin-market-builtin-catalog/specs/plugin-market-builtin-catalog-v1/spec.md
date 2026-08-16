# plugin-market-builtin-catalog-v1 Spec Delta

## ADDED Requirements

### Requirement: Market MUST list built-in plugins grouped by kind

侧栏「插件市场」打开的 surface MUST 列出全部内置插件，按 `engine / feature` 分组展示，组标题 MUST 带数量计数。每个插件卡片 MUST 展示 displayName、中文描述、pluginId、ownerClass 徽章、安装状态、版本与权限预览。

#### Scenario: Market opens and lists built-in plugins

- **WHEN** 用户点击侧栏「插件市场」
- **THEN** `appMode` MUST 为 `market`
- **AND** 页面 MUST 展示引擎 / 功能两个分组
- **AND** 每张卡片 MUST 显示插件用途描述，而非只有裸 pluginId

### Requirement: Built-in plugins MUST support install and uninstall

市场页 MUST 为每个内置插件提供「安装 / 卸载」按钮。点击安装 MUST 写入本地 lockfile（`ccgui.pluginLocalStage.v1`）并即时刷新状态；已安装插件 MUST 显示「卸载」按钮，点击卸载 MUST 清除 lockfile 记录，同一卡片 MUST 恢复「安装」按钮可重新安装。

#### Scenario: Install then uninstall then reinstall

- **WHEN** 用户点击某内置插件的「安装」
- **THEN** 卡片状态 MUST 变为「已安装」，按钮 MUST 变为「卸载」，版本 MUST 显示 lockfile 版本
- **WHEN** 用户点击「卸载」
- **THEN** 卡片状态 MUST 变为「未安装」，按钮 MUST 恢复「安装」
- **WHEN** 用户再次点击「安装」
- **THEN** 卡片 MUST 重新变为「已安装」

### Requirement: Market copy MUST use unified i18n terminology

`extensions.rack.*` 文案 MUST 使用「插件市场 / 内置插件 / 安装 / 卸载」统一术语，MUST NOT 出现「本地过渡仓 / Host 插排 / 市场关闭」等旧术语。全部支持语言（zh/en/fr/es/ja/ko/pt-BR/ru/hi/zh-TW）MUST 提供 `extensions.rack` 段，MUST NOT 因缺 key 显示原始 key 字符串。

#### Scenario: All locales render market copy

- **WHEN** 应用语言切换为任意支持语言并打开插件市场
- **THEN** 页面 MUST 显示该语言的标题 / 副标题 / 按钮文案
- **AND** MUST NOT 渲染 `extensions.rack.*` 原始 key

## MODIFIED Requirements

### Requirement: plugin rack MUST live on Market, sibling of Extensions

原 `plugin-rack-market-sibling-v1` 要求「只读插排、MUST NOT 安装、MUST NOT 出现安装按钮」。本 change 将市场 surface 从只读插排升级为可安装的内置插件目录。

#### Scenario: Market button opens the built-in catalog

- **WHEN** 用户点击侧栏「插件市场」
- **THEN** `appMode` MUST 为 `market`
- **AND** 页面 MUST 展示内置插件目录（含安装 / 卸载按钮）

#### Scenario: Install does not activate the Host runtime

- **WHEN** 用户安装某内置插件
- **THEN** 本地 lockfile MUST 记录该插件
- **AND** Host 运行时 MUST 保持未激活（仅过渡仓语义）
- **AND** 远程 Marketplace MUST 仍不拉取 / 不上架

### Requirement: Power strip MUST be off by default and reflect the backend

市场页 MUST 提供「插排总闸」开关。客户端启动后插排 MUST 默认关闭（`HostConfig::default().enabled == false`），页面 MUST 真实反映后端 `hostEnabled`；插排关闭时所有插头的安装按钮 MUST 禁用并提示先开总闸。开关 MUST 调用后端 `set_plugin_rack_host_enabled`，MUST NOT 仅本地伪造状态。

#### Scenario: Market opens with the power strip off

- **WHEN** 用户打开插件市场
- **THEN** 总闸 MUST 显示关闭
- **AND** 所有插头按钮 MUST 禁用
- **AND** 页面 MUST 提示先打开插排

### Requirement: Install / uninstall MUST drive the real backend with progress feedback

点击「安装 / 卸载」MUST 调用后端 `activate_plugin` / `deactivate_plugin`，MUST NOT 仅写 localStorage。操作期间按钮 MUST 显示进行中状态（禁用 + busy 文案），完成后 MUST 显示成功提示并按后端快照刷新插头状态；失败 MUST 显示错误提示且状态不得伪造为已通电。仅有真实 activation entry 的试点插件（如 claude / notes）MUST 可通电；其余插件 MUST 返回明确错误而非假装安装成功。

#### Scenario: Turn on, install, uninstall through the backend

- **WHEN** 用户打开插排总闸
- **THEN** 总闸状态 MUST 变为已通电，按钮可用
- **WHEN** 用户点击某插头的「安装」
- **THEN** 按钮 MUST 进入处理中状态
- **AND** 成功时 MUST 显示成功提示且插头按后端快照变为已通电
- **WHEN** 用户点击「卸载」
- **THEN** 按钮 MUST 再次进入处理中状态
- **AND** 插头按后端快照变回未通电

#### Scenario: Activating a plug without a real entry fails honestly

- **WHEN** 用户对无 activation entry 的插件点击「安装」
- **THEN** MUST 显示后端错误（如 `no-activation-entry`）
- **AND** 插头 MUST NOT 显示为已通电
