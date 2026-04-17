## Context

当前代码库已经具备一套完整的 Claude rewind review surface：

- 输入区和上下文栏只在 `claude` 会话展示 rewind 入口。
- `Composer` 会构建 Claude 专属 rewind preview，并驱动确认弹层。
- 确认弹层已经支持文件 rail、compact diff preview、full diff overlay，以及“存储变更”导出动作。
- 后端 `export_rewind_files` 已经是引擎无关的目录协议，只要求前端传入合法的 `engine/sessionId/targetMessageId/files`。

这说明真正缺失的不是导出或 diff 渲染底座，而是 `Codex` 侧从“可回溯消息”到“确认审查界面”的接线与约束。约束主要有三点：

1. 不能再复制一套独立的 Codex rewind UI，否则 Claude/Codex 两边会继续分叉。
2. `Codex` rewind preview 必须沿用 `filePath` / `sourcePath` 契约，和本地 session replay、tool card persistence、manifest 保持一致。
3. `Codex` 的回溯执行链路与 Claude 不同，review surface 需要共享，但 preview 构造和 confirm handler 需要保留引擎差异注入点。

另外，2026-04-14 的 Claude 回溯修复已经验证了几类高频失败模式，Codex 需要在设计上直接继承这些约束，而不是等实现后再补丁：

1. 工具记录缺少 inline diff 时，不能直接跳过恢复，必须继续尝试 kind 与 structured 字段反演。
2. `modified` 与 `add/delete/rename` 冲突时，若有更具体语义必须优先具体语义，避免误回溯。
3. 回溯执行链路要有事务性：先应用工作区恢复，再调用会话 rewind/fork，失败时必须自动回滚。
4. 当目标锚点命中首条 user message 时，要遵循专用生命周期策略，避免产出无意义 fork 线程。

## Goals / Non-Goals

**Goals:**

- 让 `Codex` 会话拥有与 Claude 等价的 rewind review surface，包括入口、文件聚合、diff 审查和导出动作。
- 把已有 `ClaudeRewindConfirmDialog` 朝共享 rewind review surface 抽象，避免继续扩大命名和实现分叉。
- 让 `Codex` rewind preview、tool card history replay 和导出 manifest 持续共享同一 `sourcePath` 身份契约。
- 保持现有 `export_rewind_files` 目录协议不变，最大化复用已有 Rust 测试资产。

**Non-Goals:**

- 不改动 `Codex` 历史聚合、source unification 或 session replay 的存储格式。
- 不要求本次把 `ClaudeRewindConfirmDialog` 完整重命名为通用组件，只要求抽象出可复用语义层。
- 不为 `Gemini` 增加 rewind review surface。
- 不引入新的 diff viewer、存储服务或 schema migration。

## Decisions

### Decision 1: 共享 review surface，分离 preview builder 与 rewind executor

- 方案 A：复制 Claude 的 preview builder、弹层和导出调用到 Codex 分支。
  - 优点：实现快。
  - 缺点：功能对齐后仍需双份维护，后续每次迭代都要做镜像变更。
- 方案 B：保留现有 UI 资产，但把组件依赖的数据结构提升为引擎无关的 rewind preview model，由 Claude/Codex 各自注入 preview builder 和 confirm handler。
  - 优点：复用度高，降低后续维护成本。
  - 缺点：需要清理当前 `Claude*` 命名带来的耦合。

取舍：采用方案 B。review surface 共享，构造 preview 与真正执行 rewind 的 handler 仍按引擎分流。

### Decision 2: 继续复用 `export_rewind_files`，不扩展新命令

- 方案 A：为 Codex 单独建一个 `export_codex_rewind_files` 命令。
  - 优点：命名上看起来更直接。
  - 缺点：协议重复、测试重复，纯粹增加维护负担。
- 方案 B：沿用 `export_rewind_files`，把 `engine = codex` 作为已支持分支继续复用。
  - 优点：目录协议和 manifest 一致，后端风险最低。
  - 缺点：前端必须确保 Codex 侧传入的 session/target/file 集合完整可靠。

取舍：采用方案 B。后端只在必要时补边界校验或测试，不增加新命令。

### Decision 3: 对 `conversation-tool-card-persistence` 做 requirement 级修改

- 方案 A：只新增 `codex-rewind-review-surface` spec，不动已有持久化 spec。
  - 优点：spec 数量少。
  - 缺点：无法明确 rewind preview、manifest 与 local session replay 共享同一文件身份契约。
