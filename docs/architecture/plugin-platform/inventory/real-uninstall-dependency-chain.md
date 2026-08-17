# 插件「真实卸载」依赖链现状勘定（2026-08-16）

> 类型：架构事实勘定（evidence，非实现）  
> 关联：`09-decision-log.md` D-049、`15-implementation-wave-plan.md`、`08-migration-roadmap-and-tasks.md`

## 一、结论

「真实卸载」尚未达成，但不是因为运行时缺失——**真实运行时已完整实现**，而是因为整条链被刻意隔离在生产路径之外（default-off + 生产引擎未接入）。要达成真实卸载，需把生产引擎接到真实运行时，而非补市场 UI 或后端命令。

## 二、事实链（代码证据，2026-08-16 复核）

| 层 | 现状 | 证据 |
|---|---|---|
| 市场 UI | 12 declared plugs；**Notes + Claude + Project Map** 有安装/卸载按钮。远程 Marketplace 仍关 | `PluginRackSection.tsx`；D-052 |
| 后端命令 | `get_plugin_rack_snapshot` + Notes/Claude/Map `install_plugin` / `uninstall_plugin` | `plugin_rack.rs` |
| **Extension Host** | **真实实现**（in-memory，无 socket/spawn；含 `interrupt` 非终态中断） | `host.rs` "In-memory Extension Host supervisor" |
| **Restricted Process** | **真实实现**（`Command::spawn` + handshake + env 注入 + memory limit + cwd 校验；含 `process_group(0)` + 进程组 `SIGKILL`） | `spawn.rs` `spawn_child` / `kill_child` |
| **QuickJS Worker** | **真实实现**（`rquickjs::Runtime` 真 C 引擎） | `quickjs.rs` "Real C engine" |
| **CompositeDriver** | **真实组合** process + worker | `composite.rs` |
| 运行时是否接入生产 | **否** —— 全链标 "not in product path / not in boot" | 各文件头注释 |
| boot 默认态 | `HostConfig::default()`（enabled:false）+ `boot_driver()` 用 `missing_executable()` | `boot.rs` "Default-off Host construction... No product activation" |
| Claude pilot | **fixture 假激活**，不调生产 `engine::claude` | `claude_pilot.rs` "Does not call production engine::claude" |
| Claude 门面 | **delegate-to-Core**，flag 默认 off，产品走 `ClaudeSessionManager` | `claude_compat.rs` |
| Host 状态机 | `Idle/Activating/Ready/Failed/Fused/Disabled`，**缺 `Uninstalled`** | `host.rs` `SlotState` |
| OpenSpec | 247 个 plugin change 全 implemented，全是 facade/inventory/fixture + 真实运行时骨架 | `openspec/changes/README.md` |

## 三、真实卸载依赖链（修正版）

