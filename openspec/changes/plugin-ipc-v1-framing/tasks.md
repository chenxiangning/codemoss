# Tasks: plugin-ipc-v1-framing

优先级：P0。不依赖 Host。每项 ≤ 2 小时。

## 1. Contract fixtures

- [x] 1.1 `packages/plugin-contract/schemas/ipc/constants.v1.json` 写入 magic / version / max / window / codecs  
      验证：数字与 `14` §13 一致
- [x] 1.2 落下 valid MXPC/MXPD hex fixtures 与 handshake JSON  
      验证：TS/Rust 都能 round-trip
- [x] 1.3 落下 invalid fixtures：bad-magic、unsupported-version、truncated、payload-too-large、ndjson、reserved-flag、unknown-codec、handshake-rejected

## 2. TypeScript codec

- [x] 2.1 `src/plugin-kernel/ipc/mxpc.ts` encode/decode  
      验证：valid fixture ok；每个 invalid 有稳定 code
- [x] 2.2 `src/plugin-kernel/ipc/mxpd.ts` flags/window helper  
      验证：窗口 32 / 8MiB；超窗返回 `window-exceeded`
- [x] 2.3 handshake validator  
      验证：回显 nonce；major≠1 拒绝

## 3. Rust codec

- [x] 3.1 `src-tauri/src/plugin_runtime/ipc.rs` 读取同一 fixtures  
      验证：与 TS 对同一 invalid fixture 都失败
- [x] 3.2 不向 `command_registry.rs` 注册 command，不出现 listen/bind  
      验证：diff 不含 generate_handler / UnixListener / NamedPipe

## 4. 验收

- [x] 4.1 focused vitest + `cargo test --lib plugin_runtime::ipc`
- [x] 4.2 `openspec validate plugin-ipc-v1-framing --strict --no-interactive`
- [x] 4.3 `src/app-shell/**` 无新 import；产品行为不变
