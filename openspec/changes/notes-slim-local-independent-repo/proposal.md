# Proposal: notes-slim-local-independent-repo

> OpenSpec change id: `notes-slim-local-independent-repo`
> 目标：Notes 完全体 base（第 8 步 Slim + 第 9 步独立仓）
> 依赖：marketplace 一键装/卸、LKG 产品路径、Notes allowlisted install
> 架构：[`07`](../../../docs/architecture/plugin-platform/07-repository-distribution-marketplace.md)、[`14`](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)

## Why

Notes 插头目前停在第 7 步 Disable-not-delete：市场一键装/卸走 in-memory fixture，`packages/plugin-notes` 仍是 monorepo 过渡包，产品路径从不拷文件。代码还在主仓 ≠ 假卸载，但 **artifact 所有权没离开 Core**，最后一公里是不是死胡同现在定不了。必须拿 Notes 走完 Slim + 本地独立仓，证明「选仓库 → 拷到产品位置 → 激活 → 卸后保留 staged artifact → 再装不必重选」这条完整链路，才有靠谱 base。

## What Changes

- 在本地磁盘创建真实 Notes 插件仓 `mossx-plugin-notes`（`.mossx-plugin/plugin.json` + src/runtime + src/ui + dist + migrations + tests/contract）。
- 新增 `install_plugin_from_path`：只允许 `com.mossx.notes`；校验 manifest；把仓库拷到 `{app_home}/plugin-runtime/plugins/com.mossx.notes/`；从 staged manifest 激活并 pin LKG。
- 市场 Notes 未安装卡片增加「从本地仓库安装」，走已有 folder picker。
- 一键 Install 若已有 staged 有效 manifest，优先 staged；否则仍走 fixture（现有测试不破）。
- Slim：`packages/plugin-notes` 降为 pointer，不再当 artifact owner。
- **不 BREAKING**：Claude / Project Map 仍停在第 7 步；不删 `note_cards.rs` / Trusted React UI。

## 目标与边界

1. 至少 1 条完整链路可演示：独立仓 → 选择路径 → 拷到产品位置 → Ready + LKG + lockfile。
2. Slim 的诚实口径：artifact/manifest 所有权离开 Core；`#[tauri::command]` 与 Trusted React UI 仍编译在 Core。
3. 产品代码禁止硬编码本机路径 `/Users/chenxiangning/...`。
4. 卸载保持 Disable-not-delete：pin + data + staged artifact 都留。

## 非目标

- 不 Slim Claude / Project Map。
- 不打开远程 Registry / 签名 / 12 插头写盘。
- 不删 `src-tauri/src/note_cards.rs` 或 `src/features/note-cards`。
- 不让 QuickJS 真 eval 磁盘 `dist/worker.js`（本轮只证 stage + activate from staged manifest）。
- 不改 Host default-off 产品策略（allowlisted activate 已旁路）。

## 技术方案对比

| 选项 | 做法 | 取舍 |
|------|------|------|
| A. 独立仓 + from-path stage | 本地真实仓，市场选文件夹，拷到 `plugin-runtime/plugins/{id}/` | 能证最后一公里；路径不进产品代码 |
| B. 继续 monorepo 过渡包 + 假装 Slim | 只改 README / 仪表盘数字 | 定不了死胡同，否决 |
| C. 真删 Core IPC/UI | 删 `note_cards.rs` 与 Trusted React | 0.8.9 会断 IPC/bundle，本轮否决 |

选择 A。

## Capabilities

### New Capabilities

- `notes-slim-local-source-v1`：本地独立仓结构、stage 拷贝、from-path 安装、Slim 所有权口径

### Modified Capabilities

- （无 main spec 行为变更需 delta；本轮 capability 新立）

## Impact

- Backend：`plugin_runtime/local_source.rs`、`install.rs`、`notes_pilot.rs`、`plugin_rack.rs`、`command_registry.rs`
- Frontend：`pluginRack.ts`、`PluginMarketplaceCatalog.tsx` / `PluginRackSection.tsx`、en/zh `sidebar.ts`
- 仓外：`/Users/chenxiangning/code/AI/github/mossx-plugin-notes`（独立 git，不入库 mossx）
- Slim pointer：`packages/plugin-notes/README.md`
- 文档：`docs/architecture/plugin-platform/16-progress-dashboard.md`

## 验收标准

1. 独立仓具备 07 推荐结构，且 `pluginId=com.mossx.notes`。
2. 市场可选该仓；拷贝落在 `{app_home}/plugin-runtime/plugins/com.mossx.notes/`。
3. 从 staged manifest 激活后 Ready + LKG pin + lockfile Installed。
4. 卸载不断 staged artifact；再装不必重选路径。
5. 错误 pluginId / 缺 manifest 被拒绝。
6. 现有 fixture `install_notes` 测试仍绿。
7. Claude / Map 无 Slim。
