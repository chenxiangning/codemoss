# Claude 进程管理迁移 gap 盘点（P4.7 前置）

> 类型：架构事实勘定（evidence）  
> 关联：`engine-claude-runtime-driver`（OpenSpec change）、`real-uninstall-dependency-chain.md`  
> 用途：把「把 Claude 迁到插件运行时」这一动作，从模糊的"替换 driver"精确化为可核对的语义 gap 清单。

## 一、两边进程管理语义对比（代码事实）

| 维度 | `ClaudeSession`（Core，待迁出） | `RestrictedProcessDriver`（插件运行时，目标） |
|---|---|---|
| 进程粒度 | **turn 级多进程**：`active_processes: Mutex<HashMap<String, Child>>`，key 是 `turn_id` | **entry 级单进程**：`children: HashMap<ChildKey, Child>`，key 是 `(plugin_id, entry_id, generation)` |
| 进程终止 | **进程组 kill**：`force_kill_process_group`（`setpgid` + `libc::kill(-pid, SIGKILL)`，Windows 用 `taskkill /T /F`） | **单 child kill**：`kill_child`（`child.kill()` + `wait()`） |
| 中断语义 | `interrupt()` 先置 `interrupted` 标志再 drain 全部 turn 进程，逐个 `terminate_child_process` + `clear_turn_ephemeral_state` | `disable()` 反向拓扑 `driver.stop` 每个 started entry |
| 生命周期绑定 | 绑定 `turn_id`（会话内一个 turn 一段生命周期） | 绑定 `generation`（activation 一次一个 generation） |
| 清理 fallback | `Drop` 里 `try_lock` 失败则跳过（有 `active_processes` 锁竞争兜底日志） | `Drop` 遍历 children kill |

## 二、迁移的核心语义 gap（必须先解决才能迁）

1. **多进程 vs 单进程**：Claude 一个 turn 可能 spawn 多个 CLI 子进程（如 claude-cli + claude-helper），而 `RestrictedProcessDriver` 的 catalog 是 `(plugin_id, entry_id)` 二维，不天然表达"turn 级进程组"。迁移需在插件运行时引入"turn 级进程组"概念，或让每个 turn 对应一个 activation generation。

2. **进程组 kill 语义**：Claude 用 `setpgid` + `SIGKILL` 整组杀（确保孙进程也死），driver 是单 child kill。插件运行时的 RestrictedProcess 若 spawn 了会 fork 孙进程的 CLI，必须补进程组 kill，否则泄漏孤儿进程。

3. **turn 生命周期 vs generation 生命周期**：Claude 进程绑定 `turn_id`，插件运行时绑定 `generation`。两者不是同一概念，迁移需建立映射（一个 turn = 一个 generation activation），否则 interrupt/disable 会杀错对象。

4. **中断标志与 ephemeral state**：Claude 的 `interrupt` 有 `interrupted` 标志 + `clear_turn_ephemeral_state`，插件运行时的 `disable` 无此语义。迁移需把这些带过去，否则 interrupt 后残留状态。

## 三、结论

「把 Claude 迁到插件运行时」不是"换个 driver 可执行文件路径"，而是要**在插件运行时补齐 turn 级多进程编排 + 进程组 kill + turn↔generation 映射 + 中断状态清理**四类语义。这四类 gap 是 P4.7 的真实工作量，也是"真实卸载 = 停掉真实进程组"的技术前提。

## 四、不变量

1. 在补齐上述 gap 前，不得把生产 `ClaudeSessionManager` 替换为 `RestrictedProcessDriver`——否则会泄漏孤儿进程、杀错进程、残留中断状态。
2. 真实 CLI 环境的 stream/interrupt/rollback conformance 验收，是这四类 gap 补齐后的独立 gate。
