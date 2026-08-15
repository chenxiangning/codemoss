# Proposal: plugin-host-boot-uds-live

> Wave：1H9（插座本体 · boot supervisor 必须在 Host 存活期间值守）  
> 依赖：1H8 drain、1HS10 timed write  
> 论文对齐：supervisor socket 是获取；默认 off 也必须主动拒绝，不得等人调用。

## Why

1H7 / 1H8 的 reject / drain 要测试代码主动调用。真实 boot 只 `manage(BootHost)`，没有人去抽连接。意外客户端会一直堵在 backlog。这不是 supervisor。

## 边界

1. Unix `boot_host()` MUST 启动值守线程。
2. 客户端 connect 后 MUST 在 handshake deadline 内收到 `host-disabled`，无需调用 `reject_unexpected`。
3. MUST NOT spawn / isolate / 改 slot。
4. BootHost drop MUST 停线程并 unlink。
5. 不切产品，不接受业务 hello。

## Capabilities

- `plugin-host-boot-uds-live-v1`
