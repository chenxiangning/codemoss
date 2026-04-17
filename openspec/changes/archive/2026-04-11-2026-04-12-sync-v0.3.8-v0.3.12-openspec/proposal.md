## Why

当前 OpenSpec 已对齐 `v0.3.12` 的核心能力，但在把基线扩展到 `v0.3.8 -> v0.3.12` 后，仍存在跨版本语义缺口：

- `v0.3.9` 的“侧栏悬停图钉 + 固定区一键取消固定”缺少明确规范约束。
- `v0.3.10` 的“提交信息按语言/按引擎生成 + AI 输出清洗”缺少 capability 级规范。
- `v0.3.10` 的“输入区快捷动作独立入口与二级菜单”缺少交互与可访问性约束。
- `v0.3.11` 的“用户消息 `@路径` 提取为引用卡片”与“多引擎流式 waiting/ingress 特效”尚未进入主 specs。

若不补齐，`0.3.8-0.3.12` 区间的实现语义无法在 OpenSpec 中完整追踪与回归验证。

## Scope & Evidence

- 版本边界：`v0.3.8..HEAD`（截至 2026-04-12）
- Tag 事实：存在 `v0.3.8 / v0.3.9 / v0.3.10 / v0.3.11`，`v0.3.12` 以 `HEAD` 对齐
- 提交总量：`83`（`feat=21, fix=34, refactor=3, perf=1, docs=5, chore=4, style=2, test=1, merge=10, other=2`）
- 分版本提交数：
  - `v0.3.8..v0.3.9`: 15
  - `v0.3.9..v0.3.10`: 15
  - `v0.3.10..v0.3.11`: 26
  - `v0.3.11..HEAD`: 27
- 交叉依据：
  - `CHANGELOG.md`（2026-04-04/07/09/11 的 v0.3.9~v0.3.12 章节）
  - `git log --reverse --oneline v0.3.8..HEAD`
  - `git diff --name-status v0.3.8..HEAD`

## 0.3.8-0.3.12 结构化变更清单（主题聚合）

### A. 侧栏与线程管理

- `f58c612`: 悬停显示图钉，支持固定区一键取消固定。
- `f6dd3a6`: 修复固定后项目列表残留与刷新延迟。
- `6e6487e` / `b8e0084`: swapped 布局下快捷入口顺序与快捷键文案修复。
- `6de613c`: 线程大小（`sizeBytes`）展示。

### B. 提交信息生成链路

- `1be1b40`: 提交信息按语言（中/英）生成。
- `1546b79`: 提交信息按引擎（Codex/Claude/Gemini/OpenCode）生成，补齐输出规范化。
- `0a35714`: 文档补充引擎生成与输出规范说明。

### C. Composer 输入与快捷入口

- `5a48bf1`: 快捷动作改为独立图标入口并支持二级菜单。
- `f7a56de`: 修复快捷动作可访问性与“创建提示词”事件链路。
- `f295327` / `1161df8` / `5134579`: prompt enhancement 和快捷键跨平台稳定性修复。

### D. 消息展示与流式反馈

- `7b29e5a`: 用户消息 `@路径` 提取为独立引用卡片。
- `05dfb50` / `ff6887d`: 相邻文本解析与视觉密度修复。
- `e739fb4` / `ab9945f`: Codex/Claude/Gemini 的 waiting/ingress 联动特效与浅色主题可见性增强。
- `261be2a`: `File changes` 多文件独立折叠/展开（已在前序 change 覆盖）。

### E. 运行时稳定性与兼容

- `3c456f9` / `f8688c9`: Gemini 会话续传与 pending 连续性修复。
- `608952a`: 多会话 stop 误伤与首次 stop 不生效修复。
- `f15eca3`: Claude 自定义命令列表空响应重试与回退加固。
- `c9fef9c` / `065a0fd` / `f8a83a6`: Claude 子进程终止与残留修复。
- `9bc2a79` / `5a60415`: Gemini 长 prompt stdin 传输与 Windows 路径兼容。

