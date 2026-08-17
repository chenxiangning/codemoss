# Design: notes-slim-local-independent-repo

## Context

Notes 插头已有产品装/卸 + LKG pin，但安装走 compile-time fixture，不拷文件。`packages/plugin-notes` 是 monorepo 过渡 re-export。最后一公里要证明：独立仓存在、市场能选它、产品把树拷到 `{app_home}/plugin-runtime/plugins/com.mossx.notes/`、激活读 staged manifest。

0.8.9 不能删 `note_cards.rs` 或 Trusted React UI：`#[tauri::command]` 仍必须在 Core 编译。诚实 Slim = artifact/manifest 所有权离开 Core，不是删 IPC。

## Goals / Non-Goals

**Goals**

- 本地真实插件仓，结构对齐 `07`。
- `install_plugin_from_path` 只接受 Notes；校验 pluginId；stage 拷贝；从 staged manifest 激活。
- 市场 Notes 未安装且桌面端显示「从本地仓库安装」。
- 一键 Install：已有 staged 有效 manifest 则用 staged，否则 fixture。
- 卸载保留 staged artifact（Disable-not-delete）。
- Slim pointer：`packages/plugin-notes` 不再自称 owner。

**Non-Goals**

- Slim Claude / Map。
- 删 Core IPC / UI。
- QuickJS eval 磁盘 `dist/worker.js`。
- 远程 Registry / 签名。
- 产品代码硬编码本机路径。

## Decisions

1. **Stage 位置**：`{storage_root}/plugin-runtime/plugins/{pluginId}/`。与 data/checkpoints 同根，产品即 `app_home_dir()`。
2. **Manifest 发现**：`.mossx-plugin/plugin.json` → `plugin.json` → `manifest.json`。拷贝根是 `.mossx-plugin` 的父目录或 manifest 所在目录。
3. **拷贝过滤**：跳过 `.git` / `node_modules` / `target` / `.DS_Store`。覆盖重装先清目标再拷。写入 `.mossx-install.json` provenance。
4. **from-path 范围**：仅 `com.mossx.notes`。其他 allowlist 返回 `local-source-unsupported`。
5. **激活**：`notes_activation_from_value` 从 staged JSON 抽 `pluginId` / unit / entries，再走现有 `install_allowlisted`。Host 仍不 eval worker 文件。
6. **市场 CTA**：桌面端 Notes 未安装时多一个 secondary 按钮。浏览器预览不显示，避免破坏 3-button 测试，也符合 picker 只在 Tauri。
7. **独立仓位置**：本机 `/Users/chenxiangning/code/AI/github/mossx-plugin-notes`，独立 git，不入库 mossx。
8. **Slim 口径**：artifact owner = 独立仓；Core 仍编译 IPC/UI。P8 不全绿。

## Risks / Trade-offs

- Host 不加载磁盘 worker → 链路证明的是 **stage + manifest 所有权**，不是沙箱执行。必须写进仪表盘，禁止把 P3/P8 勾满。
- 用户选错目录 → 明确 `missing-manifest` / `plugin-id-mismatch`。
- 覆盖拷贝可能慢 → Notes 仓很小，可接受。

## Migration Plan

1. 建独立仓 + OpenSpec artifacts。
2. `local_source` + from-path install + Tauri/frontend。
3. Slim pointer + dashboard。
4. 测试：stage、from-path、拒绝错误 id、fixture 仍绿、市场按钮。

回滚：去掉 from-path command 与按钮，一键 Install 仍走 fixture。独立仓可留在磁盘。
