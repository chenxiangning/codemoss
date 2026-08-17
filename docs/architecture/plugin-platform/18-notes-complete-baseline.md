---
type: architecture
status: active
created: 2026-08-18
---

# 18 · Notes 完全体停刀备忘（快速回顾）

> 主线：[Mossx Plugin Platform](README.md)
> 进度尺：[16 · Progress Dashboard](16-progress-dashboard.md)
> 0.9 移植：[17 · 合同移植清单](17-contract-port-to-0.9.md)
> 决策：[09 · Decision Log](09-decision-log.md) **D-056**
> OpenSpec：`openspec/changes/notes-slim-local-independent-repo/`
> 分支：`feature/plugin-mossx-0.8.9`
> 仓外独立仓：`/Users/chenxiangning/code/AI/github/mossx-plugin-notes`（`83be9f6` / `e92534e`）
> 产品代码**禁止**硬编码上面这条本机路径。

回来先读本页。数字和九步细节以 [16](16-progress-dashboard.md) 为准；0.9 怎么重写以 [17](17-contract-port-to-0.9.md) 为准。本页只回答：**停在哪、证了什么、文件在哪、下次别踩什么。**

---

## 0. 30 秒结论

| 问题 | 答案 |
|---|---|
| 插排 100% 了吗？ | **UI 口径是。** live 3 座可插拔 + later 9 座封口。Host 仍 `enabled=false`。 |
| 插头 3 个真实可插拔？ | **是。** Notes / Claude / Project Map。市场一键装/卸写 `~/.ccgui/plugin-lockfile.json`。 |
| Notes Slim + 独立仓做了吗？ | **做了，且桌面已手测通过。** 诚实 Slim = artifact/manifest 所有权离开 Core，**没删** `note_cards.rs`。 |
| 独立仓进 mossx 了吗？ | **没有。** 仓在 mossx **外面**，自己有 git。 |
| 安装是真拷贝吗？ | **是。** 选文件夹 → 拷到 `~/.ccgui/plugin-runtime/plugins/com.mossx.notes/`，写 `.mossx-install.json`。 |
| 卸载删文件了吗？ | **没有。** Disable-not-delete：lockfile 变 `uninstalled`，入口藏掉，staged / pin / sqlite 都留。再装不必重选文件夹。 |
| Claude / Map 也 Slim 了吗？ | **没有。** 仍停在第 7 步 Disable-not-delete。 |
| 0.8.9 还要继续写吗？ | **建议停刀。** 下一刀按 17 在 0.9 重写合同。 |
| 能 merge 进 0.9 吗？ | **不能。** 0.9 已重构 AppShell / `note_cards/`，必须按十流重写。 |

三把尺子（2026-08-18）：**允许线 82% / 终态 22% / 真实卸载 70%。**

```text
允许线 ████████████████░░░░  82%   Notes 9/9 caveat；Claude/Map 7/9
终态   ████░░░░░░░░░░░░░░░░  22%   只证明 1 条本地仓 stage，不是 12 根抽出
卸载   ██████████████░░░░░░  70%   三根能拔；later-plugin 卸不掉
```

---

## 1. 现在停在哪

0.8.9 实验面按锁定验收已经够迁 0.9：

1. 插排可视化 3 真 / 9 封口
2. 本地市场 3 listing 真装真卸
3. 卸后藏入口 / 面板；Claude 先确认再 interrupt
4. 三根各自产品 LKG（`plugin-lock.json`）
5. **Notes 完全体 last-mile**：本地独立仓 → 选文件夹 → stage → 从 staged manifest 激活

OpenSpec change `notes-slim-local-independent-repo` 14 项 tasks 全勾，**未 archive**。不要顺手归档，除非明确要求。

---

## 2. 磁盘上到底有什么

| 角色 | 路径 | 谁拥有 | 卸后 |
|---|---|---|---|
| 源仓库（真实插件项目） | `/Users/chenxiangning/code/AI/github/mossx-plugin-notes` | 仓外 git | 不动 |
| staged 拷贝（产品位置） | `~/.ccgui/plugin-runtime/plugins/com.mossx.notes/` | Host DiskStorage（`app_home` = `~/.ccgui`） | **保留** |
| 安装出处 | 同上目录的 `.mossx-install.json` | Core 写 | **保留** |
| desired-state | `~/.ccgui/plugin-lockfile.json` | 产品 lockfile | 变 `uninstalled` |
| LKG pin | `~/.ccgui/plugin-lock.json` | 每 `pluginId` 一条 | **保留** |
| 过渡 pointer | `packages/plugin-notes/` | mossx 内，不再当 artifact owner | 源码仍在 |

staged 里有：`.mossx-plugin/plugin.json`、`dist/worker.js`、`src/`、`migrations/`。**没有** `.git` / `node_modules` / `target`。

`.mossx-install.json` 形状（手测时）：

```json
{
  "pluginId": "com.mossx.notes",
  "sourcePath": "/Users/chenxiangning/code/AI/github/mossx-plugin-notes",
  "stagedAtUnix": 1786989014
}
```

`sourcePath` 是用户当时选的文件夹，不是编译进二进制的常量。

---

## 3. 装一次实际发生了什么

```text
市场「从本地仓库安装」
    → pickWorkspacePath() 选 mossx-plugin-notes
    → Tauri install_plugin_from_path({ pluginId, sourcePath })
    → 只允许 com.mossx.notes，否则 local-source-unsupported
    → 找 .mossx-plugin/plugin.json（其次 plugin.json / manifest.json）
    → pluginId 必须匹配，否则 plugin-id-mismatch
    → 整树拷到 ~/.ccgui/plugin-runtime/plugins/com.mossx.notes/
      （跳过 .git / node_modules / target / .omx / .ccgui / .DS_Store）
    → 写 .mossx-install.json
    → 从 staged manifest 建 ActivationRequest
    → activate_allowlisted → Ready + establish_own_lkg
    → plugin-lockfile.json desired=installed
    → 入口/面板回来
```

