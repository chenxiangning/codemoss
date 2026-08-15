---
type: architecture
status: active
---

# 09 · Decision Log 与待确认问题

> 主线入口：[Mossx Plugin Platform](README.md)
> 用途：把幕布对话中的决定同步落盘，防止长对话造成架构细节丢失。

## 1. 已确认决策

| ID | 日期 | 决策 | 直接影响 |
|---|---|---|---|
| D-001 | 2026-08-14 | Mossx 采用 Plugin-First 目标架构 | Core 以 Microkernel 约束 |
| D-002 | 2026-08-14 | Core 只保留 Engine Contract，具体 CLI 全插件化 | 每个 CLI 最终独立仓库与 runtime |
| D-003 | 2026-08-14 | 一个 Extension Host 控制进程，每插件一个 Worker | 插件拥有独立故障域 |
| D-004 | 2026-08-14 | 高权限 C 插件和 `local` 插件使用独立受限进程 | Worker 不承担 OS security boundary |
| D-005 | 2026-08-14 | Trust tier 为 `system / verified / local` | 信任、来源、placement 三轴分离 |
| D-006 | 2026-08-14 | UI 使用 trusted React + declarative/sandbox 双模式 | 第三方默认不进 Core renderer |
| D-007 | 2026-08-14 | 白名单插件也必须有保险丝和快速回退 | Error Boundary、circuit breaker、LKG |
| D-008 | 2026-08-14 | 每插件独立 Storage Namespace | 物理隔离优先 |
| D-009 | 2026-08-14 | 更新前 Core 创建 checkpoint | checkpoint 失败则更新停止 |
| D-010 | 2026-08-14 | 普通更新保持向后兼容 | LKG 稳定前保留旧数据语义 |
| D-011 | 2026-08-14 | 破坏性 migration 明确提示用户 | 单独确认、展示影响与回退限制 |
| D-012 | 2026-08-14 | 回退代码时同步恢复数据 checkpoint | code + data 是一个回退单元 |
| D-013 | 2026-08-14 | 插件禁止改其他插件或 Core 数据表 | 跨插件交换走 Core typed service |
| D-014 | 2026-08-14 | 第一方插件最终也采用独立 Git 仓库 | Core 不长期保存插件源码副本 |
| D-015 | 2026-08-14 | 当前先写 `docs/architecture` 设计文档，不建立 OpenSpec proposal | 实施 Phase 开始时再拆小 change |
| D-016 | 2026-08-14 | 架构讨论实行幕布 + 文档双写 | 已确认项更新正文和本日志 |
| D-017 | 2026-08-14 | Plugin Artifact 采用方案 A：统一复合包，可组合 Worker、独立 Process、UI、Migration 入口 | Process Entry 语言无关但必须是受限 executable；禁止插件动态库进入 Core 主进程 |
| D-018 | 2026-08-14 | Control Plane 与 Data Plane 分离 | Extension Host 管 lifecycle/permission/registration/generation/health/fuse；Streaming 与大数据走 Core-issued bounded data channel |
| D-019 | 2026-08-14 | Worker Runtime 采用组合方案 A+C | 普通插件使用 Rust Host 内嵌 per-plugin QuickJS；Node/npm、CLI、native 进入独立 Restricted Process Entry，Node 不作为共享 Host Runtime |
| D-020 | 2026-08-14 | IPC Transport/Wire 采用方案 A | Control 为 JSON-RPC + JSON Schema + length-prefixed frame；Data 为 binary StreamHandle；跨进程使用 Named Pipe/UDS/framed stdio |
| D-021 | 2026-08-14 | 正式采用 Manifest A + Runtime Registration B | Manifest 是安装前可审计的最大授权包络；插件激活后动态注册实际 Contribution，但不得越界扩权 |
| D-022 | 2026-08-14 | `pluginId` 采用 Reverse-DNS stable ID | 机器身份永久不可变；官方使用 `com.mossx.*`，社区使用已验证域名或 `io.github.<owner>.*` |
| D-023 | 2026-08-14 | 版本采用 Schema/Artifact/Contract 三轴模型 | `manifestVersion`、插件 SemVer `version`、`compatibility.coreApi` 独立演进；同 ID+version 禁止对应不同 hash |
| D-024 | 2026-08-14 | Entry 采用 `id + kind` Discriminated List | `worker/process/ui/migration` 使用 per-kind Closed Schema；Contribution 与 lifecycle 显式引用稳定 `entryId` |
| D-025 | 2026-08-14 | 插件编排采用双图模型 | Manifest Physical Entry DAG 管物理执行单元；Runtime Capability Dependency Graph 管动态逻辑可用性；Migration 独立事务化 |
| D-026 | 2026-08-14 | Runtime dependency 采用三态 Readiness Contract | `required` 有 Core-bounded deadline；`deferred` 可观测等待并自动重绑定；`optional` 缺失不形成等待或恢复义务 |
| D-027 | 2026-08-14 | Capability Ownership 采用分阶段双层模型 | V1 仅 Core-owned `mossx.*` 可跨插件；`<pluginId>.*` 默认私有；V2 由 signed Contract Artifact + Registry governance 开放 publisher-owned export |
| D-028 | 2026-08-14 | Contribution Envelope 采用 Exact + Bounded Template | 稳定项逐项声明；dynamic 类型仅能在 type/entry/key/scope/maxInstances 有界模板内注册 |
| D-029 | 2026-08-14 | Activation 采用 Declarative Events + Lazy by Default | Core 从 Manifest 注册 placeholder；事件命中后 single-flight 启动 Entry DAG；普通插件与 Registry 不阻塞 first-interactive |
| D-030 | 2026-08-14 | 未决事项采用 18 个 Decision Package 管理，并固定执行 DeepSeek 源码对比后再推荐、确认和落盘 | `12-open-decisions-and-deepseek-comparison.md` 成为未决项排队与 Freeze Gate 事实源；推荐不得越过用户确认直接写成 Contract |
| D-031 | 2026-08-16 | DP-001：Activation Unit 是最小启停单元；Entry 可共享并以 generation-scoped refcount 回收 | 禁止隐式激活整个 plugin；见 `14` §3 |
| D-032 | 2026-08-16 | DP-002：V1 event catalog 仅 `onView/onCommand/onEngine/onWorkspace/onSettings/onStartup`；普通插件 lazy；`onStartup` 仅 system 白名单 | first-interactive 不得等待普通插件 |
| D-033 | 2026-08-16 | DP-003：`worker/process/ui/migration` Closed Schema 与必填字段冻结 | 未知 kind / 越界 path fail closed |
| D-034 | 2026-08-16 | DP-004：Physical DAG 仅 Manifest `dependsOn`；required 失败整 unit rollback；共享 Entry 不复制进程 | runtime 不得改边或 placement |
| D-035 | 2026-08-16 | DP-005：六平台精确匹配，禁止跨 arch fallback | 缺平台 = incompatible |
| D-036 | 2026-08-16 | DP-006：V1 Platform Capability Catalog 冻结 ID/role/scope；仅 `mossx.*` 可跨插件 | 见 `14` §9 |
| D-037 | 2026-08-16 | DP-007：仅 tool/search/context/status 可 template；keyPrefix 必须位于 pluginId 下；maxInstances 1–256 | Trusted React / Engine 必须 exact |
| D-038 | 2026-08-16 | DP-008：activation 默认 10s / 硬上限 30s；并发 2；心跳与熔断数值冻结 | 禁止 infinite wait |
| D-039 | 2026-08-16 | DP-009：未知字段一律拒绝；仅 `extensions.<publisherDns>.*` 可被忽略 | 安全对象禁止 additionalProperties |
| D-040 | 2026-08-16 | DP-010：publisher.id + TransferStatement 双签；丢 key 冻结新发布，不自动接管 | pluginId 永不随 rename 变化 |
| D-041 | 2026-08-16 | DP-011：Ed25519 + sha256 merkle + SBOM/provenance；禁止绕过 revocation | 离线只跑已验证 LKG |
| D-042 | 2026-08-16 | DP-012：`storage.schemaVersion` + migration entry；destructive 需确认；`exportRequired` 才强制导出 | checkpoint 失败则更新不开始 |
| D-043 | 2026-08-16 | DP-013：channel 仅 stable/beta；system 自动、verified 确认、local 禁止自动 | 无上界 range 拒绝 |
| D-044 | 2026-08-16 | DP-014：V1 来源仅 curated Registry + local path + Git-as-local；私有 Registry 预留但不解析 | npm registry 不是插件源 |
| D-045 | 2026-08-16 | DP-015：V1 禁止 plugin-to-plugin artifact 依赖 | 跨插件只走 `mossx.*` |
| D-046 | 2026-08-16 | DP-016：MXPC/MXPD little-endian framed binary；无压缩/无 shm/无跨进程 resume | 见 `14` §13 |
| D-047 | 2026-08-16 | DP-017：官方 SDK = TypeScript + Rust；Go 仅 generated types | 其他语言走 conformance |
| D-048 | 2026-08-16 | DP-018：Engine pilot = Claude；Feature pilot = Notes；Git/Search 留 Core；Trusted React 仅 system | 不把已删 CLI 拷回 Core |

