# 插件「真实卸载」依赖链现状勘定（2026-08-16）

> 类型：架构事实勘定（evidence，非实现）  
> 关联：`09-decision-log.md` D-049、`15-implementation-wave-plan.md`、`08-migration-roadmap-and-tasks.md`

## 一、结论

「真实卸载」尚未达成，但不是因为运行时缺失——**真实运行时已完整实现**，而是因为整条链被刻意隔离在生产路径之外（default-off + 生产引擎未接入）。要达成真实卸载，需把生产引擎接到真实运行时，而非补市场 UI 或后端命令。

## 二、事实链（代码证据，2026-08-16 复核）

| 层 | 现状 | 证据 |
|---|---|---|
| 市场 UI | 只读 Host 快照（12 declared plugs），无安装/卸载 | `PluginRackSection.tsx` |
| 后端命令 | 仅 `get_plugin_rack_snapshot` 只读 | `plugin_rack.rs` |
| **Extension Host** | **真实实现**（in-memory，无 socket/spawn） | `host.rs` "In-memory Extension Host supervisor" |
| **Restricted Process** | **真实实现**（`Command::spawn` + handshake + env 注入 + memory limit + cwd 校验） | `spawn.rs` `spawn_child` |
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
  → 缺口 1：把生产 engine::claude 接到真实运行时（当前只有 fixture 假激活 + delegate 门面）
  → 缺口 2：SlotState 补 Uninstalled + atomic contribution registry（P2.1）
  → 缺口 3：Notes 同理（P5）
  只有到这一步，「卸载」=「停掉真实运行的插件运行时」
```

## 四、不变量

1. 真实运行时已存在但 default-off，是**安全闸门**（boot 用 `missing_executable()` 保证不误 spawn），不是缺陷。
2. 在「生产引擎接入真实运行时」之前，任何「卸载」都是改标志位，不停任何东西。
3. 市场 UI 的卸载能力必须在缺口 1+2 完成后接入，否则重蹈 D-049 覆辙。

## 五、正确下一步（P4.7 前置）

**缺口 1：建立 Claude 真实运行时接入**——把 `claude_pilot` 从 "manifest fixture 假激活" 升级为 "真实 RestrictedProcess 执行生产 `engine::claude`"，跑通 stream/interrupt/storage/rollback conformance（`08` §P1 验收）。

这一步需独立 OpenSpec proposal，高风险，须严格按 `15` §3 切换协议走（当前已走到 step 6 Conformance，下一步 step 7 Disable）。
