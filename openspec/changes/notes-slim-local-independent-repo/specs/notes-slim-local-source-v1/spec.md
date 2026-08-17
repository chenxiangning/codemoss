# notes-slim-local-source-v1

Notes 完全体 base：独立仓 + 本地路径安装 + artifact Slim。

## ADDED Requirements

### Requirement: Independent Notes plugin repository exists on local disk

系统 SHALL 在 mossx monorepo 之外提供一份真实的 Notes 插件项目，`pluginId` 为 `com.mossx.notes`，并包含 `07` 推荐结构：`.mossx-plugin/plugin.json`、`src/runtime`、`src/ui`、`dist`、`migrations`、`tests/contract`、`package.json`、`README.md`、`CHANGELOG.md`、`SECURITY.md`、`LICENSE`。

#### Scenario: Repository is a real plugin project

- **WHEN** 打开本地独立仓根目录
- **THEN** 存在 `.mossx-plugin/plugin.json` 且 `pluginId` 等于 `com.mossx.notes`
- **AND** 存在 `src/runtime`、`src/ui`、`dist/worker.js`、`dist/ui/notes.js`、`migrations`、`tests/contract`

### Requirement: Install from local path stages the repository into product plugin location

产品 SHALL 提供 `install_plugin_from_path({ pluginId, sourcePath })`。对 `com.mossx.notes`，系统 MUST 发现 manifest、校验 pluginId、把仓库拷到 `{storage_root}/plugin-runtime/plugins/com.mossx.notes/`，然后从 staged manifest 激活、pin LKG、注册 contributions、写入 lockfile Installed。

#### Scenario: User picks the independent Notes repo

- **WHEN** 调用 `install_plugin_from_path` 且 `pluginId` 为 `com.mossx.notes`，`sourcePath` 指向含有效 Notes manifest 的目录
- **THEN** `{storage_root}/plugin-runtime/plugins/com.mossx.notes/` 含 staged 树与 `.mossx-install.json`
- **AND** Host slot 为 Ready，lockfile desiredState 为 Installed，LKG pin 存在

#### Scenario: Wrong pluginId is rejected

- **WHEN** 所选目录 manifest 的 `pluginId` 不是 `com.mossx.notes`
- **THEN** 安装失败，错误码为 `plugin-id-mismatch`
- **AND** 不覆盖已有 staged Notes 树

#### Scenario: Missing manifest is rejected

- **WHEN** 所选目录找不到 `.mossx-plugin/plugin.json`、`plugin.json` 或 `manifest.json`
- **THEN** 安装失败，错误码为 `missing-manifest`

#### Scenario: Claude and Project Map cannot install from path

- **WHEN** `pluginId` 不是 `com.mossx.notes`
- **THEN** 返回 `local-source-unsupported` 或 `not-allowlisted`

### Requirement: One-click install prefers staged artifact

`install_notes` SHALL 在 staged 目录已有有效 Notes manifest 时从 staged 激活；否则继续使用 compile-time fixture，保证既有测试绿。

#### Scenario: Reinstall after uninstall does not require re-picking

- **WHEN** Notes 已从本地仓 staged 过，随后卸载
- **THEN** staged 树与 pin、sqlite 仍在
- **AND** 再次一键 Install 从 staged manifest 激活，不必重选路径

### Requirement: Marketplace can choose a local repository

桌面端 Notes 未安装 listing SHALL 提供「从本地仓库安装」入口，使用已有 folder picker。浏览器预览 MUST NOT 显示该入口。

#### Scenario: Desktop Notes card exposes folder install

- **WHEN** 运行桌面端且 Notes desiredState 为 uninstalled
- **THEN** listing 同时提供一键 Install 与从本地仓库安装
- **AND** 选择目录后调用 `install_plugin_from_path`

#### Scenario: Browser preview keeps one-click only

- **WHEN** 浏览器预览渲染 Notes 未安装 listing
- **THEN** 只显示一键 Install，不调用真实拷贝

### Requirement: Slim moves artifact ownership off Core

`packages/plugin-notes` SHALL 降为 pointer / re-export，不再宣称自己是 artifact owner。Core `note_cards.rs` 与 Trusted React UI MAY 继续编译。仪表盘 MUST 把 Notes 记为协议 9/9（artifact Slim），并写明 IPC/UI 仍在 Core。

#### Scenario: Transitional package points at independent repo

- **WHEN** 阅读 `packages/plugin-notes/README.md`
- **THEN** 它声明独立仓才是 artifact owner
- **AND** 不声称 in-repo 包会被 boot 安装