## 2. 已拒绝或纠正的方案

| 方案 | 结论 | 原因 |
|---|---|---|
| 所有插件在 renderer 内 dynamic import | 拒绝 | 无权限/故障边界，难以真正撤销副作用 |
| 所有插件共享 Extension Host 进程执行 | 拒绝 | 单插件可拖垮全部扩展 |
| 独立仓库天然可信 | 拒绝 | source 不等于 trust，仍需签名/审核/授权 |
| 只回退插件代码 | 拒绝 | 旧代码可能无法读取新 schema |
| Marketplace 先做下载列表 | 拒绝 | 缺少隔离、权限、回退时会放大风险 |
| 用一个“热部署”词覆盖所有更新 | 纠正 | Worker、进程、renderer、Core 的重启语义不同 |
| 现在直接建立总包式 OpenSpec proposal | 暂缓 | 先沉淀设计；实施时按 Phase 建小 change |

## 3. 待确认问题队列

问题按对实施路径的影响排序，每次幕布只聚焦一个，确认后同步回写：

> 18 个 Decision Package 已在 2026-08-16 全部 `CONFIRMED`（D-031～D-048）。本节保留原始 10 项作为来源视图，并指向冻结结果。

1. **Plugin Manifest V1 字段与校验粒度** → D-031～D-039、D-042；正文 [`14-v1-contract-freeze.md`](14-v1-contract-freeze.md)。
2. **IPC Binary Contract** → D-046；`14` §13。
3. **第一个 Plugin Pilot** → D-048：Claude Engine + Notes Feature。
4. **Process Entry SDK 语言** → D-047：TypeScript + Rust。
5. **Marketplace V1 来源** → D-044：curated Registry + local + Git-as-local。
6. **自动更新默认策略** → D-043：system 自动 / verified 确认 / local 禁止。
7. **破坏性 migration 门槛** → D-042：checkpoint + 确认；仅 `exportRequired` 强制导出。
8. **插件依赖** → D-045：V1 禁止 plugin-to-plugin。
9. **Git/Search 最终归属** → D-048：V1 留 Core。
10. **Trusted React 开放范围** → D-048：仅 `system`。

