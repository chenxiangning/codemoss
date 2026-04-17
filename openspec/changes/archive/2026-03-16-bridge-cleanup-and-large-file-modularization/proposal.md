## Why

当前代码库在 Bridge 与核心 UI/Backend 入口层出现了明显的超大文件聚集，已经超过可维护阈值并持续放大合并风险。  
截至 2026-03-15，全仓源码/样式扫描已识别 13 个 `>3000` 行文件，涉及前端主流程、Git/Spec 关键面板、Bridge 后端命令层与主题样式层。

## What Changes

- 建立长期治理规则：对 `>3000` 行文件进入“必须拆分重构”队列，并定义分批治理策略。
- 对 Bridge 层进行清理与强化：明确 command/service boundary，统一错误映射与并发控制约束。
- 对全量 `>3000` 行文件实施分级模块化拆分（保持外部行为与接口兼容），以领域切片替代单体文件。
- 增加回归保护：为关键交互链路和 Bridge command 契约补充最小可行验证。
- 增加工程哨兵：在 CI/检查脚本中加入超大文件阈值预警与治理进度可见性。

## Capabilities

### New Capabilities

- `bridge-cleanup-hardening`: 定义 Bridge 分层、命令注册边界、错误契约与并发保护基线，防止职责漂移与隐性回归。
- `large-file-modularization-governance`: 定义超大文件治理阈值、分批拆分流程、验收门禁与持续监控机制，并覆盖 TS/TSX/Rust/CSS/i18n 大文件治理。

### Modified Capabilities

- `git-history-panel`: 在保持现有功能与交互语义不变的前提下，允许内部模块化重构并要求行为等价验证。

## Impact

- Affected code:
  - `src/features/git-history/components/GitHistoryPanel.tsx`
  - `src/features/spec/components/SpecHub.tsx`
  - `src/App.tsx`
  - `src/features/settings/components/SettingsView.tsx`
  - `src-tauri/src/git/mod.rs`
  - `src-tauri/src/backend/app_server.rs`
  - `src-tauri/src/engine/commands.rs`
  - `src-tauri/src/engine/claude.rs`
  - `src/i18n/locales/en.ts`
  - `src/i18n/locales/zh.ts`
  - `src/styles/git-history.css`
  - `src/styles/settings.css`
  - `src/styles/composer.css`
- Affected systems:
  - 前端路由与页面组装层
  - Git History 功能子系统
  - Spec Hub 子系统
  - Tauri/Rust Bridge 服务层
  - i18n 文案与主题样式系统
- Dependencies/APIs:
  - 默认不新增运行时依赖；优先通过现有工具链完成拆分与验证
  - 对外 API 与用户可见行为保持兼容（非 breaking）

## 目标与边界

- 目标：
  - 将目标大文件拆分为可读、可测、可独立演进的模块结构。
  - 强化 Bridge 的边界治理，降低“单点大文件”导致的冲突与回归概率。
  - 建立可持续执行的治理机制，而非一次性清理。
- 边界：
  - 本提案聚焦结构治理与可维护性，不引入新产品功能。
  - 覆盖当前明确超阈值文件与相关支撑流程，并允许后续按阈值自动纳管新增目标。

## 非目标

- 不做 UI 视觉改版。
- 不做产品需求扩展或交互重定义。
- 不进行一次性全仓大规模重写。
- 不在本阶段改变对外命令协议或持久化数据格式。

## 技术方案对比

| 方案 | 描述 | 优点 | 风险 | 结论 |
|---|---|---|---|---|
| A. 渐进式模块抽取（推荐） | 保留外层 Facade，按领域逐步拆分子模块并补齐回归验证 | 风险可控、可分批落地、易回滚 | 周期较长，需要治理纪律 | ✅ 采用 |
| B. 一次性重写 | 直接重写超大文件并切换到新架构 | 短期结构“看起来”更整洁 | 回归风险高、验证成本巨大、冲突面更大 | ❌ 不采用 |

选择 A 的原因：在当前多并行变更环境下，渐进式方案更符合低回归与高可交付性目标，且便于与现有能力矩阵和测试门禁协同。

## 验收标准

- 结构门禁：
  - 目标文件完成拆分，主入口文件行数显著下降；新增模块职责边界清晰。
  - 新增治理检查规则，防止目标域再次出现 `>3000` 行单文件失控增长。
- 行为门禁：
  - 关键链路（Git History 主要交互、Settings 核心操作、Bridge 关键 command）保持行为等价。
  - 现有测试通过，且补充的最小回归验证可稳定复现。
- 工程门禁：
  - 类型检查与构建通过。
  - 变更说明中明确“保留能力点/重构范围/回滚策略”。

## 当前识别的大文件清单（2026-03-15）

| 文件 | 行数 | 类别 | 建议优先级 |
|---|---:|---|---|
| `src/features/git-history/components/GitHistoryPanel.tsx` | 9489 | TSX | P0 |
| `src/features/spec/components/SpecHub.tsx` | 6389 | TSX | P0 |
| `src/styles/settings.css` | 5765 | CSS | P1 |
| `src/styles/git-history.css` | 5576 | CSS | P1 |
| `src/App.tsx` | 5254 | TSX | P0 |
| `src-tauri/src/git/mod.rs` | 4791 | Rust | P0 |
| `src/features/settings/components/SettingsView.tsx` | 4659 | TSX | P0 |
| `src/i18n/locales/en.ts` | 3731 | i18n | P2 |
| `src-tauri/src/backend/app_server.rs` | 3695 | Rust | P0 |
| `src/i18n/locales/zh.ts` | 3669 | i18n | P2 |
| `src-tauri/src/engine/commands.rs` | 3528 | Rust | P0 |
| `src/styles/composer.css` | 3235 | CSS | P1 |
| `src-tauri/src/engine/claude.rs` | 3093 | Rust | P0 |
