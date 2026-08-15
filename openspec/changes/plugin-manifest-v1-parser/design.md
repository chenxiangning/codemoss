# Design: plugin-manifest-v1-parser

## Context

`14-v1-contract-freeze.md` 是字段单一事实源。本 change 只把那份 Contract 变成可测代码，不解释、不发明默认值。

## Goals

1. 一份 schema，两端校验。
2. fail closed。
3. 与生产路径隔离。

## Non-Goals

- 不实现 Host。
- 不验证 Ed25519（只解析 `signature.json` 字段形状，若本 change 触及 artifact envelope）。
- 不选平台可执行文件并 spawn。

## Decisions

### D1. Schema 放 `packages/plugin-contract`

```text
packages/plugin-contract/
  schemas/manifest.v1.json
  schemas/capabilities/*.v1.json
  fixtures/valid/notes-minimal.json
  fixtures/invalid/*
  src/index.ts          # parseManifestV1
```

Rust 侧 `src-tauri/src/plugin_runtime/manifest.rs` 调用同一 fixture 目录，或通过 build script 嵌入 schema。禁止 Rust/TS 各写一份 struct tag 当事实源。

### D2. Parser API

```text
parseManifestV1(bytes, opts) -> Result<ValidatedManifest, ManifestError[]>
opts.trustTier: system | verified | local
opts.currentPlatform: PlatformId
opts.coreContract: SemVer
opts.startupAllowlist: pluginId[]
```

`ValidatedManifest` 含：归一化 pluginId、entry map、unit closure、capability set。不返回“尽量解析”。

### D3. 校验顺序（安装前，无代码执行）

1. JSON + 未知字段
2. `manifestVersion === 1`
3. pluginId / publisher Reverse-DNS
4. SemVer + channel + `coreApi` range（禁 `*` / 无上界）
5. entries[] discriminated + path 相对性（只检查字符串，不读文件）
6. DAG cycle / 悬空 dependsOn / migration 不得进 unit
7. activationUnits + event catalog
8. `onStartup` × trustTier × allowlist
9. contributions exact / template overlap
10. capabilities ⊆ Catalog 或 `<pluginId>.*`
11. storage / budgets 上下限
12. 当前平台 required process key 存在（字符串键，不读 bin）

读 artifact 文件 hash 是下一 change（installer）的事；本 change 若做 integrity 字段，只校验 JSON 形状。

### D4. 不注册 Tauri command

parser 仅被单测与后续 Host 调用。Wave 0B 结束时 `command_registry.rs` 不变。

## Risks

| 风险 | 缓解 |
|---|---|
| schema 与 `14` 漂移 | fixture 直接引用 `14` §18 样例；未知字段测试锁死 |
| 过早接 AppShell | 目录放 `plugin-kernel` / `plugin_runtime`，禁止 app-shell import |
| SemVer range 库行为不一致 | 固定 Rust/TS 使用同一测试向量 |
