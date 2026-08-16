# Claude 进程管理迁移 gap 盘点（P4.7 前置）

> 类型：架构事实勘定（evidence）  
> 关联：`engine-claude-runtime-driver`、`plugin-runtime-interrupt-semantics`（OpenSpec change）、`real-uninstall-dependency-chain.md`  
> 用途：把「把 Claude 迁到插件运行时」这一动作，从模糊的"替换 driver"精确化为可核对的语义 gap 清单。

## 一、两边进程管理语义对比（代码事实）

| 维度 | `ClaudeSession`（Core，待迁出） | `RestrictedProcessDriver`（插件运行时，目标） |
|---|---|---|
| 进程粒度 | **turn 级单 leader + 孙进程组**：`active_processes: Mutex<HashMap<String, Child>>`，key 是 `turn_id`，一个 turn 只 `insert` 一个 leader（`engine/claude.rs` L1695），leader 经 `setpgid(0,0)` 建组 fork 孙进程 | **entry 级 + 进程组**：`children: HashMap<ChildKey, Child>`，key 是 `(plugin_id, entry_id, generation)`，一个 generation 可 start 多个 entry（`required_entries`） |
| 进程终止 | **进程组 kill**：`force_kill_process_group`（`setpgid` + `libc::kill(-pid, SIGKILL)`，Windows 用 `taskkill /T /F`） | **进程组 kill**（已补齐）：`spawn_child` 用 `process_group(0)` 建组，`kill_child` 用 `libc::kill(-pid, SIGKILL)` + `taskkill /T /F` + fallback |
| 中断语义 | `interrupt()` 先置 `interrupted` 标志再 drain 全部 turn 进程，逐个 `terminate_child_process`（SIGTERM→SIGKILL）+ `clear_turn_ephemeral_state` | `interrupt()`（已补齐）非终态停进程组 + 清 `started`/`unit_id` + 回 `Idle`；`disable()` 终态停进程组 |
| 生命周期绑定 | 绑定 `turn_id`（会话内一个 turn 一段生命周期），`active_turn_id` 单值——**串行 turn** | 绑定 `generation`（activation 一次一个 generation，单调递增句柄） |
| 清理 fallback | `Drop` 里 `try_lock` 失败则跳过（有 `active_processes` 锁竞争兜底日志） | `Drop` 遍历 children kill |

## 二、迁移的核心语义 gap（运行时侧已收敛）

> 状态标注：✅ 运行时侧已补齐（含实现位置 + 验证）· 🔵 迁入方责任（Claude 迁入时随业务带过去，运行时不承载）。

1. ✅ **多进程 vs 单进程**：勘定修正——Claude 一个 turn 是「一个 leader Child + 孙进程组」而非多个 entry（`active_processes` 一个 turn 只 insert 一次，L1695）。driver 已支持一个 generation 多个 entry（`required_entries`），进程组 kill（gap 2）覆盖孙进程。运行时侧无需新增「turn 级进程组」概念。

2. ✅ **进程组 kill 语义**：`src-tauri/src/plugin_runtime/spawn.rs` 的 `spawn_child` 增加 `process_group(0)`（unix `CommandExt`），`kill_child` 改为 unix `libc::kill(-pid, SIGKILL)` 整组杀 + windows `taskkill /T /F` + `child.kill()`/`wait()` fallback。验证：`cargo test --lib plugin_runtime::spawn` 21/21（含 `later_entry_crash_kills_the_earlier_child`、`ready_reactivate_does_not_leak_old_children`）。

3. ✅ **turn 生命周期 vs generation 生命周期**：Claude 串行 turn（`active_turn_id` 单值）与 host 单 generation 模型匹配；一个 turn = 一个 generation activation，`generation` 单调递增句柄承载 turn 句柄，`dispatch(plugin_id, generation)` 已提供句柄校验。turn_id→generation 的映射是**迁入方责任**（外层把 turn_id 绑定到某次 activation 返回的 generation）。

4. ✅ **中断标志与 ephemeral state（运行时侧）**：`Host::interrupt(plugin_id, generation)` 已落地（`plugin-runtime-interrupt-semantics`）：校验句柄 → 反向拓扑 `driver.stop` 停进程组 → 清 `started`/`unit_id` → 回 `Idle` 可再次 activate。验证：`cargo test --lib plugin_runtime::host` 23/23。🔵 `interrupted` 标志与业务 ephemeral state（`tool_name_by_id`、`pending_tools` 等）是 Claude 迁入方须带过去的中断语义，通用运行时只提供 `interrupt` 入口，不承载业务状态。

## 三、结论

「把 Claude 迁到插件运行时」的**运行时侧**四类语义已全部补齐：turn 级多进程（entry 粒度 + 进程组）→ 进程组 kill → turn↔generation 映射（generation 承载句柄）→ 中断状态清理（`interrupt` 入口）。

剩余工作全部是**迁入方 + 验收**：把生产 `engine/claude.rs` 的进程管理替换为插件运行时的 activate/interrupt/disable，并把 `interrupted` 标志 + 业务 ephemeral state 清理带过去；真实 CLI 环境的 stream/interrupt/rollback conformance 是独立 gate。

## 四、不变量

1. 在迁入方完成替换并过真实 CLI conformance 前，不得把生产 `ClaudeSessionManager` 替换为 `RestrictedProcessDriver`——运行时侧语义已补齐，但迁入方映射与业务状态清理未做，且缺真实环境验收。
2. 真实 CLI 环境的 stream/interrupt/rollback conformance 验收，是迁入完成后的独立 gate。
