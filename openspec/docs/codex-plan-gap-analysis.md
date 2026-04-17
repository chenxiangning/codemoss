# Codex Plan 模式对齐差距分析（仅 Codex 引擎）

- 文档日期：2026-03-02
- 结论类型：调研与执行规划（不改代码）
- 范围边界：**只影响 `codex` 引擎**，不触碰 `claude/opencode` 路径

## 1. 目标

对比：
- 官方 `Codex.app` 的 Plan 模式前后端实现
- 当前项目 `codex` 引擎 Plan 实现

产出：
- 差距清单
- 对齐执行计划（仅限 codex）

## 2. 官方 Codex.app 关键机制（已核对）

### 2.1 前端选中计划模式 -> 后端启动参数

1. 前端菜单切换 `plan-mode`
2. 发送 turn 时写入 `turn/start.collaborationMode`
3. 后端按该模式驱动后续流式 item 语义

参考（本机解包/协议）：
- `/tmp/codex-app-src-IrhRIz/webview/assets/index-CjSNJoGs.js`
- `/tmp/codex-proto-ts-e9wRkO/v2/TurnStartParams.ts`

### 2.2 流式输出语义（Plan 时间线）

官方时间线主要围绕：
- `plan -> proposed-plan`
- `planImplementation -> plan-implementation`
- `implement-plan:*` 行为触发

### 2.3 何时弹用户输入框（requestUserInput）

触发链：
1. 收到 `item/tool/requestUserInput`
2. 前端转成 `userInput` item
3. 只有 `type === userInput && completed !== true` 才作为待处理请求
4. 用户提交后回 `mcp-response`，后端继续流

协议参考：
- `/tmp/codex-proto-ts-e9wRkO/ServerRequest.ts`
- `/tmp/codex-proto-ts-e9wRkO/v2/ToolRequestUserInputParams.ts`
- `/tmp/codex-proto-ts-e9wRkO/v2/ToolRequestUserInputResponse.ts`
- `/tmp/codex-proto-ts-e9wRkO/v2/ThreadActiveFlag.ts`

## 3. 当前项目 codex 引擎实现现状

项目：
- `/Users/chenxiangning/Library/Application Support/com.zhukunpenglinyutong.codemoss/worktrees/d029a8f4-f4ba-4be1-8fad-8fa3096f8f2e/codex-2026-03-02-v0.2.1`

### 3.1 前端 Plan 开关与发送

- Plan 开关仅在 `selectedEngine === "codex"` 显示
- 发送消息时会带 `collaborationMode`，并有 `default -> code` 映射层

关键文件：
- `src/features/composer/components/ComposerInput.tsx`
- `src/features/collaboration/hooks/useCollaborationModeSelection.ts`
- `src/features/threads/hooks/useThreadMessaging.ts`
- `src/services/tauri.ts`

### 3.2 用户输入请求（requestUserInput）

- 已接收并入队 `item/tool/requestUserInput`
- UI 仅展示 active thread 的队首请求
- 提交后调用 `respond_to_server_request`

关键文件：
- `src/features/app/hooks/useAppServerEvents.ts`
- `src/features/threads/hooks/useThreadsReducer.ts`
- `src/features/app/components/RequestUserInputMessage.tsx`
- `src/features/threads/hooks/useThreadUserInput.ts`

### 3.3 后端策略

- 存在 `collaboration policy` 包装与模式兼容逻辑
- 存在项目特有的阻断/合成请求逻辑（非官方原生语义）

关键文件：
- `src-tauri/src/codex/collaboration_policy.rs`
- `src-tauri/src/shared/codex_core.rs`
- `src-tauri/src/backend/app_server.rs`

## 4. 差距结论（只看 codex）

整体对齐度（估算）：**约 60%**。

### 4.1 主要差距

1. 枚举语义层：当前有 `default -> code` 兼容映射，官方更直接 `code/plan`。
2. Plan 时间线语义：当前偏 `turn/plan/updated` 面板模型，官方更偏 item 时间线模型（`proposed-plan/plan-implementation`）。
3. `requestUserInput.completed` 生命周期：当前实现有队列/UI逻辑，但与官方“未 completed 才待处理”的语义仍需严格收口。
4. 模式阻断策略：当前项目有本地增强（blocker/合成请求），与官方纯协议行为存在偏差。
5. 多窗口 follower 通道：官方有线程 follower 通道，当前项目未见等价实现。

## 5. 仅 Codex 引擎的执行计划（先不改代码）

### 包 1：边界冻结（0.5 天）

目标：把“仅 codex 影响”固化为改动门禁。

交付：
- 触点白名单（仅 codex 分支/通道）
- 非 codex 回归清单

### 包 2：协议语义对齐设计（1 天）

目标：收敛 `collaborationMode` 与 turn 启动语义。

交付：
- 字段级差异矩阵
- 迁移/兼容/回滚策略

### 包 3：Plan 时间线渲染对齐设计（1 天）

目标：引入官方 item 语义映射（`proposed-plan` / `plan-implementation`）。

交付：
- 事件 -> 状态机设计
- 仅 codex 渲染分支变更点

### 包 4：requestUserInput 生命周期对齐（1 天）

目标：严格按 `completed` 语义驱动弹窗与队列。

交付：
- 触发条件真值表
- 异常路径（取消/超时/重复）规则

### 包 5：后端策略分层（1 天）

目标：把本地增强策略做成 codex 专属可切换层。

交付：
- `official-compatible` / `strict-local` 策略设计
- 事件与错误码映射

### 包 6：回归门禁（0.5 天）

目标：证明只影响 codex。

交付：
- 三引擎对照用例（codex/claude/opencode）
- 非 codex 不变性验收项

## 6. 验收标准（必须同时满足）

1. `activeEngine !== "codex"`：发送、渲染、工具请求、弹窗行为与现状一致。
2. `activeEngine === "codex"`：Plan 与 `requestUserInput` 行为符合官方协议语义。
3. 回滚能力：任一阶段可通过 feature flag 退回现网行为（仅 codex 范围）。

## 7. 本文档定位

- 这是“对齐蓝图”，不是代码实现说明。
- 下一步如进入实施，应基于本文档拆成逐文件任务单与测试清单。
