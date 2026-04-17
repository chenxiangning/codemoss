## 1. 统一文件点击协议（P0）

- [x] 1.1 定义统一文件引用动作与类型（依赖: 无；输入: 现有三类文件点击入口事件；输出: 统一 `openFileReference`
  参数类型与调用约定；验证: TypeScript typecheck 通过且调用点可编译）
- [x] 1.2 将 `批量编辑文件` 卡片文件项接入统一动作（依赖: 1.1；输入: 批量编辑文件列表点击事件；输出:
  点击后进入统一文件详情弹窗；验证: 组件测试覆盖点击行为）
- [x] 1.3 将流式文本文件引用接入统一动作并加异常兜底（依赖: 1.1；输入: 流式文本中的文件引用 token；输出:
  点击不崩溃且异常可恢复提示；验证: 复现路径下无崩溃）

## 2. 弹层层级与可交互性修复（P0）

- [x] 2.1 统一 Plan 快览与文件详情弹层挂载到顶层 Portal（依赖: 1.1；输入: 现有弹层组件挂载位置；输出: 顶层挂载与统一层级
  token；验证: 手工回归弹层不被遮挡）
- [x] 2.2 修复 Plan 弹层在批量编辑卡片中的遮挡问题（依赖: 2.1；输入: Plan 按钮触发链路；输出: Plan
  快览始终可见且可交互；验证: 不同滚动位置/窗口尺寸下可完整点击）

## 3. File changes 信息完整性与职责去重（P1）

- [x] 3.1 建立文件统计映射层（依赖: 1.1；输入: 原始变更数据；输出: `A/M/D`、单文件 `+n/-m`、总计 `+total/-total` 字段；验证:
  单元测试校验映射正确性）
- [x] 3.2 在 `File changes` 主详情区渲染状态标识与统计（依赖: 3.1；输入: 映射层输出；输出:
  卡片头部总计与文件行统计完整展示；验证: 组件快照/断言通过）
- [x] 3.3 落地“主详情 + 摘要”去重规则（依赖: 3.2；输入: 同 operation 的多卡片渲染上下文；输出: `File changes`
  保留详情、批量编辑卡片保留摘要和 Plan 入口；验证: 同 operation 页面不再语义重复）

## 4. Codex 回复去重与稳定性（P0）

- [x] 4.1 在 Codex 回复组装链路增加同 turn 文本去重（依赖: 无；输入: 流式片段与 turn 标识；输出:
  同一回复最终文本不重复；验证: 问候语复现用例通过）
- [x] 4.2 增加去重回归测试并覆盖非 Codex 不受影响（依赖: 4.1；输入: Codex/Claude/OpenCode 渲染路径；输出:
  去重测试与隔离测试；验证: 全量前端单测通过）

## 5. 回归验证与发布门禁（P0）

- [x] 5.1 执行最小回归清单（依赖: 1.x-4.x；输入: 6 个问题对应场景；输出: 场景级验证记录；验证: 每项场景有明确通过结论）
- [x] 5.2 执行类型检查与受影响测试（依赖: 5.1；输入: 变更分支代码；输出: `npm run typecheck` 与受影响测试通过；验证: CI
  本地命令返回 0）

## 执行记录（2026-02-28）

-
`pnpm vitest run src/features/messages/components/Messages.test.tsx src/features/messages/components/toolBlocks/EditToolGroupBlock.test.tsx src/features/messages/components/toolBlocks/GenericToolBlock.test.tsx`
通过（51 tests）
- `pnpm run typecheck` 通过（`tsc --noEmit`）
