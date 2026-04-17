## 1. 边界锁定与事件契约核对（仅 Claude）

- [x] 1.1 [P0] 固化“仅 `claude` 引擎”改动白名单（Input: `proposal.md`/`design.md`；Output: 触点文件清单；Verification: `rg -n "activeEngine === \\\"codex\\\"|askuserquestion|requestUserInput" src/features/messages src/features/threads src/features/app`）。
- [x] 1.2 [P0][depends:1.1] 核对 Claude AskUserQuestion 事件形态与前端消费契约（Input: `src-tauri/src/engine/claude.rs` + `src-tauri/src/engine/events.rs` + `useAppServerEvents.ts`；Output: 字段映射清单；Verification: 字段包含 `threadId/turnId/itemId/questions/id` 且无新增协议字段）。

## 2. Claude 提问卡片渲染入口修复

- [x] 2.1 [P0][depends:1.2] 放开 `Messages.tsx` 的提问卡片渲染条件至 `claude`（Input: `src/features/messages/components/Messages.tsx`；Output: Claude 会话可显示 `RequestUserInputMessage`；Verification: Claude 场景渲染测试通过且 `codex` 既有测试不回归）。
- [x] 2.2 [P0][depends:2.1] 保持线程/工作区隔离过滤逻辑一致（Input: `RequestUserInputMessage.tsx` 当前过滤逻辑；Output: Claude 仅显示 active thread 请求；Verification: 跨线程切换测试中不串卡）。
- [x] 2.3 [P1][depends:2.1] 补齐空问题列表在 Claude 路径的空态与可提交行为（Input: `RequestUserInputMessage.tsx`；Output: `questions=[]` 仍可提交；Verification: 空态 + 提交单测通过）。

## 3. AskUserQuestion 工具块降噪与语义对齐

- [x] 3.1 [P0][depends:2.1] 调整 `askuserquestion` 工具块提示门禁，避免 Claude 展示误导性 `Plan mode` 阻断文案（Input: `GenericToolBlock.tsx`；Output: `activeEngine=claude` 且当前线程存在 pending `requestUserInput` 时不以阻断提示作为主信息；Verification: 工具块快照/断言测试通过）。
- [x] 3.2 [P1][depends:3.1] 在工具渲染链路补充引擎上下文传递（必要时）以支持 Claude 专属降噪策略（Input: `ToolBlockRenderer.tsx` + 调用链；Output: 可判定当前工具行所属引擎；Verification: 类型检查通过且非 Claude 栈渲染不变）。

## 4. 提交闭环与回归测试

- [x] 4.1 [P0][depends:2.1] 验证并补强 Claude 提交回传路径（Input: `useThreadUserInput.ts` + `src/services/tauri.ts` + `codex/mod.rs`；Output: 提交成功出队、失败保留重试；Verification: `useThreadUserInput` 相关测试覆盖成功/失败分支）。
- [x] 4.2 [P0][depends:2.2,3.1] 新增/更新 `Messages` 与工具块测试覆盖 Claude AskUserQuestion GUI 闭环（Input: `Messages.test.tsx`、`GenericToolBlock.test.tsx`、`chatCanvasSmoke.test.tsx`；Output: 渲染/提交/提示三类测试；Verification: 目标测试文件全部通过）。
- [x] 4.3 [P0][depends:4.2] 增加“其他引擎不回归”断言（Input: 现有 codex/opencode/gemini 测试基线；Output: 引擎隔离回归用例；Verification: 非 Claude 场景快照与行为断言一致）。

## 5. 质量门禁与回滚预案

- [x] 5.1 [P0][depends:4.3] 执行前端质量门禁（Input: 全量前端改动；Output: 测试与类型检查报告；Verification: `pnpm vitest run <affected-tests>` 与 `pnpm tsc --noEmit` 通过）。
- [x] 5.2 [P1][depends:5.1] 记录可回滚点（Input: 本次改动文件列表；Output: 一步回退策略“恢复 codex-only 提问卡片渲染条件”；Verification: 回滚后不影响现有 codex 提问流程）。
