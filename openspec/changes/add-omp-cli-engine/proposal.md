## Why

mossx 当前拥有多种 CLI Engine，但缺少对 OMP CLI 这一完整 Agent Host/Runtime Platform 的独立接入契约。OMP CLI 同时提供 Provider/Profile/Auth、Native Session、ACP、Native RPC、Tools、MCP、Agents、Jobs、Skills、Plugins、Memory、Security 与 Admin surfaces；若按 PI 的单一文本流 Adapter 接入，会把不同生命周期、权限边界和控制协议混入同级 Engine，产生状态串台、终态误判与回归风险。

本变更以 `docs/research/mossx-multi-cli-provider-session-foundation-design.md` 和 `docs/research/mossx-new-cli-onboarding-guide.md` 为基石指导，采用独立 Engine、独立 Runtime、独立双 Transport、独立 Capability Projection 的方式，将 OMP 按 TDD 分阶段接入；每个阶段必须完成 focused verification 和独立 code review 后才能推进。

## 目标与边界

- 把 OMP 注册为独立 `EngineType`，不修改同级 Engine 的既有运行语义。
- 建立 OMP 独立的 runtime/profile/provider/session identity、生命周期、history 与 recovery contract。
- 分别接入 `omp acp` 和 `omp --mode rpc`；不得复用 `pi_rpc` 解析器或 PI 业务状态。
- 通过 canonical events、capability state 和 feature-local projection 接入 mossx UI。
- 按 L0-L5 能力层逐步开放 OMP 全功能，并对未验证能力保持 `unknown`。
- 以 TDD 方式拆分阶段；每阶段都有测试、代码审核、观测指标和回滚边界。

## 非目标

- 本变更首期不把 OMP 加入 Shared Session；Shared qualification 需要另行通过 terminal、handoff、provider binding、resume、cancel、tool exchange 和 recovery Spike。
- 不重构、迁移或统一 PI、Codex、Claude、Qoder 等同级 Engine 的既有实现。
- 不把 OMP 的 admin/security/memory/browser/plugin surface 强行渲染成 Conversation timeline 消息。
- 不在协议事实尚未 Spike 前猜测 ACP/RPC payload、事件终态或 Profile 存储格式。
- 不引入新的第三方 runtime dependency；优先使用现有 Rust process、Tauri IPC、Frontend adapter 和 governance infrastructure。

## What Changes

- 新增 OMP Engine registry、capability matrix、runtime owner 和独立 feature flags。
- 新增 OMP Provider/Profile/Auth/Model Role boundary，隔离 workspace、credentials、catalog 和 session。
- 新增 ACP over stdio transport，覆盖 initialize、session、prompt、stream、cancel 和 terminal。
- 新增 OMP Native RPC transport，覆盖 ready handshake、protocol negotiation、command discovery、response、event、extension UI 和 job control。
- 新增 canonical ACK/terminal/recovery/history contract，防止 accepted、queued、streaming 与 terminal 状态混淆。
- 新增 OMP frontend realtime/history projection；raw ACP/RPC 不得直接进入 Conversation renderer。
- 分阶段接入 tools、MCP、attachments、agents、tasks、jobs、todo、plan、compact、handoff、skills、rules、extensions、plugins、memory、advisor、browser、computer、SSH、search、security、usage、stats、export、share、git、worktree、bench、setup、update 与 diagnostics。
- 为每个阶段增加 focused TDD suite、smoke scenario、review checklist、telemetry、permission gate 和 rollback switch。

## Capabilities

### New Capabilities

- `omp-engine-runtime`: OMP 独立 Engine identity、runtime owner、profile/provider/session binding、生命周期与 feature gate。
- `omp-acp-transport`: OMP ACP stdio session、prompt、stream、cancel、terminal 与 native history boundary。
- `omp-native-rpc-control-plane`: OMP Native RPC handshake、command discovery、response/event、extension UI 和 job control。
- `omp-realtime-history-projection`: OMP canonical event、ACK/terminal/recovery、realtime timeline、history loader 与 session resume projection。
- `omp-agent-host-capabilities`: OMP Provider/Model/Auth、Tools/MCP、Agents/Jobs、Skills/Rules/Plugins、Memory、Security、Browser、SSH、Usage 与 Admin capability ownership。

### Modified Capabilities

本变更不直接修改现有 capability 的既有 requirement；OMP-specific 行为全部由上述新 capability specs 定义。实现阶段若发现共享 contract 必须改变，先追加独立 delta 并暂停对应阶段审核。

## 技术方案取舍

### 方案 A：按 PI/Qoder 模式增加一个轻量 CLI Adapter

优点：改动文件少、L0 prompt 接入快。缺点：无法承载 OMP 的 Native RPC、Provider/Profile/Auth、Jobs、Plugins、Memory 和 Security 生命周期，并会诱导复用 PI 状态；拒绝采用。

### 方案 B：OMP 独立 Engine + 独立 Runtime + ACP/RPC 双 Transport + Capability Projection（采用）

优点：边界清晰，可按能力逐层开放；协议、session、provider 和权限可以分别测试和回滚；不影响同级 Engine。缺点：首期文件与测试数量更多，需要先做协议 Spike；这是可控且符合基石设计的成本。

### 方案 C：先把 OMP 作为外部 Shared Provider 接入

优点：表面上可快速复用 Shared UI。缺点：OMP 自带 Provider routing、Agent orchestration 和 native session，Shared contract 尚未证明兼容；会把未验证能力直接暴露到共享链路。首期不采用，仅保留为后续 qualification 目标。

## Impact

- Backend：`src-tauri/src/engine/**`、engine registry、runtime manager、command/event registry、daemon bridge、session/history 与 capability matrix。
- Frontend：engine types/catalog、provider/profile selectors、thread adapters/loaders、canonical event projection、feature-local stores、i18n 与 capability UI。
- Governance：新增 OMP capability evidence、TDD phase gates、code-review artifacts、feature flags、metrics、audit 与 rollback checks。
- Runtime：依赖本机 `omp` binary；ACP/RPC 的真实 payload、版本兼容、Profile 存储、Provider catalog、extension UI 和 security scope 必须在 P0 Spike 中确认。
- Compatibility：不得改变现有 Engine 的 registry、runtime、provider binding、stream settlement 或 Shared Session 行为；任何共享基础设施改动必须有同级 Engine regression coverage。
- Release：OMP 默认按 capability flag 关闭高风险面；L0/L1 通过后再逐层启用，任一阶段失败可独立关闭 OMP，不回滚同级 Engine。
