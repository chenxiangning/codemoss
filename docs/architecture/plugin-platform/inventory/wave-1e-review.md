# Wave 1E Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-uds-loopback`  
> 结论：**方向正确。停在注入路径 UDS 成帧。** 未接 Host driver，未 spawn QuickJS。下一刀才是 UDS EntryDriver（1E2）或 framed stdio，禁止并进产品导入。

## 方向

| 检查 | 结果 |
|---|---|
| MXPC 过真实 UDS | 通过。hello/ack 往返 |
| 路径注入 | 通过。测试用短 `/tmp/mx*.s`（避开 `SUN_LEN`） |
| 无 TCP | 通过。只用 `UnixListener` / `UnixStream` |
| 无 spawn / 无 boot | 通过 |
| 不迁 Notes / 不 disable Claude | 通过 |

## 证明

- `cargo test --lib plugin_runtime::uds`：2 passed
- 坏 nonce 的 ack 经 UDS 读回后仍被 `validate_handshake_ack` 拒绝
- `openspec validate plugin-ipc-uds-loopback --strict --no-interactive`

## 颗粒度

1E 只证明 bytes 能过 socket。没有把 Host 激活改走 UDS，也没有上 QuickJS。这是对的：transport 故障必须能单独回滚。

## 明确未做

1. Host `EntryDriver` 走 UDS（**1E2**）
2. Windows Named Pipe
3. framed stdio
4. QuickJS Worker / Restricted Process（**1F**）
5. Host 挂进启动链
6. Notes / Claude 产品切流

## 下一阶段边界（锁定）

**1E2：UdsHandshakeDriver 接 Host，仍不 spawn。**  
或停在本评审点。禁止从此处导入 `note_cards`、禁止 disable Claude、禁止 Marketplace。
