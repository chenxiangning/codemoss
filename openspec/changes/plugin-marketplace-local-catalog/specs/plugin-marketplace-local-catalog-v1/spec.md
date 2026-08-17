## ADDED Requirements

### Requirement: Market page MUST present a local curated catalog over the rack snapshot

市场页 MUST 同时渲染：插件市场标题、插排状态条、可安装 listing、即将开放 listing。可安装 listing MUST 且仅 MUST 包含 `com.mossx.engine.claude`、`com.mossx.notes`、`com.mossx.project-map`。即将开放 listing MUST 展示其余已声明 later-plugin，MUST NOT 提供安装或卸载 button。

#### Scenario: market page shows catalog and rack together

- **WHEN** 用户打开市场页并读到已声明的 12 根插头快照
- **THEN** 页面 MUST 出现「插件市场」或 `Plugin Market` heading
- **AND** MUST 出现可插拔仓与只读仓
- **AND** MUST 出现可安装 listing region 与即将开放 listing region

#### Scenario: only three listings are actionable

- **WHEN** 三个 allowlisted 插头的 `desiredState` 均为 `installed`
- **THEN** 页面上安装/卸载 button 的总数 MUST 为 3
- **AND** 即将开放 region 内 MUST 没有 role=button 的安装或卸载控件

### Requirement: Marketplace actions MUST use the real rack install loop

可安装 listing 的安装/卸载 MUST 调用产品 `installPlugin` / `uninstallPlugin`。listing 与插排插座 MUST 读同一份 `desiredState`。MUST NOT 用 localStorage 或第二套 catalog 标记伪装安装态。

#### Scenario: uninstalling a listing clears the matching socket

- **WHEN** 用户在 Notes listing 点卸载且命令成功
- **THEN** Notes listing MUST 变为可安装
- **AND** 插排上 Notes 插座 MUST 变为空座

#### Scenario: installing a listing occupies the matching socket

- **WHEN** Notes 的 `desiredState` 为 `uninstalled` 且用户点安装且命令成功
- **THEN** Notes listing MUST 变为已安装
- **AND** 插排上 Notes 插座 MUST 变为已插入

### Requirement: Browser preview MUST stay allowlisted and in-memory

当 `isTauri()` 为 false，`installPlugin` / `uninstallPlugin` MUST 只修改进程内预览快照。预览 MUST 拒绝非 allowlisted pluginId。预览 MUST NOT 写入 `localStorage` 或产品 `plugin-lockfile.json`。

#### Scenario: preview can toggle an allowlisted plug

- **WHEN** 非 Tauri 环境对 `com.mossx.notes` 调用 `uninstallPlugin` 再 `getPluginRackSnapshot`
- **THEN** 返回快照中 Notes 的 `desiredState` MUST 为 `uninstalled`

#### Scenario: preview rejects a sealed plug

- **WHEN** 非 Tauri 环境对 `com.mossx.browser` 调用 `installPlugin`
- **THEN** 调用 MUST 失败
- **AND** 失败原因 MUST 标识 `plugin-not-allowlisted`

### Requirement: Remote Marketplace MUST stay closed

本刀 MUST NOT 开放远程 Registry、签名下载或社区发布。页面 MUST NOT 出现 `Browse Marketplace`。脚注 MUST 说明这是本地 curated 目录，远程市场仍关闭。

#### Scenario: copy does not claim a remote store

- **WHEN** 市场页渲染完成
- **THEN** 页面 MUST NOT 包含 `Browse Marketplace`
- **AND** 页面 MUST 说明远程 Marketplace 仍关闭
