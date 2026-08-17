# plugin-rack-real-install-loop-v1 Spec Delta

## MODIFIED Requirements

### Requirement: Product MUST expose Notes-only install and uninstall commands

`command_registry` MUST 注册 `install_plugin` 与 `uninstall_plugin`。两命令 MUST 只接受 `com.mossx.notes` 与 `com.mossx.engine.claude`。其它 `pluginId` MUST 返回 allowlist 错误。registry MUST NOT 注册 `activate_plugin`。registry MUST NOT 出现 Marketplace catalog 安装命令。

#### Scenario: Notes is the only allowlisted plug

- **WHEN** 调用 `install_plugin("com.mossx.notes")` 或 `install_plugin("com.mossx.engine.claude")`
- **THEN** 命令 MUST 被 registry 暴露且 allowlist 接受该 id
- **AND** 调用 `install_plugin("com.mossx.project-map")` MUST 被拒绝

#### Scenario: registry still refuses generic Host activate

- **WHEN** 读取 `command_registry.rs`
- **THEN** 源码 MUST 包含 `install_plugin` 与 `uninstall_plugin`
- **AND** 源码 MUST NOT 包含 `activate_plugin`

### Requirement: Rack UI MUST offer install and uninstall only on Notes

插排 MUST 给 `com.mossx.notes` 与 `com.mossx.engine.claude` 提供安装或卸载按钮，且按钮 MUST 调用产品 `install_plugin` / `uninstall_plugin`。其余已声明插头 MUST 保持无安装/卸载按钮。远程 Marketplace MUST 保持关闭文案。

#### Scenario: only Notes has writable actions

- **WHEN** 渲染插排快照
- **THEN** Notes 与 Claude 卡片 MUST 各有安装或卸载 button
- **AND** later-plugin 卡片 MUST 没有安装或卸载 button

### Requirement: Boot restore MUST honor the lockfile without enabling the whole Host

产品 setup MUST 按 lockfile 恢复 Notes 与 Claude：`installed` 则 allowlisted activate + 注册 contribution；`uninstalled` 则 slot 保持/标为 `Uninstalled` 且 contribution 为空。`boot_host()` 构造函数本身 MUST NOT 激活任何插头。later-plugin MUST 保持未激活。

#### Scenario: restore installed Notes and leave others idle

- **WHEN** lockfile 中 Notes 与 Claude 为 `installed`
- **AND** 调用产品 restore
- **THEN** Notes slot MUST 为 `Ready`
- **AND** Claude slot MUST 为 `Ready`
- **AND** later-plugin slot MUST 仍不存在或非 Ready
- **AND** `Host::activate` 对非 allowlisted 调用 MUST 仍失败
