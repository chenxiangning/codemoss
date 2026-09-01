## Context

mossx 是 Tauri 2 + React 19 + TypeScript + Rust 的多 AI Engine 工作台。当前已有 Engine registry、runtime manager、provider/model catalog、session/history、realtime adapter、daemon bridge、capability matrix 与 Shared Session contract。基石文档要求新 Engine 按 identity、runtime、protocol、capability、projection、governance 分层接入，并要求 app 与 daemon 双路径保持一致。

OMP CLI 不是单一 prompt/stream CLI，而是一个 Agent Host：它拥有独立 Provider routing、Profile、Auth、Native Session、ACP、Native RPC、Tools、MCP、Agents、Jobs、Skills、Rules、Extensions、Plugins、Memory、Security、Browser、SSH、Usage、Stats、Export、Share、Git、Worktree、Bench 与 maintenance commands。已验证本机 `omp/18.0.11` 支持 `omp acp` 与 `--mode rpc`，但 ACP/RPC payload、session schema、profile storage、terminal semantics、extension UI...

本变更的 stakeholders：Rust runtime/daemon、Frontend conversation/session、provider/catalog、security、QA、release 与 code review。核心约束：OMP 代码必须新建独立模块；不得修改同级 Engine 行为；不得把未经证实的协议事实写成实现假设；每阶段必须先有失败测试，再实现，再 focused verification 和代码审核。

## Goals / Non-Goals

**Goals:**

- 注册独立 OMP Engine identity 和 capability states。
- 建立 workspace × runtimeProfile × providerProfile × nativeSession 的独立 ownership。
- 独立实现 ACP over stdio 与 OMP Native RPC 两个 transport。
- 将 raw protocol 归一化为 canonical events，再投影到 timeline/history/feature-local surfaces。
- 覆盖 prompt、stream、ACK、terminal、cancel、resume、history、provider/model/profile、tools、attachments、jobs、agents、skills、plugins、memory、security 与 admin 能力的分阶段接入边界。
- 使用 feature flags、permission gates、audit、metrics、recovery 和 rollback 限制风险。
- 每一阶段拥有 TDD case、smoke scenario、review checklist 与明确的“不触碰同级 Engine”边界。

**Non-Goals:**

- 首期不把 OMP 加入 Shared Session；Shared qualification 是后续独立决策。
- 不重构 PI、Codex、Claude、Qoder 或其他同级 Engine。
- 不复用 `pi_rpc.rs` 解析 OMP；不将 OMP raw event 直接交给 Conversation renderer。
- 不引入第三方 runtime dependency；使用已有 process/Tauri IPC/registry/telemetry 基础设施。
- 不在 Spike 前承诺未验证的 ACP/RPC 字段、事件终态或 profile 文件格式。

## Decisions

### 1. Independent engine module

采用 `src-tauri/src/engine/omp.rs` 及其同级专属模块，并在 registry、daemon bridge、commands、events、frontend adapter 中增加 OMP 分支。共享代码只允许使用已存在且行为稳定的 contract/util；OMP-specific settlement、profile、history、protocol parsing 必须保持独立。

替代方案：在 PI adapter 增加 `engine == omp` 分支。拒绝，因为会共享错误的 resident/session/terminal assumptions，且违反基石文档的 engine isolation gate。

### 2. Two explicit transports

`OmpAcpClient` 负责 ACP initialize/session/prompt/cancel/stream/terminal；`OmpRpcClient` 负责 ready/protocol negotiation/request-response/event/command discovery/extension UI/job control。两者分别拥有 frame decoder、error mapping、lifecycle owner 和 tests。

替代方案：只实现 RPC 或只将 ACP 当作通用 stream-json。拒绝，因为会丢失 OMP 的 control-plane 能力，或无法使用官方 ACP surface。

### 3. Runtime identity

运行时 key 固定由结构化字段组成：`workspaceId + runtimeProfileId + providerProfileId + nativeSessionId`。native session 和 mossx thread 建立可审计映射；profile home、credential source、add-dir grants 和 environment assembly 由 OMP runtime owner 管理。

替代方案：使用 `omp:<raw-session-id>` 单字段 key。拒绝，因为无法区分 profile/provider/workspace，容易串台并阻碍 rollback。

### 4. Canonical event boundary

所有 ACP/RPC 输入先经过 OMP parser/normalizer，输出 `EngineEvent` 与 OMP-specific control facts。只有 canonical conversation facts 进入 timeline；control events、extension UI、jobs、security findings、memory records 进入 feature-local stores。

替代方案：Frontend 直接消费 raw JSON。拒绝，因为协议变化会穿透 UI，且会把 control-plane 高频事件接入根渲染链。

### 5. Terminal and recovery contract

`accepted`、`queued`、`delta`、`tool_call`、`awaiting_approval`、`cancel_requested`、`terminal` 必须是不同状态。只有经过 typed terminal settlement 的事件才能关闭 foreground turn。EOF、process exit、malformed frame、timeout 和 daemon restart 走显式 recovery，不得静默当作成功或丢失。

