# Wave 1 Checkpoint Review

> 日期：2026-08-16  
> 范围：1A framing + 1B Host + 1C loopback + 1D Broker stub  
> 结论：**Wave 1 的内存插排平面已闭环。** 产品行为仍为零变化。真实 listen / QuickJS / Process 另开 1E，不并进 Wave 2。

## 已交付

| 刀 | change | 证明 |
|---|---|---|
| 1A | `plugin-ipc-v1-framing` | MXPC/MXPD + handshake 纯函数 |
| 1B | `extension-host-activation-supervisor` | generation / fuse / 回滚 |
| 1C | `plugin-host-loopback-driver` | Host 用 MXPC 完成 hello/ack |
| 1D | `plugin-broker-readonly-v1` | 只读 fixture workspace；write/stale fail closed |

对照 `15` Wave 1 原文：「Host + MXPC/MXPD + Broker 只读面，现有功能零变化」——**在不进启动链的前提下已满足。**

## 方向

| 检查 | 结果 |
|---|---|
| 先插排不拔插头 | 通过 |
| 默认关闭 | 通过。`run()` 不构造 Host |
| 无 AppShell / command_registry | 通过 |
| 无真实 FS / socket / spawn | 通过 |
| 未开 Marketplace / Claude | 通过 |

## 颗粒度自评

把 Wave 1 拆成 1A–1D 是对的。若一次上 UDS+QuickJS+Broker，现在无法判断是哪一层绿。

## 明确未做（不得混进 Wave 2）

1. Named Pipe / UDS / framed stdio（**1E**）
2. QuickJS Worker / Restricted Process（**1F**）
3. Data Plane 真流（依赖 1E）
4. Host 挂进启动链（即使 default-off 也要单独 change）

## 下一阶段边界（锁定）

**Wave 2：`plugin-storage-checkpoint-v1`**  
每插件 namespace + checkpoint 形状 + fail-closed 迁移元数据。仍不迁 Notes 数据，不读用户 DB。

禁止：1E transport 与 Wave 2 同一 change；禁止 Claude / Notes 迁出。
