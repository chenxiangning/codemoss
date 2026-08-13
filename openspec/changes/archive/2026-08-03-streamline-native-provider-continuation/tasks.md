## 1. Backend Preview Contract（P0）

- [x] 1.1 新增 idempotent `prepare_native_provider_continuation` command；输入现有 workspace/operation/source/destination，输出 prepared operation、fidelity 与 source/package Token；依赖：无；验证：Rust command tests 证明无 target identity。
- [x] 1.2 新增 guarded `discard_prepared_native_provider_continuation` command；输入同一 request，输出 discarded boolean；依赖：1.1；验证：仅 checksum 匹配且 phase=`prepared`、无 result identity 时可删除。
- [x] 1.3 注册 Tauri commands 并补齐 TypeScript DTO/service mapping；依赖：1.1、1.2；验证：DTO unit test 与 `npm run typecheck`。

## 2. Progress And Performance（P0）

- [x] 2.1 新增 operation-scoped `native-provider-continuation-progress` phase emitter；输入真实 backend boundaries，输出 workspaceId/operationId/phase/percent；依赖：1.1；验证：Rust phase mapping test。
- [x] 2.2 在 frontend event hub 增加 progress subscription，并按 workspaceId + operationId 过滤；依赖：2.1；验证：events Vitest 只投递匹配 payload。
- [x] 2.3 在 Claude engine 内新增 continuation-only `ContextBootstrap` command profile，复用 native CLI flags 缩小 tools/MCP/skills/hooks/thinking surface，现有 public send path 固定使用 `Standard`；依赖：无；验证：command args tests 同时覆盖 continuation 与 ordinary turn。
- [x] 2.4 仅在 `execute_claude` continuation 启用 minimal bootstrap，并保持 Provider routing、stable session id、durable evidence 与 explicit rejection；依赖：2.3；验证：focused Rust continuation/recovery tests。

## 3. Unified Dialog C（P0）

- [x] 3.1 将 frontend state machine 改为 `preparing -> confirm -> running -> ready|error`，自动 preview、取消双重 guarded discard、确认后复用 operation 并一次性接受 degraded；依赖：1.3、2.2；验证：hook Vitest 覆盖取消 race、single confirm、retry 与 double-click guard。
- [x] 3.2 实现方案 C UI：switch icon、可读 title、source→destination、Token、三阶段 strip 与底部 Progress；隐藏 marker/mode/omissions/adapter drops；依赖：3.1；验证：Dialog Vitest 覆盖可访问名称、disabled state、stage/progress 与 omission negative assertion。
- [x] 3.3 更新中英文 i18n，删除已无调用的 degraded 二次确认文案；依赖：3.2；验证：`rg` 无旧 state/按钮残留，locale typecheck 通过。

## 4. Contract And Regression Gate（P1）

- [x] 4.1 同步 `dev-guidelines/backend/native-provider-continuation-contract.md` 的 prepare/single-confirm/progress/minimal-bootstrap contract；依赖：1-3；验证：文档 signatures 与实际 DTO/commands 一致。
- [x] 4.2 运行 focused Vitest、Rust tests、`npm run typecheck`、`npm run check:runtime-contracts`；依赖：1-3；结果：54 个 focused Vitest、12 个 native continuation tests、1 个 Claude bootstrap profile test、TypeScript typecheck、target ESLint、Rust target rustfmt、`cargo check --all-targets` 与 runtime contracts 全部通过。
- [x] 4.3 运行 `openspec validate streamline-native-provider-continuation --strict --no-interactive` 与相关全局 strict validation；依赖：4.1、4.2；结果：本 change strict validation 通过；全库 475/477 通过，剩余两个既存 change 因无 delta 失败，与本 change 无关。
- [ ] 4.4 Desktop 手工验证 Claude → Codex 与 Codex → Claude，记录 prepare/bootstrap elapsed time、single-confirm、progress、source preservation 与 recovery；依赖：4.2；验证：人工验收证据，无法连接真实 Provider 时保持未勾选并明确 waiver。
