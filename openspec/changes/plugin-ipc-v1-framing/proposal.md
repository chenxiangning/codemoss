# Proposal: plugin-ipc-v1-framing

> OpenSpec change id: `plugin-ipc-v1-framing`  
> Wave：1A（插排本体 · 纯编解码）  
> 架构：[`docs/architecture/plugin-platform/14-v1-contract-freeze.md`](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md) §13  
> 对照：[`10-ipc-transport-and-wire-protocol.md`](../../../docs/architecture/plugin-platform/10-ipc-transport-and-wire-protocol.md)  
> 依赖：`plugin-manifest-v1-parser` 已落地；本 change 不依赖 Host。

## Why

Manifest 已经能解析，但 Host 还不能说话。若先写 supervisor / socket，会各自发明 framing。`14` §13 已冻结 MXPC/MXPD 字节布局、codec、handshake 与窗口。第一块 Wave 1 代码必须是 **不听端口、不 spawn、不改产品** 的编解码 + fixtures。

## 目标与边界

1. 按 `14` §13.1–§13.4 实现 MXPC / MXPD encode/decode。
2. 非法 magic、version≠1、截断、`payload_len>1MiB`、NDJSON、保留 flags≠0、未知 codec：fail closed。
3. handshake 只校验 JSON-RPC 形状（`mossx.handshake.hello` / 回显 nonce / `protocolVersion=1`），不建连。
4. 窗口常量冻结：32 帧或 8 MiB；codec 仅 `engine-event-v1` / `blob-v1` / `log-v1`。
5. 不创建 Named Pipe / UDS / stdio、不注册 Tauri command、不接 AppShell。

## 非目标

- Extension Host / QuickJS / Restricted Process supervisor
- Capability Broker 只读 API
- Storage / checkpoint
- Claude / Notes 迁出
- compression / shm / 跨进程 resume / local TCP（V1 关闭）

## 技术方案对比

| 方案 | 做法 | 取舍 |
|---|---|---|
| A. 先写 Host 再补 framing | 边做边定字节 | 与 `14` 漂移，Rust/TS 两套 header |
| B. 直接上 UDS + 真进程 | 看起来像 Wave 1 完成 | 颗粒度过大，无法独立回滚 |
| **C. 纯编解码 + 共享 fixtures（采用）** | `packages/plugin-contract/fixtures/ipc` | 慢半步，但可独立验收 |

## Capabilities

### New Capabilities

- `plugin-ipc-mxpc-v1`：Control frame 编解码与 JSON-RPC payload 上限
- `plugin-ipc-mxpd-v1`：Data frame、flags、窗口、codec allowlist
- `plugin-ipc-handshake-v1`：`mossx.handshake.hello` 形状与 nonce 回显

## Impact

- 新增 `packages/plugin-contract/schemas/ipc/*.json` 与 `fixtures/ipc/**`
- 新增 TS `src/plugin-kernel/ipc/*` 与 Rust `src-tauri/src/plugin_runtime/ipc.rs`
- 测试：合法帧 round-trip；`14` 列出的拒绝用例全部失败
- 不改 `command_registry.rs`、不改 `src/app-shell/**`

## 验收标准

1. MXPC magic `0x4D585043`、MXPD magic `0x4D585044`，version=1，length little-endian。
2. `payload_len > 1048576`、截断、错误 magic、newline JSON：拒绝且不产出部分消息。
3. MXPD reserved flags、未知 codec、未 `data.open` 语义下的“裸 MXPD”由 codec 层标记为 `data-before-open`（本 change 提供纯函数，不跑 Host）。
4. handshake 缺 nonce / 不回显 / major≠1：拒绝。
5. `openspec validate plugin-ipc-v1-framing --strict --no-interactive` 通过。
6. 现有产品行为不变。
