## 1. Push Dialog 交互（P0）

- [x] 1.1 [依赖: 无] [优先级: P0] 将工具栏 `Push` 从直接执行改为打开弹窗（验证: 点击 Push 出现弹窗）。
- [x] 1.2 [依赖: 1.1] [优先级: P0] 弹窗支持 remote 与目标远端分支（下拉+手写）配置，以及确认/取消（验证: 取消无副作用，确认可触发执行）。
- [x] 1.3 [依赖: 1.2] [优先级: P0] 支持 `Push to Gerrit` 联动显示 Topic/Reviewers/CC 字段（验证: 开关切换字段显隐正确）。
- [x] 1.4 [依赖: 1.2] [优先级: P0] 当前分支改为只读展示，不允许编辑（验证: UI 无可编辑入口）。

## 2. Push 参数化执行（P0）

- [x] 2.1 [依赖: 无] [优先级: P0] 扩展 `push_git` 命令可选参数（验证: Rust 编译通过）。
- [x] 2.2 [依赖: 2.1] [优先级: P0] 支持 `pushTags/runHooks/forceWithLease` 旗标（验证: tauri wrapper 参数映射测试通过）。
- [x] 2.3 [依赖: 2.1] [优先级: P0] 支持 Gerrit refspec 组装与 topic/reviewers/cc 附加参数（验证: 参数链路联通）。

## 3. 文案与体验（P1）

- [x] 3.1 [依赖: 1.2] [优先级: P1] 新增中英文 Push Dialog 文案 key（验证: i18n 无缺 key）。
- [x] 3.2 [依赖: 1.2] [优先级: P1] 增加弹窗布局和移动端降级样式（验证: 宽度收缩时单列展示）。
- [x] 3.3 [依赖: 1.2] [优先级: P1] 将远端选择/布尔开关改为自定义控件样式（验证: 不依赖原生 select/checkbox）。

## 4. 验证（P0）

- [x] 4.1 [依赖: 1.3,2.3] [优先级: P0] 增加 GitHistoryPanel push 弹窗交互测试（验证: vitest 通过）。
- [x] 4.2 [依赖: 2.2] [优先级: P0] 增加 tauri push payload 映射测试（验证: vitest 通过）。
- [x] 4.3 [依赖: 4.1,4.2] [优先级: P0] 运行 `typecheck` + `cargo check`（验证: 均通过）。

## 5. 发布前收口（P1）

- [x] 5.1 [依赖: 4.3] [优先级: P1] 手工对照图2执行一次 UX 验收并记录差异。
- [x] 5.2 [依赖: 5.1] [优先级: P1] 补发布说明（Push 行为由直推改为先确认）。

## 6. Push Preview 提交列表与详情（P0）

- [x] 6.1 [依赖: 2.3] [优先级: P0] 增加“本次推送提交列表”查询能力（基于 source HEAD 与 `remote:targetBranch` 比较）。
- [x] 6.2 [依赖: 6.1] [优先级: P0] Push Dialog 渲染提交列表区域，默认选中首条提交。
- [x] 6.3 [依赖: 6.2] [优先级: P0] Push Dialog 渲染“变更文件树 + 提交详情”区域，并与列表选中态联动。
- [x] 6.4 [依赖: 6.2] [优先级: P0] 远端/目标远端分支变化时自动刷新预览数据。
- [x] 6.5 [依赖: 6.2] [优先级: P0] 无可推送提交时展示空态并禁用确认推送。
- [x] 6.6 [依赖: 6.4] [优先级: P0] 目标远端分支不存在时切换“新分支首次推送”模式（输出: `New` 标签 + 语义化占位提示；验证:
  不展示提交列表/详情明细项）。

## 7. Push Preview 验证（P0）

- [x] 7.1 [依赖: 6.5] [优先级: P0] 增加 Push Preview 列表展示与联动测试（验证: vitest 通过）。
- [x] 7.2 [依赖: 6.5] [优先级: P0] 增加远端/目标分支变化触发刷新测试（验证: vitest 通过）。
- [x] 7.3 [依赖: 7.1,7.2] [优先级: P0] 增加空态/禁用确认测试（验证: vitest 通过）。
- [x] 7.4 [依赖: 6.6] [优先级: P0] 增加 `targetFound=false` 场景测试（验证: 显示 `New` 标签并保留占位结构，列表明细项不渲染）。

## 8. 代码佐证记录（2026-02-20）

- [x] A. 已完成实现对齐检查：Push Dialog 参数化（remote/branch/pushTags/runHooks/forceWithLease/Gerrit）与 preview
  联动已在代码中落地。
    - 证据路径：`src/features/git-history/components/GitHistoryPanel.tsx`、`src/services/tauri.ts`。
- [x] B. 已完成最小回归验证：
  `pnpm -s vitest run src/features/git-history/components/GitHistoryPanel.test.tsx src/services/tauri.test.ts`
    - 结果：2 files / 46 tests passed。
- [x] C. 已完成“新分支首次推送”UI 同步：`targetFound=false` 时显示 `New` 标签与语义化提示，隐藏提交明细列表项。
    - 证据路径：`src/features/git-history/components/GitHistoryPanel.tsx`、
      `src/features/git-history/components/GitHistoryPanel.test.tsx`、`src/i18n/locales/zh.ts`。
- [x] D. 已完成 Push Preview 交互收口：文件详情改为点击文件后弹窗；选中提交仅刷新详情，不自动弹出 diff。
    - 证据路径：`src/features/git-history/components/GitHistoryPanel.tsx`（`pushPreviewModalFileKey` 触发链）、
      `src/features/git-history/components/GitHistoryPanel.test.tsx`（`opens diff modal when clicking push preview changed file`）。
- [x] E. 已完成样式收口：预览双栏固定高度并开启内部滚动；远端下拉固定向上展开。
    - 证据路径：`src/styles/git-history.css`（`git-history-push-preview-pane`、`git-history-push-preview-commit-list`、
      `.git-history-push-picker-menu.is-upward`）。
- [x] F. 发布前人工收口已完成：5.1（UX 对图验收）、5.2（发布说明）。

## 9. 归档前置处理（2026-02-20）

- [x] 9.1 [依赖: 8.A-8.E] [优先级: P0] 对齐 proposal/design/spec/tasks 与当前实现（新分支首次推送语义、diff 弹窗、上弹下拉、滚动布局）。
- [x] 9.2 [依赖: 9.1] [优先级: P0] 运行 OpenSpec 校验：`openspec validate git-history-push-dialog-options`（结果：valid）。
- [x] 9.3 [依赖: 9.2] [优先级: P1] 完成人工 UX 对照验收（沿用 5.1）。
- [x] 9.4 [依赖: 9.3] [优先级: P1] 完成发布说明收口（沿用 5.2）。

## 10. 手工验收与发布说明（2026-02-20）

- [x] UX 对照验收记录（对应 5.1 / 9.3）：
  - Push to Gerrit 选中后，顶部摘要实时更新为 `refs/for/<branch>`。
  - 目标分支缺失时，显示 `New` 标签与“新分支首次推送”语义提示；不渲染提交列表/详情明细项。
  - Push Preview 双栏固定高度，提交列表与文件列表内部滚动，未再出现文字重叠。
  - 点击提交仅刷新详情；点击“变更文件”才弹出 diff modal，不再自动弹出。
  - 远端下拉菜单固定向上展开，未遮挡底部操作区。
- [x] 发布说明（对应 5.2 / 9.4）：
  - 已落盘：`openspec/changes/git-history-push-dialog-options/release-notes.md`。