替代方案：以 process exit/EOF 作为终态。拒绝，因为 OMP RPC 已验证存在独立 response/event/control sequence，进程存活不等于 turn terminal。

### 6. Capability rollout

能力按 L0-L5 开放：L0 identity/native prompt/basic stream；L1 ACK/terminal/cancel/resume/history/catalog；L2 tools/reasoning/image/file/todo/plan/compact；L3 jobs/agents/skills/rules/plugins；L4 memory/advisor/browser/computer/SSH/collaboration；L5 security/usage/stats/export/share/git/worktree/admin。每项保存 `supported|unsupported|unknown|degraded` 与 evidence。

替代方案：Engine 注册完成即显示所有 OMP features。拒绝，因为 help surface 不等于协议支持或 mossx 安全可投影。

### 7. TDD phase gate and review gate

每个阶段顺序固定为：先写 failing unit/contract test → 最小实现 → focused test/smoke → reviewer 检查 diff、同级 Engine 回归、权限和生命周期 → 修复 findings → 标记阶段完成。禁止跨阶段提前打开 feature flag；每阶段有独立 rollback switch。

### 8. App/daemon parity

所有 OMP runtime 判定、protocol decoder、settlement predicate 和 capability mapping 下沉到共享 `engine/omp_*` domain；app command path 与 `cc_gui_daemon` forwarder 只做 transport wiring，禁止复制判定逻辑。发布前核对 binary path/mtime 与 resident process ancestry。

## Risks / Trade-offs

- [Protocol drift] OMP 版本升级改变 ACP/RPC frame 或 command schema → 固化 versioned decoder、golden frames、max-frame guard 和 P0/P13 compatibility probe。
- [Terminal misclassification] response、EOF、process exit 被误当终态 → typed settlement predicate、terminal golden tests、recovery metrics 和人工 review gate。
- [Provider/profile leakage] credentials、catalog 或 session 跨 profile 串台 → structured runtime key、profile-scoped storage、redacted audit 与 isolation tests。
- [Permission expansion] MCP、Browser、Computer、SSH、Plugins 获得过宽权限 → capability grant、workspace allowlist、approval policy、secret redaction 和 default-off flags。
- [Render pressure] jobs、tool output、stream delta 进入 AppShell 根链 → live external channels、feature-local stores、batched projection 和 render budget metrics。
- [Daemon divergence] dev app 与 installed daemon 行为不一致 → 双路径 contract tests、共享判定函数、process ancestry/build identity checks。
- [Large payload] tool/file/image/history 超过 frame 或 IPC 限制 → chunk/reassembly limit、size metrics、streamed persistence、oversize recovery。
- [Scope expansion] 一次打开全部 OMP surfaces 增加回归面 → L0-L5 capability gates，先 Native Session，再逐层开放 admin surfaces。

## Migration Plan

1. P0：只做 OMP binary/version/ACP/RPC capability probe 和 golden evidence，不注册可用 UI。
2. P1：增加 Engine identity、registry 与 capability matrix，默认 `unknown`/disabled；验证现有 9 个 Engine 不变。
3. P2-P5：逐步实现 runtime/profile/provider/session、ACP、RPC、ACK/terminal/recovery/history；每阶段使用 focused Rust tests 和 process smoke。
4. P6-P8：增加 frontend realtime/history、model/profile selectors、tools/MCP/attachments；raw control events 保持 feature-local。
5. P9-P12：按权限门禁开放 jobs/agents/todo/plan/plugins/memory/browser/security/admin surfaces。
6. P13：app/daemon parity、migration、telemetry、release soak；失败时关闭 OMP flag，不回滚同级 Engine。
7. P14：只有 qualification matrix 全绿才评估 Shared Session；否则保持 Native-only。

回滚策略：每阶段关闭对应 `omp.*` capability flag，停止 OMP runtime owner，保留已写入的 redacted audit/evidence；不删除其他 Engine registry、session、provider 或 Shared 数据。协议不兼容时拒绝启动新 OMP session，现有同级 Engine 不受影响。

## Open Questions

- OMP ACP initialize、session/new、prompt、update、cancel 的精确 payload 与 terminal event 是什么？
- Native RPC protocol version 1/2 的兼容规则、chunk framing、request timeout 和 event ordering 是什么？
- OMP Profile 是否隔离 auth、model catalog、plugin、skill、memory、session directory？
- OMP Provider usage、limits、OAuth refresh 和 auth broker 的 secret ownership 是什么？
- OMP history/session 是否可稳定映射到 mossx thread，resume 是否跨 process 可用？
- Extension UI 在 headless ACP、Native RPC、desktop WebView 三种模式下如何表现？
- MCP、Browser、Computer、SSH、Plugin 的最小权限和 approval model 如何接入现有 policy？
- OMP background jobs、agents、join、handoff 的 owner、cancel、terminal 和 persistence contract 是什么？
- 哪些 OMP capability 需要 daemon-only 实现，哪些可以 app-local？
- OMP 是否最终满足 Shared Session 的 recovery、provider binding、tool exchange 和 context handoff 契约？