## 4. 双写更新格式

每次决策后追加一行：

```text
Decision ID / 日期 / 用户选择 / 选择理由 / 影响文档 / 是否触发任务调整
```

如果用户暂时不决定，则只更新 Open Question 的背景和选项，不修改已确认架构。

## 5. 本轮落盘记录

2026-08-14：建立主线大纲与九个分册，完整记录 Core boundary、C 型隔离、trust tier、Capability Broker、生命周期、Storage 六条铁律、UI 双模式、CLI 插件化、独立仓库/Marketplace 和分阶段任务。

2026-08-14：确认 Plugin Artifact 方案 A。统一复合包可组合 Worker、Process、UI、Migration 入口；Process Entry 为独立 executable，Core 永不加载插件动态库。影响 `README.md`、`02-runtime-isolation-and-trust.md`、`06-engine-plugin-contract.md`、`07-repository-distribution-marketplace.md`，后续 Manifest/IPC 讨论以此为前提。

2026-08-14：确认 Control Plane 与 Data Plane 分离。Extension Host 保持 control-plane supervisor；Streaming 与 bulk payload 使用 Core-issued bounded data channel。影响 `README.md`、`02-runtime-isolation-and-trust.md`、`06-engine-plugin-contract.md`、`08-migration-roadmap-and-tasks.md`。physical transport 随后由 D-020 确认，exact frame 由 D-046 冻结。

2026-08-14：确认 Worker Runtime 采用 QuickJS + Restricted Process 组合。普通 Worker 在 Rust Extension Host 的 per-plugin QuickJS Runtime 中运行；Node/npm/CLI/native 作为独立 Process Entry。影响 `README.md`、`02-runtime-isolation-and-trust.md`、`06-engine-plugin-contract.md`、`07-repository-distribution-marketplace.md`、`08-migration-roadmap-and-tasks.md`。

2026-08-14：确认 IPC Transport/Wire 方案 A。Control Plane 使用 JSON-RPC/JSON Schema 与 length-prefixed framing；Data Plane 使用 binary StreamHandle；Core↔Host 使用 Named Pipe/UDS，Host↔Process Control 使用 framed stdio。新增 `10-ipc-transport-and-wire-protocol.md`，binary header/codec/shared-memory 等细节继续保持 open。

2026-08-14：确认 Manifest A + Runtime Registration B。Closed Declarative Manifest 负责安装前审计并声明最大授权包络；插件进入 activation 后通过 SDK 动态注册实际 Contribution；Core/Host 在 atomic publish 前验证运行时集合未越过 Manifest。新增 `11-manifest-and-runtime-registration.md`，并调整 lifecycle、distribution 与 P0/P2 tasks；具体 Manifest V1 字段和 required/optional 粒度继续保持 open。

