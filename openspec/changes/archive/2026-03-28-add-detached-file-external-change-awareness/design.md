## Context

当前独立文件窗口的文件内容加载路径以“按需读取 + 前端 polling”组合为主：

- `FileViewPanel` 在文件切换时读取内容，并在 detached 聚焦态启用外部变化 polling。
- `DetachedFileExplorerWindow` 已具备工作区文件列表 polling（`useWorkspaceFiles`）与 Git 状态轮询（`useGitStatus`）。

已解决的问题（基线）：

- clean 场景下可自动同步磁盘变化。
- dirty 场景下可提示冲突并要求显式决策，避免 silent overwrite。

仍存在的问题（本轮优化目标）：

- 缺少 Rust watcher 事件主链路，当前感知时效与可观测性依赖 polling。
- 缺少显式 FSM 模块，状态迁移语义分散在组件逻辑中。
- 缺少 feature flag 回滚策略与 settings 开关。
- 缺少 Win/mac 归一去重的后端统一层与对应测试样例。

约束条件：

- 技术栈为 Tauri + Rust + React，优先复用现有 IPC/状态管理，不新增第三方依赖。
- 需覆盖 Windows / macOS 文件系统行为差异（路径大小写、watch 事件抖动、safe write）。
- 本变更仅作用于独立文件窗口，不扩展主窗口全部编辑面板。

## Goals / Non-Goals

**Goals:**

- 保持既有 polling 基线行为不回退（clean 自动同步 / dirty 冲突保护）。
- 增量引入 watcher 主链路 + polling fallback，提升时效并保留可用性。
- 引入显式 FSM，收敛状态迁移语义并提高可测试性。
- 通过路径归一、事件去抖、受控重试确保 Win/mac 行为一致可预测。
- 增加可回滚开关，出现线上异常可快速降级。

**Non-Goals:**

- 不实现多人协同编辑协议（OT/CRDT）。
- 不实现自动 merge 或三方冲突求解。
- 不引入全局文件编辑框架重构；仅增量改造独立窗口相关模块。
- 不在本阶段统一改造主窗口 FileViewPanel 的所有行为。

## Decisions

### Decision 1（已采纳）: 保持 polling 基线，先稳态再升级

- 选择：保留当前前端 polling 行为作为稳定基线，不做破坏性替换。
- 原因：当前用户可用路径已在线，先保证行为稳定再叠加 watcher 增量。

### Decision 2（待实现）: watcher 主链路 + fallback 双通道

- 选择：在 Rust 侧新增 watcher 事件桥接；异常时自动回退 bounded polling。
- 原因：兼顾响应速度与稳定性，避免单链路失败导致能力失效。

### Decision 3（已采纳）: dirty 场景强制“先提示后动作”

- 选择：当缓冲区 dirty 且检测到外部更新时，显示顶部条/抽屉，必须由用户选择：`Reload` / `Keep Local` / `Compare`。
- 原因：编辑器的核心安全原则是“未保存用户输入不可被隐式覆盖”。

### Decision 4（待实现）: 引入显式 FSM，替代组件内隐式状态组合

- 选择：新增独立 `externalChangeStateMachine` 模块，统一迁移规则：
  - `in-sync`
  - `external-changed-clean`
  - `external-changed-dirty`
  - `refreshing`
- 原因：降低组合状态歧义，便于单测覆盖与回归验证。

### Decision 5（待实现）: Win/mac 差异在归一层消化

- 选择：在事件进入前端前统一归一：
  - 路径归一：统一 `/`，Windows 比较大小写不敏感；macOS 保持区分语义。
  - 事件去重键：`(normalizedPath, mtimeMs, size)`。
  - macOS: `rename + change` 连发去抖。
  - Windows: 读取被占用时受控重试（指数退避 + 上限）。
- 原因：把平台差异集中在同一层处理，避免 UI 与业务层分散补丁。

### Decision 6（已采纳）: 作用域只限“独立窗口当前 workspace + 已打开 tab”

- 选择：事件只驱动独立窗口上下文内文件，不跨窗口广播刷新命令。
- 原因：降低耦合与误刷新风险，符合本提案边界。
### Decision 7（已采纳）: UI 提示采用“聚合 + 节流”策略

- 选择：连续外部写入按时间窗聚合单次提示；重复冲突不重复弹层，更新文案/计数即可。
- 原因：避免提示风暴，维持可读性。
## Architecture Plan (Incremental)

### Stage 1（已完成）

1. detached 聚焦态下启用 `FileViewPanel` 外部变化 polling。  
2. clean 自动同步 + non-blocking banner。  
3. dirty 冲突提示 + compare/reload/keep-local 决策。

### Stage 2（待实现）

1. Rust watcher 事件桥接到前端（结构化 payload）。  
2. watcher 失败自动切换 bounded polling。  
3. 前端对 watcher/polling 统一落到 FSM 输入事件流。

### Stage 3（待实现）

1. Win/mac 归一去重与受控重试。  
2. feature flag + settings 接入。  
3. 补全 Rust/前端测试矩阵与回滚预案。

## Risks / Trade-offs

- [Watcher 平台语义不一致] → 统一归一层 + 事件回放测试样例（mac rename/change、Windows safe-write）。
- [受控重试引入短暂刷新延迟] → 指数退避上限 + 日志打点 + fallback。
- [状态机迁移期间引入行为偏差] → 先补 FSM 单测，再切换调用路径。
- [仅覆盖 detached 与主窗口体验不一致] → 在 spec 边界明确，不在本变更扩展主窗口。

## Migration Plan

1. 保持 Stage 1 基线不变，冻结现有用户可见行为。  
2. 增量接入 Stage 2 watcher 事件链路，不删除 polling。  
3. 引入 FSM 并将现有分支逻辑逐步迁移到状态机 reducer。  
4. 完成 Stage 3 平台回放测试与 feature flag 开关接线。  
5. 通过开关灰度；异常时降级到 polling 基线。

## Open Questions

- Compare 入口是否要复用现有 Git diff 组件，还是保持当前轻量文本对比？
- watcher 事件 payload 是否在前端做版本号（`schemaVersion`）以兼容未来扩展？
- 高频更新文件是否需要引入“静默模式/只读监视模式”以减少干扰？
