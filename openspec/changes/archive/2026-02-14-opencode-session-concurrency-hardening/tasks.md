# Implementation Tasks: OpenCode Session Concurrency Hardening

## 1. 路由确定性（P0）

- [x] 1.1 [P0][depends: none][<=2h]
  输入：前端发送请求 payload  
  输出：新增显式 `engine` 参数透传到 `engine_send_message`  
  验证：发送请求日志可见 thread engine 与 request engine 一致。

- [x] 1.2 [P0][depends: 1.1][<=2h]
  输入：后端 `engine_send_message` 分支逻辑  
  输出：优先按请求 `engine` 路由，仅兜底用 `active_engine`  
  验证：快速切换 UI 引擎不影响既有线程发送归属。

## 2. 会话回填收敛（P0）

- [x] 2.1 [P0][depends: none][<=2h]
  输入：`onThreadSessionIdUpdated` 当前 pending 匹配  
  输出：强绑定优先（turnId/oldThreadId/engine 前缀），歧义时不迁移  
  验证：双 pending 并存不会误 rename。

- [x] 2.2 [P0][depends: 2.1][<=2h]
  输入：`ensureThread` 启发式回填路径  
  输出：降低启发式优先级，避免 active-pending 误判吞掉真实 pending  
  验证：并发场景不再出现“旧线程转圈+新线程出答复”。

## 3. 回归测试（P0）

- [x] 3.1 [P0][depends: 1.2,2.2][<=2h]
  输入：hooks/reducer 改动  
  输出：新增并发测试（至少 4 个）  
  验证：`vitest` 指定测试通过。

- [x] 3.2 [P0][depends: 3.1][<=1h]
  输入：后端路由改动  
  输出：Rust 引擎测试回归  
  验证：`cargo test --manifest-path src-tauri/Cargo.toml engine::` 通过。

## 4. 收口（P0）

- [x] 4.1 [P0][depends: 3.2][<=1h]
  输入：实现与验证结果  
  输出：更新任务勾选与验收记录  
  验证：任务状态与实际执行一致。
