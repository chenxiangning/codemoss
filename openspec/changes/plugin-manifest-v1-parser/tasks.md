# Tasks: plugin-manifest-v1-parser

优先级：P0。不依赖 0A 完成。每项 ≤ 2 小时。

## 1. Schema 单源

- [ ] 1.1 建立 `packages/plugin-contract` 包骨架与 `schemas/manifest.v1.json`（对照 `14` §1–§12、§18）  
      验证：JSON Schema 自身可被 ajv/draft 解析
- [ ] 1.2 落下 `schemas/capabilities/*.v1.json` 与 Catalog 表（`14` §9）  
      验证：Catalog ID 集合与 `14` 表一致
- [ ] 1.3 写入 `fixtures/valid/notes-minimal.json`（`14` §18）与至少 12 个 invalid fixtures  
      覆盖：unknown field、unknown event、unknown kind、cycle、dangling entryId、unbounded coreApi、onStartup 非白名单、trusted-react+local、template overlap、private capability 跨插件、缺平台 process key、migration 进入 unit

## 2. TypeScript parser

- [ ] 2.1 实现 `parseManifestV1` 纯函数与 `ManifestError` 稳定 code  
      验证：valid fixture ok；每个 invalid fixture 有稳定 error code
- [ ] 2.2 no-code-execution：测试 spy `fs.readFile` / dynamic import，解析过程不得触发
- [ ] 2.3 Activation Unit required closure 计算（不含 optional edge）单测

## 3. Rust parser

- [ ] 3.1 `src-tauri/src/plugin_runtime/manifest.rs` 读取同一 fixtures  
      验证：与 TS 对同一 invalid fixture 都失败
- [ ] 3.2 不向 `command_registry.rs` 注册任何 command  
      验证：diff 不含 generate_handler 新增

## 4. 验收

- [ ] 4.1 focused vitest + `cargo test --lib plugin_runtime::manifest`
- [ ] 4.2 `openspec validate plugin-manifest-v1-parser --strict --no-interactive`
- [ ] 4.3 确认 `src/app-shell/**` 无新 import
