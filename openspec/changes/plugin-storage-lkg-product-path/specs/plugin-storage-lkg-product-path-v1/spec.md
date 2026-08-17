# plugin-storage-lkg-product-path-v1 Spec Delta

## ADDED Requirements

### Requirement: Product boot MUST use a durable storage root for LKG

产品 setup 构造 BootHost 时 MUST 把 storage root 设为 `app_home_dir()`（`~/.ccgui`），使 `{root}/plugin-lock.json` 与 `{root}/plugin-runtime/` 跨进程存活。测试用 `boot_host()` MUST 仍使用 ephemeral temp，避免污染用户目录。

#### Scenario: product boot pins land under app home

- **WHEN** setup 以 `app_home_dir()` 调用 `boot_host_at`
- **THEN** `LkgLedger` 路径 MUST 为 `{app_home}/plugin-lock.json`
- **AND** DiskStorage data MUST 落在 `{app_home}/plugin-runtime/data/`

#### Scenario: test boot_host stays ephemeral

- **WHEN** 测试调用 `boot_host()`
- **THEN** storage root MUST 不是 `app_home_dir()`
- **AND** 不得在 `~/.ccgui/plugin-lock.json` 写入测试 pin

### Requirement: Each allowlisted plugin MUST have its own LKG pin after successful install

`install_notes` / `install_claude` / `install_project_map` 在 slot Ready 之后 MUST 调用 `establish_own_lkg`。`plugin-lock.json` MUST 按 `pluginId` 分条，一根插头的 pin MUST NOT 覆盖另一根。

#### Scenario: three plugs pin independently

- **WHEN** 同一 runtime 依次安装 Notes、Claude、Project Map
- **THEN** `plugin-lock.json` MUST 含三条 pin
- **AND** 每条 `pluginId` MUST 分别是 `com.mossx.notes`、`com.mossx.engine.claude`、`com.mossx.project-map`

#### Scenario: first install writes pin without touching product lockfile

- **WHEN** Notes 首次 install 成功
- **THEN** `{root}/plugin-lock.json` MUST 含 Notes pin
- **AND** `{root}/plugin-lockfile.json` MUST 不因 LKG 写入而创建

### Requirement: Restore MUST heal an unhealthy store from that plugin's pin

`establish_own_lkg` 发现已有 pin 且 store 不健康（缺文件、不可读、或 `schema_version != pin.schemaVersion`）时 MUST 从 pin 的 checkpoint 文件 `restore_pinned`。不得因内存 namespace 为空而把盘上 schema 覆盖成 1。

#### Scenario: mutated schema rolls back to pin

- **WHEN** Notes 已有 LKG pin（schema 1）
- **AND** 当前 store schema 被改成 2
- **AND** 再次 `establish_own_lkg` 或产品 `install_notes`
- **THEN** store schema MUST 回到 1
- **AND** pin MUST 仍是原来的 pin

#### Scenario: new runtime on same root reloads pins

- **WHEN** 第一次 runtime 已为三根插头 pin
- **AND** 销毁后在同一 root 构造新 `PluginRuntime`
- **THEN** `lkg.pin(pluginId)` MUST 仍能读到各自 pin

### Requirement: Uninstall MUST keep LKG pin and store

uninstall 是 Disable-not-delete。MUST NOT 删除该 `pluginId` 的 pin，MUST NOT 删除 sqlite 或 LKG checkpoint。

#### Scenario: uninstall keeps notes pin and sqlite

- **WHEN** Notes 已 install 并已 pin
- **AND** 执行 `uninstall_notes`
- **THEN** `lkg.pin("com.mossx.notes")` MUST 仍存在
- **AND** Notes sqlite MUST 仍存在

### Requirement: Claude LKG health MUST stay bookkeeping-honest

Claude 的 LKG store MUST 只是 bookkeeping sqlite（slot Ready 后的隔离 namespace）。MUST NOT 把 Claude 会话 JSONL / CLI transcript 写成 schema-migrate 产品库，也 MUST NOT 宣称 Claude 拥有与 Notes 相同的业务 schema 健康定义。

#### Scenario: claude pin uses bookkeeping store

- **WHEN** Claude install 成功
- **THEN** pin MUST 写入 `com.mossx.engine.claude`
- **AND** data 文件 MUST 是 `{root}/plugin-runtime/data/com.mossx.engine.claude/store.sqlite`
- **AND** 该文件 MUST NOT 位于产品 Claude 会话目录
