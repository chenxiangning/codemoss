## 1. Action Registry 与右键菜单骨架（P0）

- [x] 1.1 [依赖: 无] [优先级: P0] 建立 `CommitActionRegistry`（输入: 现有 commit actions；输出: 分组/排序/guard/executor
  统一定义；验证: 单测断言 `Copy Revision Number` 与 `Reset Current Branch to Here...` 存在且顺序稳定）。
- [x] 1.2 [依赖: 1.1] [优先级: P0] 提交列表接入 `contextmenu` 事件并渲染分组菜单（输入: commit row 交互；输出:
  可右键打开菜单；验证: 手工测试右键可弹出且分组顺序一致）。
- [x] 1.3 [依赖: 1.2] [优先级: P0] 保持左键选中逻辑不变（输入: 左键点击；输出: 仅选中不触发写操作；验证: 回归测试通过）。

## 2. 关联按钮组（P0）

- [x] 2.1 [依赖: 1.1] [优先级: P0] 在提交区接入动作按钮组（输入: 选中提交状态；输出: `Copy`/`Create Branch`/`Reset`
  三按钮；验证: 组件测试快照与交互通过）。
- [x] 2.2 [依赖: 2.1] [优先级: P0] 按钮组与右键菜单共享 guard（输入: repo busy/no selection/current state；输出:
  启用禁用状态一致；验证: 状态矩阵测试通过）。
- [x] 2.3 [依赖: 2.2] [优先级: P1] 补齐禁用原因提示（输入: disabled reason map；输出: tooltip/帮助文案；验证: 手工验证两入口文案一致）。

## 3. Reset Dialog 与模式执行（P0）

- [x] 3.1 [依赖: 1.1] [优先级: P0] 实现 reset 确认弹窗模型（输入: branch + commit metadata；输出:
  图3结构化弹窗与模式单选；验证: 打开弹窗不执行 reset）。
- [x] 3.2 [依赖: 3.1] [优先级: P0] 接入 `soft/mixed/hard/keep` 模式参数（输入: 用户选择模式；输出: 对应 git reset
  调用参数；验证: 单测覆盖四模式分发）。
- [x] 3.3 [依赖: 3.2] [优先级: P0] 实现 `hard` 破坏性确认（输入: hard 模式确认链；输出: 二次提示后才能执行；验证:
  取消无副作用，确认后执行）。
- [x] 3.4 [依赖: 3.2] [优先级: P0] 补齐失败映射与 Retry（输入: stderr/error code；输出: 可读错误与重试入口；验证:
  模拟失败测试通过）。

## 4. 并发锁与操作状态（P0）

- [x] 4.1 [依赖: 3.2] [优先级: P0] 将 reset 纳入 git 写操作互斥集合（输入: operation state；输出:
  pull/push/sync/cherry-pick/revert/reset 互斥；验证: 并发场景测试通过）。
- [x] 4.2 [依赖: 4.1] [优先级: P1] UI 侧 busy 提示统一（输入: operation lock reason；输出: 菜单与按钮一致提示；验证:
  手工回归通过）。

## 5. 国际化与文案（P1）

- [x] 5.1 [依赖: 1.2,2.1,3.1] [优先级: P1] 新增/更新中文文案（输入: proposal 术语；输出: `复制修订号`、`将当前分支重置到此处...`
  、四模式说明；验证: i18n key 检查无缺失）。
- [x] 5.2 [依赖: 5.1] [优先级: P1] 同步英文文案（输入: zh keys；输出: en keys 对齐；验证: 中英切换无回退 key）。

## 6. 测试与验收（P0）

- [x] 6.1 [依赖: 2.2,3.3,4.1] [优先级: P0] 自动化测试覆盖菜单分组/按钮组联动/reset 模式（输入: fixtures + mock git
  op；输出: 稳定测试集；验证: CI 全绿）。
- [x] 6.2 [依赖: 6.1] [优先级: P0] 手工对照图2/图3验收（输入: 本地桌面构建；输出: 验收记录；验证: 通过 proposal 全部验收标准）。
- [x] 6.3 [依赖: 6.2] [优先级: P1] 补充发布说明（输入: 变更点摘要；输出: release notes 文案；验证: 产品/测试评审通过）。

## 7. 代码佐证与推进记录（2026-02-20）

- [x] A. 已完成代码对齐检查：`buildCommitActions` 对菜单与按钮组共用同一 `busyReason` 与 `disabledReason`，满足 4.2 目标。
    - 证据路径：`src/features/git-history/components/GitHistoryPanel.tsx`（`buildCommitActions` 统一构建逻辑）。
- [x] B. 已完成最小回归验证：
  `pnpm -s vitest run src/features/git-history/components/GitHistoryPanel.test.tsx src/services/tauri.test.ts`
    - 结果：2 files / 46 tests passed。
- [x] C. 人工验收与发布收口已完成：6.2、6.3 已闭环。

## 8. 归档前置处理（2026-02-20）

- [x] 8.1 [依赖: 7.A-7.B] [优先级: P0] 对齐 proposal/design/spec/tasks 与当前实现状态（动作注册表、reset 流程、互斥锁语义）。
- [x] 8.2 [依赖: 8.1] [优先级: P0] 运行 OpenSpec 校验：`openspec validate git-commit-history-context-menu-reset-flow`（结果：valid）。
- [x] 8.3 [依赖: 8.2] [优先级: P1] 完成图2/图3人工验收记录（沿用 6.2）。
- [x] 8.4 [依赖: 8.3] [优先级: P1] 完成发布说明并进入归档（沿用 6.3）。

## 9. 手工验收与发布说明（2026-02-20）

- [x] UX 对照验收记录（对应 6.2 / 8.3）：
  - 提交右键菜单稳定包含 `复制修订号` 与 `将当前分支重置到此处...`，分组顺序无抖动。
  - 提交区按钮组与右键菜单共享禁用态与 busy 原因，状态一致。
  - 触发 `Reset Current Branch to Here...` 后先进入确认弹窗，不会直接执行 reset。
  - `soft/mixed/hard/keep` 四模式可选，`hard` 路径包含破坏性确认提示。
- [x] 发布说明（对应 6.3 / 8.4）：
  - 已落盘：`openspec/changes/git-commit-history-context-menu-reset-flow/release-notes.md`。
