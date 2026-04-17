## Context

当前变更聚焦 Git 高风险交互链路的“可恢复性 + 可解释性”。现状存在三个断点：

1) `pull/sync/fetch` 在认证交互或长耗时场景可能长期挂起，用户感知为卡死；
2) worktree 创建后发布失败与本地创建成功语义混在一起，用户误以为全量失败；
3) Git History 的操作错误提示自动 5 秒消失，用户尚未处理时上下文已丢失。另一个高频问题是分支删除在 `used by worktree`
   场景下直接抛原始 git 错误，缺少“可自愈 + 可行动”路径。

该问题跨 Rust 后端命令执行层、前端 Git History 交互层与 i18n 映射层，属于跨模块一致性治理。约束包括：保持现有 Git
语义不变、避免破坏现有 Tauri command 入参、保证测试可回归。

## Goals / Non-Goals

**Goals:**

- 为 `pull/sync/fetch` 增加统一的非交互执行与超时边界，避免无反馈挂起。
- 在 worktree 结果模型中清晰表达“本地成功/远端失败”，并提供重试命令。
- 将 Git History 错误提示改为常驻并支持显式关闭，保证用户有充足处理窗口。
- 对分支删除 `used by worktree` 场景提供自动 `worktree prune` + 一次重试，并输出可操作错误。

**Non-Goals:**

- 不引入新的 Git 操作类型或重做 Git History 整体布局。
- 不修改 Git 原生命令语义（如强制删除策略、merge/rebase 策略）。
- 不改造认证机制，仅处理执行环境与错误呈现。

## Decisions

1. 统一执行稳定性策略放在后端命令层，而非每个前端按钮分散处理。

- 方案A：前端按操作分别做超时与重试。优点是改动局部；缺点是行为不一致、容易漏场景。
- 方案B（采纳）：后端集中实现非交互环境、超时与锁释放策略，前端只消费标准化结果。
- 取舍：牺牲少量后端复杂度，换取一致行为与更低回归成本。

2. 分支删除 `used by worktree` 采用“一次自愈重试”而非静态报错。

- 方案A：直接报错并提示用户手工处理。
- 方案B（采纳）：检测命中特征错误后先 `git worktree prune`，再重试删除；仍失败才返回引导信息。
- 取舍：保留 Git 保护语义，同时提升 stale metadata 场景的一次成功率。

3. 操作提示采用“成功短暂、错误常驻”的生命周期策略。

- 方案A：全部 5 秒自动消失（现状）。
- 方案B（采纳）：成功提示可短时消失，错误提示常驻且手动关闭。
- 取舍：减少界面噪音，同时保障故障处理信息不丢失。

4. Capability 级别拆分：

- `git-operations` 负责执行稳定性契约；
- `git-branch-management` 负责分支删除 worktree 占用语义；
- `git-history-panel` 负责错误提示生命周期交互；
- `git-worktree-base-selection` 负责创建结果与 warning 展示一致性。

## Risks / Trade-offs

- [Risk] `worktree prune` 额外执行可能增加删除分支耗时。
  → Mitigation: 仅在命中 `used by worktree` 时触发，且只重试一次。

- [Risk] 错误提示常驻可能增加界面占用。
  → Mitigation: 提供显式关闭按钮；新操作开始前清理旧提示。

- [Risk] 错误文案过度本地化导致调试信息丢失。
  → Mitigation: 保留可复制 debug message，用户文案与调试文案双轨输出。

- [Risk] 跨模块变更引入隐性回归。
  → Mitigation: 对应 capability 均补充单测/集成测试并执行最小回归集。

## Migration Plan

1. 先落后端执行层变更（超时、非交互、prune+retry）与类型扩展，保证接口稳定。
2. 再落前端交互（错误提示常驻+关闭、worktree warning/creating 展示）。
3. 补 i18n 与测试，覆盖 timeout/auth/worktree-used-by-worktree 主路径。
4. 灰度验证：在开发环境重放“删除被 worktree 占用分支”与“认证挂起”场景。

回滚策略：

- 前端回滚可单独还原提示生命周期与展示逻辑。
- 后端回滚可关闭 prune+retry 分支与超时包装，恢复原命令路径。

## Open Questions

- `worktree prune` 是否需要暴露执行日志到 debug 面板，便于用户自助诊断？
- 错误提示常驻是否需要全局上限（例如只保留最近一条）避免多错误堆叠？
