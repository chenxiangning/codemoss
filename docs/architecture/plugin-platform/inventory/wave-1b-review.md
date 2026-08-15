# Wave 1B Self-Review

> 日期：2026-08-16  
> 范围：`extension-host-activation-supervisor`  
> 结论：**方向正确，颗粒度合格。Wave 1 未完成。下一刀才是真实 transport / Worker driver（1C），不是 Storage，也不是 Claude。**

## 方向

| 检查 | 结果 |
|---|---|
| 默认关闭 | 通过。`HostConfig.enabled` 默认 false；`lib.rs::run` 不构造 Host |
| 内存 Driver，无 IO | 通过。无 `std::net` / `Command::new` / QuickJS |
| generation 单调 | 通过。`reset` 保留计数；旧 generation `stale-generation` |
| required 失败回滚 | 通过。timeout 反向 stop 已启动 Entry |
| fuse 不自动复活 | 通过。必须 `reset` |
| 未拔插头 | 通过。Claude / Notes / AppShell 未动 |

## 颗粒度

1B 只做状态机是对的。没有把 UDS、QuickJS、Broker 业务 API 塞进来。

**本阶段不做、留给 1C 的：**

- Named Pipe / UDS / framed stdio
- QuickJS Worker 与 Restricted Process spawn
- Broker 只读 workspace API
- 把 Host 挂进启动链（即使 default-off 的 command 也要另开 change）

## 偏差

1. `activate` 吃的是 `ActivationRequest`（pluginId + required_entries），没有直接吃 `ValidatedManifest`。可接受：当前 parser 只返回 identity；closure 已在 0B TS 侧算过，1C 再把两端接上。
2. deadline 是配置上限，FakeDriver 用注入错误模拟超时，没有真 clock。1C transport 再测 10s/30s 墙钟。

## 下一阶段边界（锁定）

1C 只允许换 `EntryDriver` 实现（内存 loopback 或真 Worker），Host 状态机不重写。禁止 Storage、Marketplace、Claude。