- 方案 B：新增 `codex-rewind-review-surface`，同时修改 `conversation-tool-card-persistence` 中关于 shared file identity 的 requirement。
  - 优点：契约清晰，避免 review surface 成为旁路语义。
  - 缺点：需要维护跨 capability 的一致性。

取舍：采用方案 B。

### Decision 4: 将 Claude 已验证的恢复健壮性规则前置到 Codex 设计

- 方案 A：先只做 review surface，对恢复链路问题等 Codex 实装后按 bug 再修。
  - 优点：短期实现路径更短。
  - 缺点：会重复走 Claude 已踩过的坑，回归成本高，且容易在首轮上线出现“半回溯状态”。
- 方案 B：把 Claude 已验证的规则写进 Codex 设计和任务，作为实现前置门禁。
  - 优点：问题前移，验收标准可执行，减少返工。
  - 缺点：任务数量略增，需要在实现阶段补更细粒度测试。

取舍：采用方案 B，明确把“无 diff 恢复、kind 冲突优先级、失败回滚、首条锚点边界”纳入必做范围。

## Risks / Trade-offs

- [Risk] `Codex` 当前没有现成的 rewindable-target 选择逻辑，直接复用 Claude 候选规则可能选错锚点
  → Mitigation：将“候选消息发现”和“review surface 渲染”解耦，先在 spec 中明确可回溯目标必须来源于 Codex 可恢复消息锚点，而不是硬编码 Claude user message 规则。

- [Risk] 组件命名仍然带 `Claude` 前缀，短期内会造成阅读成本和误导
  → Mitigation：本次优先抽离共享 preview model / props；若实现中发现重命名收益明显，可在代码阶段顺手做无行为变更重命名。

- [Risk] `Codex` 的 file change 数据可能比 Claude 更依赖本地 replay 或 patch 记录，预览聚合时出现 diff 不完整
  → Mitigation：spec 明确要求缺失 diff 时仍保留可恢复空态，且不阻断导出与回溯确认。

- [Risk] 两个引擎共用 review surface 后，入口可见性判断写错会把 rewind 按钮暴露给不支持的引擎
  → Mitigation：在 spec 和测试中明确 `Codex`/`Claude` 支持、其他引擎隐藏的可见性矩阵。

- [Risk] 工具数据里 `kind`/`diff`/structured 字段彼此冲突，导致回溯语义不稳定
  → Mitigation：统一 kind 决策优先级（具体语义优先于 `modified`），并把冲突输入加入固定回归样例。

- [Risk] 会话 rewind/fork 失败后工作区残留“半回溯”文件状态
  → Mitigation：执行链路强制采用“先快照、再恢复、失败回滚”的事务模型，回滚也要有测试断言。

- [Trade-off] 这次优先做共享抽象而不是最短路径复制，短期重构成本略高
  → Mitigation：换来后续 Claude/Codex rewind 审查体验的一处演进，长期更稳。

## Migration Plan

1. 在 `Composer` / 输入区可见性逻辑中，把 rewind 入口从 Claude-only 扩成 Claude + Codex，但保持其他引擎隐藏。
2. 抽离共享 rewind preview model 与 review dialog props，让现有 dialog 能被 Codex preview 复用。
3. 为 Codex 接入 preview builder，复用文件聚合、compact diff preview、full diff overlay 和 store action。
4. 复用 `export_rewind_files` 完成导出接线，必要时补后端边界测试。
5. 将 Claude 已验证的恢复规则接入 Codex：
   - 无 inline diff 场景走 kind/structured 反演；
   - kind 冲突时具体语义优先；
   - rewind/fork 失败自动回滚工作区快照；
   - 首条 user message 命中时走专用生命周期策略。
6. 增补前端和 Rust 测试，覆盖入口可见性、preview 聚合、导出目录、无 diff 恢复、失败回滚与首条锚点边界。
7. 若上线后出现行为回退，可回滚到仅 Claude 展示 rewind 入口，同时保留共享导出协议不变。

## Open Questions

- `Codex` 的 rewind 执行最终是否沿用现有 `onRewind(userMessageId)` 签名，还是需要引擎特定 target identity？这会影响共享 preview model 的 target 字段设计。
- `Codex` 可回溯候选是否只看 user message，还是允许特定系统/plan 节点作为 rewind anchor？需要在实现前和现有历史语义核对。
