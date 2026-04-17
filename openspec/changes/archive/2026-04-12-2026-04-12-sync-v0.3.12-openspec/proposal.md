## Why

`mossx` 代码基线已经推进到 `v0.3.12`（2026-04-11），但 OpenSpec 主规范与文档仍停留在更早快照，存在以下漂移：

- 多引擎 MCP 设置页语义已改为“按引擎查看的只读视图”，规范未明确该只读边界。
- Codex 统一历史在“本地扫描不可用”场景新增降级策略（保留已知会话 + `partialSource`），规范缺失。
- Usage 统计已扩展到多引擎聚合、引擎分布、AI 改动行数与按天趋势，规范缺口明显。
- `File changes` 卡片在多文件折叠态下改为逐文件独立展开，规范未覆盖该交互约束。
- 布局/宽度设置（`canvasWidthMode`、`layoutMode`）落地后，规范未完整描述持久化与非法值回退策略。

## Scope & Evidence

- 版本边界：`git log --reverse v0.3.11..HEAD`
- 版本事实：`package.json.version = 0.3.12`
- 发布说明：`CHANGELOG.md` 的 `2026年4月11日（v0.3.12）`
- 核验范围：功能、修复、重构、配置、文档共 26 个提交（含 merge/docs/chore）

## 0.3.12 全量变更清单（按主题聚合）

### A. 设置与布局能力

- `12e94a8`: 新增 `canvasWidthMode (narrow|wide)`，并对非法值做回退兜底。
- `c2cc1e8`: 新增 `layoutMode (default|swapped)`，补齐 Win/mac titlebar 与拖拽区兼容。
- `6e6487e` + `b8e0084`: 侧栏快捷入口与快捷键在 swapped 模式下的顺序/文案修复。
- `90f19c6` + `95a338f`: MCP 设置页重构为“按引擎查看”的状态/规则/清单展示，修复折叠布局与图标状态反馈。
- `ea227d6`: settings 样式模块拆分（大文件治理）。

### B. 会话与历史链路

- `6de613c`: 线程列表增加 `sizeBytes` 展示，并增强 Codex 历史兼容。
- `0186c6c`: Web 切换 Codex 后“无法对话/历史丢失”修复（重连与重试链路）。
- `bbee279`: 本地扫描不可用时保留已知 Codex 会话；修正 `cwd` 回填边界。
- `f1f870d`: 跨会话绑定边界收紧，补强线程事件兼容。
- `929745a`: 默认 workspace 去重与路径边界修复。

### C. 消息与输入体验

- `261be2a`: `File changes` 折叠展示升级为多文件独立展开交互。
- `d3dcf87`: 消息折叠边界、拖拽预览、Gemini 会话兼容修复。
- `03520fb`: Composer 输入链路抗实时刷新干扰优化。
- `ae03463`: 输入框长文本水平溢出修复。
- `cd2e5a2`: Windows 文件树拖拽视觉反馈修复。

### D. 引擎与运行时稳定性

- `f8a83a6`: Claude 会话销毁阶段子进程竞争与残留修复。
- `f2b7d9a`: Claude 事件转换模块拆分（重构，语义保持）。
- `72b1182`: 启动链异常兜底页面，避免黑屏。

### E. Usage 与统计

- `ba90970`: 本地统计重构：`provider=all`、多引擎分布、AI 改动行数、按天代码改动趋势、Gemini 扫描增强。

### F. 品牌与迁移/工程化

- `d26cada`: 品牌切换到 `ccgui`，含 legacy 数据迁移、脚本/资源重命名。
- `cfe9192`: 版本号提升到 `0.3.12`。

### G. 文档与发布记录

- `73ef91d`、`e624e6e`: changelog 增量补齐。
- `a740dec`: 仅补充发布说明，无实现代码变化。
- `b1ab99a`: merge 提交（无独立功能语义）。

## OpenSpec 影响矩阵（新增/修改/删除/无影响）

| Capability | 影响分类 | 说明 | 本提案动作 |
|---|---|---|---|
| `codex-cross-source-history-unification` | 修改 | 新增本地扫描不可用降级策略与元信息补强 | 更新主 spec |
| `conversation-lifecycle-contract` | 修改 | 增补 `workspace not connected` 的可恢复重连与重试约束 | 更新主 spec |
| `conversation-template-maintenance` | 修改 | 覆盖 `File changes` 多文件独立折叠/展开行为 | 更新主 spec |
| `workspace-sidebar-visual-harmony` | 修改 | 明确 `layoutMode` 与 swapped 快捷入口一致性 | 更新主 spec |
| `client-global-ui-scaling` | 修改 | 增补 `canvasWidthMode` 设置、即时生效与回退 | 更新主 spec |
| `opencode-mode-ux` | 修改 | MCP 设置页按引擎只读查看语义补充 | 更新主 spec |
| `settings-local-usage-analytics` | 新增 | 多引擎 Usage 统计能力此前无独立规范 | 新增主 spec |
| `claude-runtime-termination-hardening` | 无影响 | `v0.3.12` 行为与现有规范一致 | 仅记录证据 |
| `codex-external-config-runtime-reload` | 无影响 | 相关修复未改变该 capability 的既有边界 | 仅记录证据 |
| 其它 `spec-hub/*`, `git-*`, `project-memory-*` | 无影响 | 本版本未引入需求级语义变更 | 不改 |

> 本轮无 capability 删除项（`REMOVED = none`）。

## What Changes (OpenSpec side)

- 新增 change：`2026-04-12-sync-v0.3.12-openspec`
- 同步修改主规范：
  - `openspec/specs/codex-cross-source-history-unification/spec.md`
  - `openspec/specs/conversation-lifecycle-contract/spec.md`
  - `openspec/specs/conversation-template-maintenance/spec.md`
  - `openspec/specs/workspace-sidebar-visual-harmony/spec.md`
  - `openspec/specs/client-global-ui-scaling/spec.md`
  - `openspec/specs/opencode-mode-ux/spec.md`
- 新增主规范：
  - `openspec/specs/settings-local-usage-analytics/spec.md`
- 同步文档：
  - `openspec/project.md`
  - `openspec/README.md`
  - `openspec/docs/v0.3.12-change-analysis-2026-04-12.md`

## Acceptance Criteria

- [ ] `v0.3.12` 关键语义（MCP 只读视图、Codex 历史降级、Usage 多引擎统计、布局/宽度模式）均可在主规范中定位。
- [ ] 规范与文档中的版本基线、统计口径、术语（`ccgui` / `canvasWidthMode` / `layoutMode` / `partialSource`）一致。
- [ ] 结构化变更清单（commit 级）在 docs 中可追溯，且映射到 capability 影响分类。

## Impact

- 规范影响：新增 1 个 capability，修改 6 个 capability。
- 文档影响：刷新 project context、README 快照、发布对齐分析文档。
- 代码影响：无（本仓库仅 OpenSpec 工件与文档）。
