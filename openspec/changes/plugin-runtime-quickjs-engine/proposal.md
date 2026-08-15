# Proposal: plugin-runtime-quickjs-engine

> Wave：1QJ5（插座本体 · 嵌入 per-plugin QuickJS C 引擎）  
> 依赖：1QJ4 Manifest kind、1QJ6 handshake-before-live、1QJ7 私有 UDS  
> 论文对齐：隔离 = 独立上下文；eval 必须发生在该上下文，而不是 Host 字符串闸门假装执行。

## Why

1QJ1–1QJ4 / 1QJ6–1QJ7 只建了 isolate 目录和握手。`eval` 仍是 Rust 字符串 allowlist，没有 JS Runtime。合同要求普通 Worker 跑在 Host 内嵌的 per-plugin QuickJS。没有 C 引擎就没有独立执行面。

## 边界

1. 每个 live Worker isolate MUST 拥有独立 QuickJS Runtime + 执行线程。
2. `eval` 在 allowlist 通过后 MUST 在该 Runtime 执行。
3. Runtime 默认只注入 `mossx.handshake.*` / `mossx.sdk.*` stub。MUST NOT 提供 `require` / `process` / `fetch` / Node builtin。
4. 非法 JS（allowlist 能过、引擎不能过）MUST fail closed，不得留下半执行。
5. `stop` / disable / 换 generation MUST drop Runtime 并 join 线程。
6. **禁止**产品切流、Marketplace、删 Claude、迁 `note_cards`。boot 仍默认 off。

## Capabilities

- `plugin-runtime-quickjs-engine-v1`
