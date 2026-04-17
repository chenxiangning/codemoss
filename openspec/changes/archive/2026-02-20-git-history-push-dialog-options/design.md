## Context

当前 Git History 工具栏中 `Push` 已升级为确认弹窗，但仍缺少推送前内容预览。本次改造追加范围需要同时覆盖：

- 前端交互层：Push Dialog 打开/关闭、当前分支只读展示、目标远端分支选择/手写、字段状态与提交、推送提交预览列表与详情联动。
- Tauri bridge 层：push 参数透传。
- Rust 执行层：兼容默认 push，并支持 Gerrit refspec 与额外 flags。
- 推送预览数据层：基于目标 `remote:branch` 计算 outgoing commits，并支持按提交查看详情。

## Goals / Non-Goals

**Goals:**

- `Push` 必须 confirmation-first。
- 参数化 push：remote/target-branch/pushTags/runHooks/forceWithLease/pushToGerrit/topic/reviewers/cc。
- 当前分支必须只读，不允许在弹窗中修改。
- Push Dialog 必须展示“本次推送提交列表 + 选中提交文件树/详情”。
- 兼容默认调用，避免破坏现有调用方。

**Non-Goals:**

- 不实现 JetBrains 全量 Push 面板能力（多仓批处理、变基链路入口等）。
- 不引入 force push（`--force`）快捷入口，仅支持 `--force-with-lease`。

## Decisions

### Decision 1: 工具栏 Push 改为弹窗触发

- 决策
    - 点击 `Push` 按钮仅打开弹窗，不直接执行网络写操作。
- 理由
    - 避免误触直接推送，增加风险防护。

### Decision 2: 后端命令做“可选参数扩展”而非新增命令

- 决策
    - 复用 `push_git`，增加可选参数。
- 理由
    - 兼容历史调用点；旧调用无需改参即可继续工作。

### Decision 3: Gerrit 推送使用 refspec 组装

- 决策
    - `pushToGerrit=true` 时构造 `HEAD:refs/for/<branch>`，并附加 `%topic=.../r=.../cc=...`。
- 理由
    - 保持与 Gerrit 常见命令心智一致。

### Decision 4: 目标分支使用“下拉候选 + 手写”组合交互

- 决策
    - 目标远端分支默认展示候选列表，允许用户直接手写覆盖。
- 理由
    - 兼顾常见分支快速选择与非常规分支输入场景。

### Decision 5: Push Dialog 使用自定义控件样式

- 决策
    - 远端选择、开关选项采用自定义 dropdown/toggle，不使用原生 `select/checkbox`。
- 理由
    - 与当前面板视觉语言保持一致，提升可读性与一致性。

### Decision 6: 默认语义兼容旧实现

- 决策
    - 未显式传参且 flags 为默认值时，仍走当前上游推送语义。
- 理由
    - 降低回归风险。

### Decision 7: Push Preview 按 `remote:targetBranch` 精确计算

- 决策
    - Push Dialog 打开后，系统需要根据“当前分支 HEAD vs 目标远端分支”计算 outgoing commits。
- 理由
    - 只有基于目标分支比较，才能保证“预览内容”和“实际推送范围”一致。

### Decision 8: 提交详情采用“列表先行 + 详情按需”加载

- 决策
    - 首屏先加载 outgoing commit 列表；用户选中提交后加载该提交详情（message + changed files + diff 摘要）。
- 理由
    - 降低首屏等待时间，避免每次打开弹窗就拉取完整详情导致卡顿。

### Decision 9: 目标分支缺失时切换“新分支首次推送”模式

- 决策
  - 当 preview 返回 `targetFound=false` 时，Push Dialog 不展示提交列表项与详情明细项，改为保留双栏占位并显示语义化提示。
  - 目标摘要右侧显示 `New` 标签，明确当前是首次创建远端分支的推送路径。
- 理由
  - 避免“基于 HEAD 的列表预览”引发语义误解（用户会误判为已存在目标分支上的差异对比）。
  - 保持布局稳定（不塌陷），同时让提示信息与真实行为一致。

### Decision 10: Push Preview 变更文件详情采用“点击后弹窗”而非内联展开

- 决策
  - 右侧详情区点击文件时，通过 portal 弹出独立 diff modal；仅选中提交时不触发弹窗。
- 理由
  - 避免详情区过度展开挤压主布局，保持“列表浏览”和“文件 diff 深读”两个层级分离。
  - 防止提交切换时误触发 diff 自动弹出，降低交互噪音。

### Decision 11: 远端下拉固定上弹

- 决策
  - 远端选择菜单固定使用 upward placement（`is-upward`）。
- 理由
  - Push Dialog 底部存在 Gerrit/操作按钮区，向下展开会遮挡关键交互区并增加误触。

### Decision 12: 预览双栏固定视口 + 内部滚动

- 决策
  - 左侧提交列表与右侧详情面板采用固定高度容器，超出内容通过内部滚动查看。
- 理由
  - 保证弹窗整体高度稳定，避免长提交标题/长文件列表导致文字重叠或布局抖动。

## Risks / Trade-offs

- [Risk] 参数组合复杂导致误配置
    - Mitigation: 提供默认值（origin/current branch 对应远端目标分支, runHooks=true）与清晰字段分组。
- [Risk] Gerrit 字段格式错误
    - Mitigation: 仅做逗号切分与 trim；后端保留原始 Git 错误回传。
- [Risk] 多入口 push 行为不一致
    - Mitigation: 本次明确收敛 Git History 工具栏入口；其他入口后续统一。
- [Risk] 预览计算与实际 push 范围不一致
    - Mitigation: 统一使用同一目标分支参数驱动 preview 计算和 push 执行。
- [Risk] 大提交集预览导致弹窗卡顿
    - Mitigation: 列表分页/限制首屏数量，详情按需加载。
- [Risk] 目标分支不存在时误解为普通增量推送
  - Mitigation: `New` 标签 + 语义化提示文案 + 隐藏提交明细列表。
- [Risk] 用户误判“选中提交即打开 diff”
  - Mitigation: 明确仅在“点击文件行”触发弹窗，并保持提交切换为纯详情刷新。

## Migration Plan

1. 扩展后端 `push_git` 参数与执行分支。
2. 扩展前端 tauri wrapper 的 push options。
3. 接入 Git History Push Dialog。
4. 增加 Push Preview 查询链路（outgoing commits + selected commit detail）。
5. 在 Push Dialog 中接入提交列表、文件树、详情区域。
6. 增加“新分支首次推送”模式（`targetFound=false`）与 `New` 标签展示。
7. 增加 i18n 文案与测试。
8. 运行 typecheck/vitest/cargo check 验证。
9. 调整预览区为固定视口 + 内部滚动；统一文本行高避免重叠。
10. 将 Push Preview 文件详情改为点击后弹窗，并确保仅文件点击触发。
11. 固定远端下拉为向上展开，避免遮挡底部操作区。

回滚策略：

- 前端回滚到点击按钮直接 `runOperation("push")`。
- 后端保留扩展签名不影响旧调用；必要时忽略新增参数。