一键 **Install**（不选文件夹）：若 staged 已有有效 manifest，优先 staged；否则仍走 compile-time fixture `include_str!(notes-pilot.json)`。所以现有 `install_notes` 测试在空 temp storage 里仍然绿。

浏览器预览 **没有**「从本地仓库安装」（`allowLocalSource={!previewMode}`），避免 3-button 测试红。

---

## 4. 诚实边界（容易记错）

| 已证明 | 没证明 |
|---|---|
| 独立仓是真插件项目结构 | Host / QuickJS **不** eval staged `dist/worker.js` |
| 市场能选这个仓并真拷贝 | `#[tauri::command]` 仍在 Core |
| 激活读的是 staged manifest | Trusted React UI 仍 Core 挂载 |
| 卸后 staged 还在，再装不用重选 | 没删 `note_cards.rs` / `src/features/note-cards` |
| Claude / Map 市场一键装/卸 | Claude / Map **没有** from-path，也没有独立仓 |
| 三根各自 LKG pin | P2.5 整行 / P2.6 / P2.7 |
| 本地 3 listing | 远程 Registry / 签名 / 12 插头可写 |

**0.8.9 的 Slim 定义**：ownership 离开 Core。  
**终态 Slim 定义**：删 Core 实现。后者会拆 0.8.9 IPC/bundle，**不要做**。

---

## 5. 下次回来先看这些文件

| 要回忆 | 打开 |
|---|---|
| 停刀状态（本页） | `docs/architecture/plugin-platform/18-notes-complete-baseline.md` |
| 三把尺子 / 九步表 | `docs/architecture/plugin-platform/16-progress-dashboard.md` |
| 0.9 十流怎么搬 | `docs/architecture/plugin-platform/17-contract-port-to-0.9.md` |
| 为什么允许 from-path | `docs/architecture/plugin-platform/09-decision-log.md` D-056 |
| 本刀合同 | `openspec/changes/notes-slim-local-independent-repo/` |
| 拷贝 / 校验 | `src-tauri/src/plugin_runtime/local_source.rs` |
| 装/卸编排 | `src-tauri/src/plugin_runtime/install.rs` |
| Tauri 入口 | `src-tauri/src/plugin_rack.rs` `install_plugin_from_path` |
| 市场按钮 | `src/features/extensions/components/PluginMarketplaceCatalog.tsx` |
| 选文件夹 | `src/features/extensions/components/PluginRackSection.tsx` |
| 独立仓本身 | `/Users/chenxiangning/code/AI/github/mossx-plugin-notes` |

---

## 6. 回来怎么验证还在

```bash
# 分支与提交
git -C /Users/chenxiangning/code/AI/github/mossx log -3 --oneline
git -C /Users/chenxiangning/code/AI/github/mossx-plugin-notes log -3 --oneline

# staged 还在不在（卸了也应该在）
ls ~/.ccgui/plugin-runtime/plugins/com.mossx.notes/.mossx-plugin/plugin.json
cat ~/.ccgui/plugin-runtime/plugins/com.mossx.notes/.mossx-install.json

# 两把锁
python3 -c "import json;print(json.load(open('$HOME/.ccgui/plugin-lockfile.json')))"
python3 -c "import json;print(json.load(open('$HOME/.ccgui/plugin-lock.json')))"

# 最小回归
cd /Users/chenxiangning/code/AI/github/mossx
cargo test --manifest-path src-tauri/Cargo.toml local_source -- --nocapture
cargo test --manifest-path src-tauri/Cargo.toml install_from_path -- --nocapture
npx vitest run src/features/extensions/components/PluginRackSection.test.tsx src/services/tauri/pluginRack.test.ts
```

桌面演示：Extensions → Notes 未安装 → **从本地仓库安装** → 选 `mossx-plugin-notes` → 看 `~/.ccgui/plugin-runtime/plugins/com.mossx.notes/` 出现拷贝。

---

## 7. 下次不要做

- 不要 Slim Claude / Project Map
- 不要删 `note_cards.rs` 或 Trusted React
- 不要 `HostConfig.enabled = true`，不要让 `missing_executable()` 变真 executable
- 不要开远程 Marketplace / 签名 / 12 插头写盘
- 不要把独立仓 submodule / 拷进 mossx
- 不要把产品路径写成 `/Users/chenxiangning/...`
- 不要把本页或 16 的 82/22/70 抄到 0.9 当起步进度（0.9 从 0 起算）
- 不要在 0.8.9 上再开大刀；合同已经够迁

若还要在 0.8.9 上动：只修本刀回归（拷贝失败、pluginId 校验、预览误显示按钮）。新能力先立 OpenSpec。

---

## 8. 之后若继续，两条路

| 路 | 入口 | 第一件事 |
|---|---|---|
| **推荐：迁 0.9** | [17](17-contract-port-to-0.9.md) | 开 `plugin-lockfile-and-presence`；先 lockfile + presence，最后才碰 Claude |
| 继续挖 last-mile | 新 OpenSpec | 只有一个值得挖的洞：Host 是否能加载 staged `dist/worker.js`。这会动 default-off，单独决策 |

Notes 这条本地仓链路已经证明 **最后一公里不是死胡同**（至少 stage + activate-from-staged 通了）。剩下的死胡同风险在 **command 仍 Core 注册、UI 仍 Core 挂载、Host 不 eval worker**。那是 0.9 重写时要单独拍的合同，不是 0.8.9 再删一套代码能解决的。
