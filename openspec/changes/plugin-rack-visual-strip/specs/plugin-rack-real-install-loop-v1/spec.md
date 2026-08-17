## MODIFIED Requirements

### Requirement: Rack UI MUST offer install and uninstall only on Notes

插排 MUST 给 `com.mossx.notes`、`com.mossx.engine.claude` 与 `com.mossx.project-map` 提供安装或卸载按钮，且按钮 MUST 调用产品 `install_plugin` / `uninstall_plugin`。按钮 MUST 出现在可视化插排的可插拔插座上，MUST NOT 再依赖设置卡片作为唯一载体。其余已声明插头 MUST 保持无安装/卸载按钮。远程 Marketplace MUST 保持关闭文案。

#### Scenario: only Notes has writable actions

- **WHEN** 渲染插排快照
- **THEN** Notes、Claude 与 Project Map 插座 MUST 各有安装或卸载 button
- **AND** later-plugin 插座 MUST 没有安装或卸载 button