2026-08-14：确认 `pluginId` 采用 Reverse-DNS stable ID。`pluginId` 是不可变机器身份，并作为 Storage Namespace、permission owner、lockfile 与 generation identity 的稳定根；display name、repository 和 publisher metadata 独立演进。官方保留 `com.mossx.*`，社区使用已验证域名或 `io.github.<owner>.*`；验证与 publisher transfer 流程保持 open。

2026-08-14：确认版本采用 Schema/Artifact/Contract 三轴模型。`manifestVersion` 选择 Manifest Schema，`version` 使用 SemVer 标识插件 release，`compatibility.coreApi` 声明 Core Contract range；同一 `pluginId + version` 只能绑定一个 immutable artifact hash。具体 pre-release、channel 和 range resolver 规则保持 open。

2026-08-14：确认 Entry 采用 `id + kind` Discriminated List。一个复合 artifact 可以包含多个 Worker、Process、UI、Migration Entry；每种 `kind` 使用严格 Closed Schema，Contribution、placement、health、generation、日志与故障归因通过稳定 `entryId` 关联。具体 per-kind 字段和 Entry 之间的依赖表达保持 open。

2026-08-14：确认采用双图模型。Manifest Physical Entry DAG 由 Core/Host 管理 execution unit 的拓扑启动、反向停止、placement 与故障边界；Runtime Capability Dependency Graph 根据 generation-bound provide/require registration 管理 Contribution 的动态可用性、撤销与重绑定。逻辑图不得改变物理图，Migration 不进入常规 runtime graph，继续由 Core update transaction 管理。

2026-08-14：确认 Runtime dependency 使用 `required / deferred / optional` 三态 Readiness Contract。required 在 Core-bounded activation deadline 内未满足则 candidate 失败；deferred 不阻塞基础激活但保持可观测 waiting 并在 provider 到达后自动重绑定；optional 缺失是合法省略。Physical Entry 仍使用 required/optional criticality，延迟启动由 activation policy 表达。

2026-08-14：确认 Capability Ownership 采用分阶段双层模型。V1 只有 Core-owned Platform Catalog 中的 `mossx.*` Capability 可以跨插件 provide/require；`<pluginId>.*` 默认为同插件 generation 内 private Capability。V2 只有在 signed Capability Contract Artifact、owner verification、version/schema hash、consumer lock、revocation 与 offline cache 就绪后，才允许 Publisher-owned Capability 跨插件发布。

2026-08-14：确认 Contribution Envelope 采用 Exact Declaration + Bounded Template。稳定 UI、Command、Engine 等使用 exact declaration；只有 Platform Catalog 标记 dynamic-eligible 的类型才能使用 template，并受 owner `entryId`、key namespace、scope、maxInstances 和 generation lifecycle 约束。Runtime registration 必须唯一匹配声明，模板扩大进入 permission/policy diff。

2026-08-14：确认 Activation Policy 采用 Declarative Activation Events + Lazy by Default。普通插件只在 Manifest 声明的 View/Command/Engine/Workspace 等 Core Catalog event 命中时 single-flight 启动；Core 通过本地已验证 metadata 提供 placeholder，`onStartup` 仅允许必要 system plugin 或 policy whitelist。普通插件、Marketplace 与 Registry 不得阻塞 Core first-interactive。

2026-08-14：确认未决事项治理采用 18 个 Decision Package，并新增 `12-open-decisions-and-deepseek-comparison.md`。后续每项必须先读取 DeepSeek Harness/Cordis 本地源码并记录证据，再对比 Mossx 的 trust、process、storage、rollback 与跨平台边界，提出推荐；只有用户确认后才能更新 Contract 正文、Decision Log 与 Roadmap。

2026-08-16：用户要求把缺失内容补齐、使文档闭环成为实施基石。完成 DeepSeek/Cordis 本地源码取证后，将 DP-001～DP-018 一次性冻结为 D-031～D-048，并新增 [`14-v1-contract-freeze.md`](14-v1-contract-freeze.md) 作为字段级事实源。选择理由：桌面 Marketplace 必须 fail closed；DeepSeek 的 composition/HMR 模式可迁移，但其 trusted same-process Node、newline JSON-RPC 与 pnpm 安装链不能直接成为 Mossx Contract。影响全部专项分册与 `08` 的 P0/P1 验收口径。

2026-08-16：确认实施主线为「先插排、再一根根拔插头、瘦身跟插头走」。当前工作树仍是完整单体，文档 13 降级为本机实验记录。新增 [`15-implementation-wave-plan.md`](15-implementation-wave-plan.md) 与 OpenSpec `plugin-kernel-ownership-inventory`、`plugin-manifest-v1-parser`。拒绝按 13 整树删空再加回。
