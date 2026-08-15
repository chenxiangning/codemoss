---
type: implementation
status: historical-local-experiment
---

# Core Shell 减法实施记录

> 日期：2026-08-15  
> 分支：`feature/plugin-mossx-0.8.9`  
> OpenSpec：`reduce-to-core-shell-with-claude-compat`（**未落入本工作树**）  
> 阶段：一次本机可运行减法实验，**不是当前 Git 工作树的事实**
>
> **2026-08-16 校准**：本工作树仍是完整单体（62 个 `src/features`、7 个 Engine、未收缩 `command_registry`）。实施以 [`15-implementation-wave-plan.md`](15-implementation-wave-plan.md) 为准：先插排，再一根根拔插头。禁止把本文当作“已经删完”的开工指令。

## 1. 结论

0.8.9 分支已从“业务功能持续内置”收缩为一个可运行 Core Shell。当前 Core 只提供：

- App lifecycle 与 startup guard；
- Workspace registry、目录懒加载、文件只读预览；
- Git status、diff、stage、unstage 与带 checkpoint 的未暂存修改回退；
- Workspace 文本搜索与本地 Recent navigation；
- 会话侧栏、对话幕布、Composer；
- generic Engine Contract；
- 唯一临时 Claude compatibility adapter；
- Extensions Control Plane 空壳。

本阶段没有实现 Extension Host、Worker、Marketplace、安装事务或插件热更新。Extensions 页面只陈述平台 slot 与当前状态，不伪造已经存在的 Plugin Runtime。

## 2. 删除边界

已从 production source、Native registration、build resources 和 scripts 中移除：

- Browser、Intent Canvas、Notes、Project Map/Canvas/Memory；
- Kanban、Spec、Multi-Agent、Collaboration、Shared Session 产品层；
- Computer Use、Dictation、Agent Catalog、Curated Skills、Vendor/Model 管理；
- Runtime Log、Status、Email、Web Service daemon；
- Codex、Gemini、Kimi、Grok、OpenCode、Pi 的 runtime/history/provider 分支；
- 高级 Git History、PR、AI commit workflow；
- 旧 AppShell domain bag、lazy surface、detached product windows；
- 对应测试、catalog、curated resource、sidecar daemon 和失效治理脚本。

物理删除之外，`scripts/check-core-shell-boundary.mjs` 会检查：

1. retired frontend owner 不得重新进入 production import；
2. retired Rust owner 不得重新注册或留在 source tree；
3. runnable `EngineType` 必须严格等于 `Claude`；
4. renderer invoke command 必须属于 Native allowlist；
5. Native command registry 不得偷偷扩张。

## 3. 数据保护

源码删除不等于用户数据删除。本阶段没有删除 `~/.ccgui`、Tauri app-data、Workspace 文件或 Claude history。

`AppSettings`、`WorkspaceEntry` 与 `WorkspaceSettings` 使用 compatibility field flattening：Core 只解释自己拥有的字段，未知字段按原 JSON 保留。新增 Workspace 时使用带文件锁的 read-merge-atomic-write，不覆盖其他进程刚写入的 entry。

历史 Workspace 如果绑定了 Codex/Kimi 等已移除 Engine，会投影为 `compatibilityEngine` unavailable 状态。Core 明确阻止 send，不会 silent fallback 到 Claude，也不会改写历史 binding。

## 4. 冷启动收缩

本次减法直接移除了多类隐藏冷启动竞争源：

- 不再启动多 Engine manager、session importer、runtime reconciliation、snapshot loop；
- 不再加载 browser/catalog/skills/models/project intelligence；
- 不再挂载旧 AppShell 与全部 feature CSS/i18n/lazy graph；
- 不再在 Tauri setup 同步递归复制 legacy data directory；
- 不再在 `main()` 启动前执行 shell PATH probing；Claude PATH 修复延迟到用户第一次真正调用 adapter；
- 不再初始化 notification、window-state、process 等当前 Core 不消费的 plugin；
- Marketplace、Registry 网络与 Extension Host 不进入启动链。

当前 frontend production build 只转换 37 个 module；入口业务 chunk 约 20.11 kB（gzip 7.20 kB），React vendor 约 192.49 kB（gzip 60.35 kB）。上述数字是 2026-08-15 的构建快照，不替代 packaged Win/mac 冷启动重测。

## 5. 当前 Runtime/Command 面

Native IPC 采用显式 allowlist，分为五组：

| 组 | Commands |
|---|---|
| Lifecycle | `bootstrap_mark_renderer_ready`、`get_pending_open_paths` |
| Workspace/File/Search | `list_workspaces`、`add_workspace`、`list_workspace_directory_children`、`read_workspace_file`、`search_workspace_text` |
| Git Foundation | `get_git_status`、`get_git_file_diff`、`git_stage_path`、`git_unstage_path`、`get_git_path_checkpoint`、`git_revert_unstaged_path` |
| Engine Contract | `engine_send_message`、`engine_interrupt` |
| Claude compatibility history | `list_claude_sessions`、`load_claude_session` |

Git 和文件路径都限制在 canonical Workspace root 内，并拒绝 `..`、absolute path 与 `.git` internals。回退未暂存修改需要用户确认和内容 checkpoint；checkpoint 不一致时拒绝执行，untracked file 也拒绝由 Core 删除。

## 6. Claude 临时债务

Claude adapter 是唯一例外，不代表 CLI 重新成为 Core owner。当前为降低迁移回归风险，保留了 0.8.9 的 stream parsing、history attribution、图片输入和 permission-event 兼容代码，因此 Rust 仍报告 adapter 内部 dead-code warnings。

退出条件：当 `com.mossx.engine.claude` 独立仓库通过 Engine Contract conformance、session migration、stream/interrupt 和 rollback gate 后：

1. 从 Core 删除 `src-tauri/src/engine/claude*`；
2. `EngineType` 从 concrete enum 迁为 Extension Registry identity；
3. Claude history 由插件 Data Plane 提供；
4. Core 只保留 Engine Contract、Capability Broker 与 unavailable projection；
5. 通过 staged generation + LKG 后移除 compatibility badge。

## 7. 回退与检查

本轮未执行 commit、reset 或用户数据 migration。被移出的工作树内容暂存在：

`/tmp/mossx-core-subtraction-20260815/`

该目录只用于本机短期恢复，不是版本化 artifact，系统清理或重启后可能消失。正式审查和回退应以当前 Git diff 为准。

建议整体检查顺序：

1. `npm run typecheck`
2. `npm test`
3. `npm run build`
4. `npm run check:core-shell:boundary`
5. `cargo check --manifest-path src-tauri/Cargo.toml`
6. `cargo test --manifest-path src-tauri/Cargo.toml --lib`
7. `openspec validate reduce-to-core-shell-with-claude-compat --strict --no-interactive`
8. packaged macOS/Windows 冷启动与 Claude CLI 手工 smoke test

## 8. 下一阶段入口

下一阶段不是把已删 Feature 拷回 monorepo，而是按 [`14-v1-contract-freeze.md`](14-v1-contract-freeze.md) 实现最小 Plugin Kernel：Manifest parser、Registry generation、Extension Host controller、Capability Broker、per-plugin Storage Namespace/checkpoint，以及独立仓库的 `com.mossx.engine.claude` Engine pilot 与 `com.mossx.notes` Feature pilot。详细顺序继续以 [Migration Roadmap](08-migration-roadmap-and-tasks.md) 为准。
