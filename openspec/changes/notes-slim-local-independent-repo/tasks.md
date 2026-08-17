# Tasks: notes-slim-local-independent-repo

## 1. Independent repo

- [x] 1.1 在 `/Users/chenxiangning/code/AI/github/mossx-plugin-notes` 落地 07 结构与 `pluginId=com.mossx.notes`
- [x] 1.2 `git init` 并做初始提交；不入库 mossx

## 2. Local source + install

- [x] 2.1 新增 `plugin_runtime/local_source.rs`：发现 manifest、拷贝、provenance、staged 路径
- [x] 2.2 `notes_pilot` 抽出 `notes_activation_from_value`；支持从 staged 根构造 request
- [x] 2.3 `install_notes` 优先 staged；新增 `install_notes_from_path` / `install_plugin_from_path`
- [x] 2.4 注册 Tauri `install_plugin_from_path`；更新 command_registry 断言

## 3. Marketplace

- [x] 3.1 `installPluginFromPath`；浏览器预览拒绝
- [x] 3.2 Notes 未安装 + 桌面端显示「从本地仓库安装」
- [x] 3.3 en/zh i18n；更新 rack 测试

## 4. Slim + docs

- [x] 4.1 `packages/plugin-notes` README 改为 pointer
- [x] 4.2 刷新 `16-progress-dashboard.md`：Notes 9/9 caveat

## 5. Verify

- [x] 5.1 Rust：stage 成功、错 id、缺 manifest、fixture 仍绿、卸后 staged 保留
- [x] 5.2 Frontend：预览按钮数不变；桌面端 Notes 多按钮
- [x] 5.3 `openspec status` 可 apply
