# Implementation Tasks: OpenCode Engine Integration

## 1. 后端检测与引擎支持范围（P0）

- [x] 1.1 [P0][depends: none] 在 `src-tauri/src/engine/status.rs` 增加 `detect_opencode_status()`。输入：可选自定义
  bin；输出：OpenCode `EngineStatus`；验证：已安装与未安装场景都返回确定结果。
- [x] 1.2 [P0][depends: 1.1] 扩展 `detect_all_engines()` 覆盖 OpenCode。输入：claude/codex/opencode bin
  配置；输出：三引擎状态列表；验证：列表含 `EngineType::OpenCode`。
- [x] 1.3 [P0][depends: 1.2] 扩展 `resolve_engine_type()` 支持 `opencode`。输入：workspace/app default engine；输出：可解析
  OpenCode；验证：传入 `opencode` 时返回 `EngineType::OpenCode`。
- [x] 1.4 [P0][depends: 1.1] 在 `src-tauri/src/engine/mod.rs` 增加 `EngineFeatures::opencode()` 与 `is_supported()` 覆盖
  OpenCode。输入：能力定义；输出：OpenCode 特性集；验证：OpenCode 不再走 unsupported 判定。

## 2. OpenCode 会话模块（P0）

- [x] 2.1 [P0][depends: 1.1] 新建 `src-tauri/src/engine/opencode.rs`，定义 `OpenCodeSession` 结构与
  `new()/subscribe()/build_command()`。输入：workspace + config；输出：可构建命令与事件通道；验证：单元测试断言命令参数包含
  `-p`、`--output-format stream-json`。
- [x] 2.2 [P0][depends: 2.1] 实现 `send_message()` 生命周期（spawn、流读取、退出清理、中断标记）。输入：`SendMessageParams`
  ；输出：流式事件；验证：正常完成发出 `TurnCompleted`，异常发出 `TurnError`。
- [x] 2.3 [P0][depends: 2.2] 实现 `parse_opencode_event()` 并映射到统一 `EngineEvent`。输入：CLI JSON 行；输出：
  `TextDelta/ToolStarted/TurnCompleted/TurnError/Raw`；验证：无效 JSON 不崩溃且保留容错日志。

## 3. EngineManager 与 Tauri 命令接入（P0）

- [x] 3.1 [P0][depends: 2.1] 在 `src-tauri/src/engine/manager.rs` 增加 OpenCode session 管理接口。输入：workspace
  id/path；输出：可获取/清理 OpenCode 会话；验证：工作区关闭时会话引用被移除。
- [x] 3.2 [P0][depends: 1.2] 在 `src-tauri/src/engine/commands.rs` 扩展 `get_engine_models()` 支持 OpenCode。输入：
  `engineType=opencode`；输出：模型列表；验证：前端下拉可读到 OpenCode 模型。
- [x] 3.3 [P0][depends: 2.2,3.1] 在 `engine_send_message()` 增加 OpenCode 分支。输入：发送参数；输出：启动回合并通过统一事件推送；验证：OpenCode
  发送不进入 Codex 分支。
- [x] 3.4 [P0][depends: 3.1] 在 `engine_interrupt()` 增加 OpenCode 分支。输入：workspace_id；输出：中断当前 OpenCode
  进程；验证：中断后停止流输出并清理状态。

## 4. 前端三路分发与 UI 状态（P0）

- [x] 4.1 [P0][depends: 3.3] 在 `src/features/threads/hooks/useThreadMessaging.ts` 将发送分发改为
  `claude/codex/opencode` 三路。输入：activeEngine；输出：独立路由；验证：`opencode` 不再调用 `sendUserMessageService`。
- [x] 4.2 [P0][depends: 3.2] 复用 `get_engine_models(engineType)`，确认前端无需新增 `get_opencode_models()`。输入：engine
  type；输出：统一模型加载路径；验证：OpenCode 模型在现有模型选择器可见。
- [x] 4.3 [P0][depends: 1.4] 在 `src/features/engine/components/EngineSelector.tsx` 将 OpenCode 纳入
  `IMPLEMENTED_ENGINES`。输入：检测状态；输出：OpenCode 从 coming soon 变为可安装/可用状态；验证：已安装时可选择。
- [x] 4.4 [P0][depends: 4.1,4.2] 确认 `useEngineController` 显示与安装态联动无回归。输入：三引擎状态；输出：显示名称、版本、可选状态正确；验证：切换不报错。

## 5. 回归测试与验证（P0）

- [x] 5.1 [P0][depends: 1.x,2.x,3.x] 新增 Rust 单元测试：检测逻辑、命令构建、事件解析容错。输入：mock 输出；输出：测试通过；验证：覆盖
  OpenCode 核心路径。
- [x] 5.2 [P0][depends: 4.x] 新增/更新前端测试：三路分发与引擎切换可用性。输入：activeEngine 场景；输出：断言调用路径正确；验证：Claude/Codex
  旧路径未变。
- [x] 5.3 [P0][depends: 5.1,5.2] 执行 `npm run typecheck && npm run lint && npm run test`，并记录结果。输入：完整改动；输出：质量门禁结论；验证：无新增
  critical 回归。
- [x] 5.4 [P0][depends: 5.3] 执行 `cargo test`（至少引擎相关测试集合）。输入：Rust 改动；输出：后端测试结论；验证：OpenCode
  测试通过且不破坏现有引擎测试。

## 6. OpenSpec 收口（P0）

- [x] 6.1 [P0][depends: 5.4] 回填 `tasks.md` 勾选状态与验证记录。输入：执行结果；输出：任务状态真实反映实现。
- [x] 6.2 [P0][depends: 6.1] 运行 OpenSpec 校验并保存结果。输入：proposal/design/tasks；输出：验证通过记录。
- [x] 6.3 [P0][depends: 6.2] 进入 verify/archive 阶段前评审。输入：完整 artifacts；输出：评审结论与归档决策。

## 验证记录（2026-02-13）

- 前端类型检查：`npm run typecheck` 通过。
- 前端静态检查：`npm run lint` 通过（存在仓库既有 warning，无新增 error）。
- 前端测试：`npm run test` 已执行；全量套件受仓库既有失败与 Node OOM 影响未全绿。
- 前端针对性回归：
  `npx vitest run src/features/threads/hooks/useQueuedSend.test.tsx src/features/threads/hooks/useThreadActions.test.tsx src/features/threads/hooks/useThreadTurnEvents.test.tsx src/features/threads/hooks/useThreadMessaging.test.tsx`
  全部通过（49/49）。
- 后端测试：`cargo test --manifest-path src-tauri/Cargo.toml engine::` 通过（25/25）。
- OpenSpec 校验：`openspec validate --changes "opencode-engine-integration" --json` 通过。
