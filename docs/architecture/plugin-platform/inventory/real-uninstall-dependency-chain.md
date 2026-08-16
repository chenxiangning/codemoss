# 插件「真实卸载」依赖链现状勘定（2026-08-16）

> 类型：架构事实勘定（evidence，非实现）  
> 关联：`09-decision-log.md` D-049、`15-implementation-wave-plan.md`、`08-migration-roadmap-and-tasks.md`

## 一、结论先行

「真实卸载」在 mossx 当前工作树里**尚未达成**，且不是靠市场 UI 或后端命令能补齐的——它缺的是**真实插件运行时**本身。当前所谓的插件化，从市场到运行时，全部是 fixture 级骨架，从未把真实引擎/功能接到运行时上跑。

## 二、事实链（代码证据）

| 层 | 现状 | 证据 |
|---|---|---|
| 市场 UI | 只读 Host 快照（12 declared plugs），无安装/卸载 | `PluginRackSection.tsx`（D-049 回退后） |
| 后端命令 | 仅 `get_plugin_rack_snapshot` 只读 | `plugin_rack.rs` 无 activate/deactivate |
| Host 状态机 | `Idle/Activating/Ready/Failed/Fused/Disabled`，**缺 `Uninstalled`** | `host.rs` `SlotState` |
| 插件运行时 | **fixture 级**：`FakeDriver` + in-memory + manifest fixture | `runtime.rs`、`claude_pilot.rs` |
| Claude 门面 | **delegate to Core**，无第二实现；flag 默认 off | `claude_compat.rs` 头注释 |
| 产品 Claude | 走 Core `ClaudeSessionManager`，门面是死路径 | `manager.rs` `claude_compat_facade_enabled() == false` |
| OpenSpec | 247 个 plugin change 全 implemented，但全是 facade/inventory/fixture | `openspec/changes/README.md` |

## 三、真实卸载的依赖链（按架构 `08` 顺序）

```
P1 真实运行时：真实 Worker/Process 接入（当前只有 FakeDriver fixture）
  → P4.7 真实迁出 Claude：把生产 engine::claude 迁到真实 Worker/Process
  → P2 lifecycle：SlotState 补 Uninstalled + atomic contribution registry
  → P5.6 真实迁出 Notes
  → 只有到这一步，「卸载」才是「停掉真实运行的插件运行时」
```

当前停在哪：**P1 的运行时仍是 fixture**（`claude_pilot.rs` 明确 "Does not call production engine::claude"）。所以 P4.7/P2/P5.6 全部无法启动——没有真实运行时可迁、可停。

## 四、不变量

1. 在「真实运行时」落地前，任何「卸载」都是假的（改标志位，不停任何东西）。
2. 市场 UI 的「卸载」能力必须在 P4.7 + P2 完成后再接入，否则重蹈 D-049 覆辙。
3. Claude 门面当前是 delegate 死路径，flag-on 不会让 Claude 跑在插件运行时里——它只是换了个调用入口，仍用同一个 `ClaudeSessionManager`。

## 五、正确的下一步

**P1 收尾：把真实 Worker/Process 运行时从 fixture 升级到真实**，这是整条链的根。具体第一个动作是让 `claude_pilot` 从"manifest fixture 假激活"升级为"真实 Restricted Process 执行 engine::claude"，并跑通 stream/interrupt/storage/rollback conformance（`08` §P1 验收）。

这一步需要独立 OpenSpec proposal，且涉及真实进程生命周期与数据一致性，风险高，须严格按 `15` §3 切换协议逐步走。