```
已建好：真实 Host + RestrictedProcess + QuickJS Worker + CompositeDriver（default-off）
  → 缺口 1a：Claude Process Entry 身份（✅ Manifest 平台路径 + MXPC peer）
  → 缺口 1a2：Process Entry 封闭 supervise CLI（✅ 本批：同进程组，interrupt 杀组）
  → 缺口 1b：claudeBin → supervise 映射（✅ 本批：default-off，不替换生产 spawn）
  → 缺口 1c：生产 SpawnPlan（bin+argv+cwd）接线（✅ 本批：flag 开 fail closed，默认仍 cmd.spawn）
  → 缺口 1d：封闭 MXPC 中继 CLI stdin/stdout（✅ 本批：echo/cat 可读可写，不切产品 stream）
  → 缺口 1e：产品 turn IO 合同（写/关/读到 EOF）（✅ 本批：run_supervised_turn_io，不切 send_message）
  → 缺口 1f：增量行读 + stderr 中继（✅ 本批：next_line / read-stderr，不切 send_message）
  → 缺口 1g：产品行读循环合同（✅ 本批：stream_loop + first-event timeout，不切 send_message）
  → 缺口 1h：产品行源 dual-run 开关（✅ 本批：decide_claude_line_source，默认 Tokio）
  → 缺口 1i：产品 turn 句柄（✅ 本批：flag-on 真 spawn Process Entry；行读未切则杀组）
  → 缺口 1j：产品行读接到 cursor（✅ 本批：flag-on next_claude_line / poll_line；默认仍 Tokio）
  → 缺口 1k：resume 闸门（✅ 本批：flag-on 拒绝第二条 Core Child）
  → 缺口 1l：resume 再走 Process Entry（✅ 本批：try_resume_process_entry_turn）
  → 缺口 1m：收割 exit-status（✅ 本批：mossx.process.wait；非零不当成功）
  → 缺口 1n：可激活制品（✅ 本批：build.rs 编到 OUT_DIR；源码仓仍无 bin）
  → 缺口 1o：制品根 first-event / interrupt 闸门（✅ 本批：echo 先行，sleep 超时杀组）
  → 缺口 1p：真实 CLI first-interactive（✅ 本批：制品根读到 system/init 后杀组；缺 CLI 跳过）
  → 缺口 1q：真实 CLI result / 退出码（✅ 本批：制品根读到 result 且 wait=0；缺 CLI 跳过）
  → 缺口 1r：dual-run 默认 Core（✅ 本批：两旗默认关；flag-on 才走 PE；boot 仍 missing）
  → 缺口 1s：产品默认走 Process Entry（✅ 本批：未设即 on；0 回 Core；boot 仍 missing）
  → 缺口 1t：Notes 存量一次性导入（✅ 本批：flag-on 首次扫 note_card json；源文件保留）
  → 缺口 1u：Notes 产品默认隔离 sqlite（✅ 本批：未设即 on；0 回文件）
  → 缺口 1v：Host supervisor 独立进程（✅ 本批：OUT_DIR 制品；连接仍 host-disabled；不激活产品）
  → 缺口 1w：插排只读报产品通电（✅ 本批：circuit/productPath + supervisor pid；Host slot 仍 idle）
  → 缺口 1x：Disable-not-delete（✅ 本批：默认 Core owner disabled；源码与 0 回退保留）
  → 缺口 1y：Slim / Marketplace 仍禁止
  → 缺口 4a：第三根插头知识地图 Inventory（✅ 本批：`com.mossx.project-map` 只盘点；re-export ≠ 抽出）
  → 缺口 4b：知识地图 Contract（✅ 本批：`project-map-pilot.json` exact 24 command + view/panel；不接 Host）
  → 缺口 4c：知识地图 Adapter（✅ 本批：`ProjectMapCompatAdapter` exact 24 command；默认 off；不接 Host；不假装装/卸）
  → 缺口 4d：知识地图 Dual-run（✅ 本批：24 command 经门面切流；产品默认隔离 sqlite）
  → 缺口 4e：知识地图 Conformance + Disable（✅ 本批：默认 Core owner disabled；源码与 0 回退保留）
  → 缺口 4f：知识地图真实装/卸（✅ 本批：D-052 allowlist + 第三组按钮；可视化插排另开）
  → 缺口 2：SlotState 补 Uninstalled（✅ 已补）+ atomic contribution registry（✅ Notes 集：`notes.main` + 7 `note_card_*`）
  → 缺口 2b：Notes allowlisted 真实装/卸（✅ 本批：lockfile + `activate_allowlisted` + restore + 闸门；D-050）
  → 缺口 2c：Claude allowlisted 真实装/卸（✅ 本批：worker-only lifecycle + spawn 闸门先于 decide；D-051）
  → 缺口 3：Notes owner 复核（✅ P4.7-19）
  → 缺口 3b：隔离 Notes CRUD（✅ P4.7-21）
  → 缺口 3c：flag-on 走隔离 sqlite（✅ P4.7-22）
  → 缺口 3d：隔离 rollback 恢复 note 行（✅ 本批：checkpoint 后 delete → restore 拿回原行）
  只有 1b 完成，「卸载」才等于停掉产品引擎
```

## 四、不变量

1. 真实运行时已存在但 default-off，是**安全闸门**（boot 用 `missing_executable()` 保证不误 spawn），不是缺陷。
2. 在「生产引擎接入真实运行时」之前，任何「卸载」都是改标志位，不停任何东西。
3. 市场 UI 的卸载能力必须在缺口 1+2 完成后接入，否则重蹈 D-049 覆辙。

## 五、正确下一步（P4.7 前置）

**缺口 1a（本批）**：Claude Process Entry 从「测试里手塞绝对路径」升级为「Manifest `platforms[PlatformId]` 解析出的 Host 拥有 peer」。不改生产 `engine/claude.rs`。

**缺口 1b（下一批）**：把生产 `engine::claude` 的 CLI spawn / interrupt 映射到该 Process Entry，再跑真实 CLI stream/interrupt/storage/rollback conformance。

这一步需独立 OpenSpec proposal，高风险，须严格按 `15` §3 切换协议走（当前已走到 step 6 Conformance，下一步 step 7 Disable）。

### 运行时侧前置进度（2026-08-16 更新）

迁移的运行时侧四类语义已补齐，剩余工作全部是迁入方 + 真实 CLI 验收（详见 [`claude-process-migration-gap.md`](claude-process-migration-gap.md)）：

| gap | 状态 | 落地 |
|---|---|---|
| 进程组 kill | ✅ | `spawn.rs` `process_group(0)` + `kill_child` 整组 `SIGKILL`（`cargo test --lib plugin_runtime::spawn` 23/23） |
| turn↔generation 映射 | ✅ | `generation` 单调递增句柄承载 turn 句柄，`dispatch` 校验 |
| 中断状态清理 | ✅ | `host.rs` `interrupt` 非终态中断（`cargo test --lib plugin_runtime::host` 27/27） |
| 多进程编排 | ✅ | entry 粒度 + 进程组覆盖「leader + 孙进程组」 |
| 卸载终态 | ✅ | `host.rs` `SlotState::Uninstalled` + `Host::uninstall` 不可恢复卸载（`cargo test --lib plugin_runtime` 287/287） |

真实 CLI 环境的 stream/interrupt/rollback conformance 验收仍是独立 gate，未过验收前不得宣称生产 conformance 达成、不得删 `engine/claude*`。
