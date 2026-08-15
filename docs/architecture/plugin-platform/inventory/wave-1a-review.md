# Wave 1A Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-v1-framing`  
> 结论：**方向正确，颗粒度合格。不进入 Host。下一刀才是 `extension-host-activation-supervisor`。**

## 方向

| 检查 | 结果 |
|---|---|
| 只做编解码 | 通过。无 listen / bind / spawn / QuickJS |
| 字节与 `14` §13 对齐 | 通过。MXPC/MXPD magic 大端、length 小端、1 MiB、32/8MiB 窗口 |
| fail closed | 通过。NDJSON / bad magic / reserved flags / unknown codec / nonce 漂移均拒绝 |
| 不接生产 | 通过。无 AppShell、无 `command_registry` |
| 未拔插头 | 通过。Claude / Notes 未动 |

## 颗粒度

Wave 1 被拆成 1A framing，而不是「Host + IPC + Broker」一次做完。这是刻意的：socket 本体必须先有可测的舌头。

**本阶段不做、留给 1B 的：**

- Named Pipe / UDS / framed stdio
- Extension Host 进程/supervisor
- QuickJS Worker
- Broker 只读 API
- generation token / kill switch

## 偏差

1. invalid 用例主要写在单测里，没有给每个 error code 单独落 `fixtures/ipc/invalid/*.json`。可接受：hex 由 encode 现场生成更不容易漂；若 1B 要跨语言 conformance，再补 dump。
2. handshake 校验是纯函数，没有 2s 超时。超时属于 transport，归 1B。

## 下一阶段边界（锁定）

`extension-host-activation-supervisor` 只允许：

- 用本 change 的 codec 说话
- 默认关闭，不接真实插件
- 零产品行为变化

禁止顺手做 Storage、Marketplace、Claude。