### F. 设置、布局与统计

- `12e94a8`: `canvasWidthMode`（`narrow|wide`）与非法值回退。
- `c2cc1e8`: `layoutMode`（`default|swapped`）与 Win/mac titlebar 兼容。
- `90f19c6` / `95a338f`: MCP 设置重构为按引擎只读检查视图。
- `ba90970`: Usage 多引擎聚合、引擎分布、AI 改动行数、按天趋势。

### G. 品牌与发布治理

- `d26cada`: 品牌升级为 `ccgui`，含 legacy 数据迁移。
- `bce5396` / `7ed71a1` / `09bcc99` / `cfe9192`: `0.3.9~0.3.12` 版本 bump。
- 多个 docs/changelog/merge 提交：发布说明与分支合并治理。

## OpenSpec 影响矩阵（新增/修改/删除/无影响）

| Capability | 影响分类 | 说明 | 本提案动作 |
|---|---|---|---|
| `workspace-sidebar-visual-harmony` | 修改 | 补齐悬停图钉、根线程 pin 行为、固定区一键取消固定、pin/unpin 列表同步约束 | 更新主 spec |
| `git-commit-message-generation` | 新增 | 语言/引擎双维生成与输出清洗缺少独立规范 | 新增主 spec |
| `composer-shortcut-actions-menu` | 新增 | 快捷动作图标入口、二级菜单与键盘可访问性缺口 | 新增主 spec |
| `conversation-user-path-reference-cards` | 新增 | `@路径` 解析、去重、引用卡片渲染契约缺失 | 新增主 spec |
| `conversation-stream-activity-presence` | 新增 | waiting/ingress 相位计算与跨引擎视觉联动缺失 | 新增主 spec |
| `client-global-ui-scaling` | 无影响（已覆盖） | `canvasWidthMode` 已在 `2026-04-12-sync-v0.3.12-openspec` 对齐 | 仅记录 |
| `opencode-mode-ux` | 无影响（已覆盖） | MCP 设置页只读语义已对齐 | 仅记录 |
| `settings-local-usage-analytics` | 无影响（已覆盖） | 多引擎 Usage 能力已新增 | 仅记录 |
| `conversation-template-maintenance` | 无影响（已覆盖） | `File changes` 独立折叠已对齐 | 仅记录 |
| `codex-cross-source-history-unification` | 无影响（已覆盖） | local scan degrade 语义已对齐 | 仅记录 |

> 本轮无 capability 删除项（`REMOVED = none`）。

## What Changes (OpenSpec side)

- 新增 change：`2026-04-12-sync-v0.3.8-v0.3.12-openspec`
- 新增主规范：
  - `openspec/specs/git-commit-message-generation/spec.md`
  - `openspec/specs/composer-shortcut-actions-menu/spec.md`
  - `openspec/specs/conversation-user-path-reference-cards/spec.md`
  - `openspec/specs/conversation-stream-activity-presence/spec.md`
- 修改主规范：
  - `openspec/specs/workspace-sidebar-visual-harmony/spec.md`
- 同步文档：
  - `openspec/docs/v0.3.8-v0.3.12-change-analysis-2026-04-12.md`
  - `openspec/project.md`
  - `openspec/README.md`

## Acceptance Criteria

- [ ] `v0.3.8-0.3.12` 的关键新增语义（图钉交互、提交信息生成、快捷动作菜单、`@路径` 引用卡片、流式相位特效）均可在主 specs 中定位。
- [ ] 版本边界、术语与行为描述在 proposal/spec/docs 中保持一致（`v0.3.8..HEAD`、`waiting/ingress`、`CommitMessageEngine`、`@path`）。
- [ ] 新增 change 可通过 `openspec validate 2026-04-12-sync-v0.3.8-v0.3.12-openspec --strict`。

## Impact

- 规范影响：新增 4 个 capability，修改 1 个 capability。
- 文档影响：新增区间分析文档，刷新 README/project 快照。
- 代码影响：无（本仓库仅 OpenSpec artifacts）。
