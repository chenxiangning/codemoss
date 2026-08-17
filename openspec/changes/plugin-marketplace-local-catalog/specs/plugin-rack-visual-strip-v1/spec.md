## MODIFIED Requirements

### Requirement: Live bank MUST expose exactly three pluggable sockets

可插拔仓 MUST 且仅 MUST 包含 `com.mossx.engine.claude`、`com.mossx.notes`、`com.mossx.project-map`。每个插座 MUST 根据 `desiredState` 显示插入或空座。安装或卸载 CTA MUST 出现在市场 listing 上，MUST 调用产品 `install_plugin` / `uninstall_plugin`。插座本身 MUST NOT 再渲染安装或卸载 button。页面上安装/卸载 button 的总数 MUST 仍为 3。

#### Scenario: installed live socket can be unplugged

- **WHEN** 三个 allowlisted 插头的 `desiredState` 均为 `installed`
- **THEN** 市场可安装 listing MUST 有 3 个 Uninstall / 卸载 button
- **AND** 每个插座 MUST 呈现已插入态
- **AND** 可插拔仓内 MUST 没有安装或卸载 button

#### Scenario: uninstalled live socket can be plugged

- **WHEN** 某个 allowlisted 插头的 `desiredState` 为 `uninstalled`
- **THEN** 该插座 MUST 呈现空座
- **AND** 对应市场 listing 的 button 文案 MUST 为 Install / 安装
