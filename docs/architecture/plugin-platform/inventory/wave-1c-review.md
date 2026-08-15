# Wave 1C Self-Review

> 日期：2026-08-16  
> 范围：`plugin-host-loopback-driver`  
> 结论：**方向正确。Wave 1 仍未完成。** Host 与 MXPC 已在内存里对上话。下一刀才是真实 transport 或 Broker 只读 stub，二者只能开一个。

## 方向

| 检查 | 结果 |
|---|---|
| 复用 1A codec + 1B Host | 通过。未重写状态机 |
| 内存环回 | 通过。无 listen / spawn |
| handshake 失败回滚 | 通过。`notes-ui` nonce 错时 stop `notes-worker` |
| 默认不进 boot | 通过 |
| 未拔插头 | 通过 |

## 颗粒度

1C 只证明「舌头和脑子能一起工作」。没有上 UDS，也没有 Broker。

**Wave 1 还缺（按风险从低到高，下一刀只开一项）：**

1. Broker 只读 stub（workspace path fixture，无真实 FS）
2. 真 transport（UDS / Named Pipe / framed stdio）
3. QuickJS Worker driver

推荐下一刀：**1D Broker 只读 stub**。transport/QuickJS 更容易和产品进程缠在一起，应再拆一刀。

## 偏差

handshake 失败在 driver 层映射为 `Crash`，Host 对外仍是 `activation-failed`。1D 可把 `DriverError` 加上 `Handshake` 变体，不在本 change 膨胀。
