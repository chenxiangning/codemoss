---
type: architecture
status: active
---

# 08 · Executable Task Backlog

> 主线入口：[Client Modernization](README.md)
> 本文是 architecture backlog，不表示任务已获实现授权。每个任务进入开发前需拆入对应 OpenSpec change。

## 1. Task Card Contract

每个任务必须填写以下字段；本文件用 Workstream 公共卡 + 任务差异表避免重复：

- `Prerequisites`：可开始条件；
- `Evidence`：为什么做、基线 artifact；
- `Boundary`：本任务改/不改什么；
- `Prohibited`：明确禁止的捷径；
- `Platform`：Win/mac/Linux 证据状态；
- `Verification`：自动化 + 人工/packaged；
- `Rollback`：撤销路径；
- `Completion`：可审计产物。

全局禁止：用历史数值冒充 current、扩大既有 docs/test 失败集、破坏 A1-A4、无数据回退做 destructive migration、以 dev browser 代替 packaged evidence。

## 2. W0 · Current Baseline and Fixtures

**Common card**

- Prerequisites：固定 current commit/build，准备可清理的测试 profile。
- Boundary：只建设 measurement/fixtures，不先改运行机制。
- Prohibited：边测边改、手工挑最好一次、混合 dev/release 数据。
- Platform：Windows/macOS 必须；Linux 按产品支持声明。
- Rollback：instrumentation/fixture 独立开关；不污染用户 durable data。

| ID | Task | Evidence | Verification | Completion |
|---|---|---|---|---|
| W0.1 | 固化 evidence metadata/schema 与 freshness policy | 历史 artifact 被误当 current | schema test + stale artifact rejection | schema、producer/consumer contract |
| W0.2 | 建立 CS-CLEAN/UPGRADE/WS-10/PLUGIN-50/OFFLINE fixtures | 冷启根因混杂 | packaged repeat runs | fixture manifests + baseline artifact |
| W0.3 | 建立 LS-200/1K/10K、100k reasoning、50MB tool output fixtures | 长会话缺 deterministic input | checksum + repeatability | versioned fixture generator |
| W0.4 | 对齐 native/renderer/host/plugin monotonic markers | 多进程 timeline 不可关联 | correlation test | unified startup/session trace |
| W0.5 | 重测 current AppShell/Composer/streaming baseline | 旧 100-350ms/FPS 不代表当前 | same-machine baseline/candidate protocol | current baseline report |

## 3. W1 · Native Crash/Hang Safety

**Common card**

- Prerequisites：W0 startup trace；Windows symbols/minidump 可用。
- Boundary：native bootstrap、stack、process lifecycle；不做 UI 重构。
- Prohibited：只增 stack size 不验证 future frame；吞 crash；自动删除用户 state。
- Rollback：linker/build flag 与 pinning 变更可单独回退；Safe Mode 保留。

| ID | Task | Evidence | Platform | Verification | Completion |
|---|---|---|---|---|---|
| W1.1 | 为 `Box::pin + /STACK:8388608` 建 packaged regression | Windows `0xc00000fd/__chkstk` incident | Win 必须，mac/Linux non-regression | clean/upgrade/multi-workspace launches | crash-free matrix + dump archive |
| W1.2 | 审计 deep async future / recursive startup frames | 新 callsite 可能重现 | Win priority | compile diagnostics + targeted stress | reviewed callsite inventory |
| W1.3 | 建 hang heartbeat/progress-marker 判定 | 白屏与 hang 无法区分 | all | forced native/renderer/host stalls | hang classifier artifact |
| W1.4 | 建 child process/PTY cleanup 与 startup timeout | CLI/plugin process 可能拖住 Core | all | hanging child fault injection | cleanup/timeout evidence |
| W1.5 | 在 plugin load 前完成 Safe Mode decision | plugin crash loop 风险 | all | corrupt lock/plugin startup | minimal Core recovery proof |

## 4. W2 · Cold-start Critical Path

**Common card**

- Prerequisites：W0 waterfall，W1 排除 native fatal path。
- Boundary：source scheduling/cache/diagnostics；不改变用户会话语义。
- Prohibited：startup Registry 网络、全量 scan 自愈、无界并发、以 timeout 掩盖失败。
- Rollback：每个 source phase 有 feature flag/old scheduler adapter。

| ID | Task | Evidence | Verification | Completion |
|---|---|---|---|---|
| W2.1 | 盘点所有 startup source 并标注 S0-S4 | engine/history/git/models/skills/catalog 竞争 | static inventory + runtime trace | owner/phase matrix |
| W2.2 | 强制 bounded recent preview，full catalog on-demand | full scan 候选仍存在 | 1/10 workspace packaged test | preview/full-scan evidence |
| W2.3 | Registry/Marketplace 完全退出 startup dependency | 插件化新增风险 | offline/DNS hang fault | CS-OFFLINE first-interactive |
| W2.4 | local manifest/lock cache + install-time verify | 避免每次 full signature/unpack | 0/10/50 plugin startup delta | cache integrity/recovery tests |
| W2.5 | diagnostics ring buffer 与异步 durable flush | watchdog 可能反馈放大 | forced long task/disk slow | overhead + no-amplification artifact |
| W2.6 | source concurrency/cancellation/backpressure | burst I/O/IPC | slow disk/hanging engine fixture | bounded in-flight proof |

## 5. W3 · Composer/AppShell/WebView First Interaction

**Common card**

- Prerequisites：W0 input markers、W2 source phase 基线。
- Boundary：first-interactive 到 full activation；不改产品核心对话流程。
- Prohibited：按钮可见即算 interactive、首次点击同步 mount 所有 deferred module、native zoom 回归。
- Rollback：ComposerGate/Light 保留；新 activation ladder feature flag。

| ID | Task | Evidence | Platform | Verification | Completion |
|---|---|---|---|---|---|
| W3.1 | 分解 first input receive/handler/commit/paint/ack | 点击冻结隐藏在单一 marker 后 | all packaged | click/type deterministic trace | input-ack waterfall |
| W3.2 | 审计 ComposerGate 首次交互触发的 fan-out | full Composer 已延迟但仍未现测 | Win/mac priority | cold launch + immediate click | activation dependency list |
| W3.3 | AppShell updater attribution/current key-size 复测 | governance split 不等于 render 已解决 | all | profiler without react-scan distortion | root owner evidence |
| W3.4 | WebView/CSS/font/layout phase markers | 平台行为差异 | Win/mac distinct | DPI/theme/font matrix | platform status table |
| W3.5 | 把 heavy module preload 拆成 cancellable idle slices | deferred burst 风险 | all | input during preload | no long-task regression |

## 6. W4 · Reasoning and ToolOutput Externalization

**Common card**

- Prerequisites：W0 streaming fixtures；canonical settle/recovery contract 清晰。
- Boundary：transient high-frequency path；不丢 durable canonical facts。
- Prohibited：恢复 text delta reducer、仅调大 32ms、丢 reasoning/tool output。
- Rollback：per-channel feature flag，旧 path 仅作 compatibility fallback。

| ID | Task | Evidence | Verification | Completion |
|---|---|---|---|---|
| W4.1 | 建 text/reasoning/toolOutput event-rate 与 reducer attribution | 32ms batch 仍进高层 | fixture trace | per-class cost report |
| W4.2 | reasoning live segment external channel | 高频 reasoning 放大根链 | 100k chunks + recovery | canonical settle parity |
| W4.3 | toolOutput chunk store + bounded UI tail | 大 payload/IPC/DOM 风险 | 50MB/ANSI/binary cases | backpressure + export parity |
| W4.4 | control/approval 与 bulk stream 分优先级 | bulk output 可能饿死关键消息 | flood fixture | deadline/ordering proof |
| W4.5 | crash/reload 时 transient → durable recovery | 外置不能丢事实 | kill mid-stream | recovery artifact |

## 7. W5 · Incremental Markdown

**Common card**

- Prerequisites：W4 stable live segment；MD-EDGE corpus。
- Boundary：block tracking/cache/enrichment scheduling；不改变 Markdown semantic contract。
- Prohibited：把 lightweight staged render 称为 incremental、错误冻结未闭合 block、永久禁用富文本。
- Rollback：full parser fallback；cache schema versioned/可清空。

| ID | Task | Evidence | Verification | Completion |
|---|---|---|---|---|
| W5.1 | 建 Markdown split-chunk correctness corpus | fence/table/math/html 可跨 delta | parser differential tests | MD-EDGE fixture |
| W5.2 | block boundary tracker + last 1-2 mutable blocks | accumulated full parse | full-vs-incremental parity | stable block contract |
| W5.3 | content-hash settled block cache | settled content 重复工作 | mutation/invalidation tests | cache hit/correctness evidence |
| W5.4 | syntax/KaTeX/Mermaid settle/viewport enrichment | live phase昂贵插件 | scroll/settle/accessibility tests | phase cost report |
| W5.5 | huge code/tool block worker/backpressure | renderer long task | large block fault | bounded main-thread evidence |

## 8. W6 · Bounded History Window

**Common card**

- Prerequisites：W5 stable rows/blocks，W7 stable ids/projection。
- Boundary：loaded data/DOM 与 navigation；durable history 不截断。
- Prohibited：恢复 summary wall、用 CSS 隐藏无限 DOM、把 10k 当合理 window、破坏 scroll ownership。
- Rollback：旧 full-load path 受控 fallback；不迁移/删除 durable data。

| ID | Task | Evidence | Verification | Completion |
|---|---|---|---|---|
| W6.1 | 定义 cursor/window/anchor contract | current 10k static window | schema + property tests | OpenSpec-ready contract |
| W6.2 | recent/active anchor bounded initial load | open 长历史成本 | LS-10K open | loaded-row upper bound |
| W6.3 | semantic prepend + scroll anchor preservation | load older UX 风险 | variable-height/media rows | pixel/semantic anchor evidence |
| W6.4 | jump/search/unread 定位并重建窗口 | window 不能损害可达性 | random target tests | navigation parity |
| W6.5 | eviction/cache policy 与 active row pinning | memory plateau | scroll 10k/session switch | heap/DOM plateau |

## 9. W7 · Incremental Projection and Row Selectors

**Common card**

- Prerequisites：W0 profiler、W4 canonical event types。
- Boundary：fold/order/group/projection/subscription；不先替换 state library。
- Prohibited：只加 React.memo、用 array identity 全量失效、复制 Harness store 实现。
- Rollback：compatibility projector 对照；dual-run 仅测试期，不做长期双 owner。

| ID | Task | Evidence | Verification | Completion |
|---|---|---|---|---|
| W7.1 | 采 fold/group/projection flamegraph 与 invalidation graph | 当前仅静态候选 | LS/ST fixtures | measured hotspot map |
| W7.2 | `nodeById + ordered ids + group index` 增量 fold | 全量派生候选 | differential replay | canonical parity |
| W7.3 | per-node selector/stable row identity | row memo 上游 churn | changed-row count assertions | row isolation evidence |
| W7.4 | window/filter/provider/generation projection cache | 多维投影重复 | invalidation matrix | cache correctness/hit rate |
| W7.5 | remove temporary dual projection | 双算放大成本 | parity gate then delete | single-owner proof |

## 10. W8 · Persistence, Compaction and Resource Release

**Common card**

- Prerequisites：W4-W7 data contract；snapshot/rollback ready。
- Boundary：I/O format/index/cleanup；provider context policy 与 UI window 分离。
- Prohibited：无 checkpoint 改 durable schema、为列表标题读全文、session close 不销毁资源。
- Rollback：format version + old reader + checkpoint；compaction 可中断。

| ID | Task | Evidence | Verification | Completion |
|---|---|---|---|---|
| W8.1 | 采 persistence read/write amplification | suffix/full rewrite 尚未定量 | I/O trace | hot I/O map |
| W8.2 | append/suffix persistence prototype | 增量写候选 | crash/disk-full/corrupt journal | migration decision record |
| W8.3 | metadata catalog/index，列表不读全文 | 现有 history I/O debt | 1k/10k sessions | bounded list I/O |
| W8.4 | idle compaction + provider context policy | durable/context 增长 | interrupt/resume/version tests | compaction evidence |
| W8.5 | disposable scope 覆盖 session/plugin resources | switch/disable leak 风险 | 50 switches/activation loops | heap/process plateau |

## 11. W9 · Plugin Activation Performance Contract

**Common card**

- Prerequisites：Plugin Platform P0-P2、W1-W3、W8 lifecycle。
- Boundary：activation/IPC/quota/safe mode；不先做 Marketplace 视觉。
- Prohibited：third-party bootstrap-critical、Registry startup dependency、Worker 当强沙箱、无界 IPC。
- Rollback：runtime/marketplace feature flags、LKG code+data、Core Safe Mode。

| ID | Task | Evidence | Verification | Completion |
|---|---|---|---|---|
| W9.1 | manifest activation phase schema + static audit | 隐式 startup 激活风险 | invalid manifest fixtures | phase contract/gate |
| W9.2 | Extension Host post-interactive startup | host 不应抢 first interaction | 0/10/50 plugin delta | startup isolation evidence |
| W9.3 | per-plugin CPU/memory/IPC/DOM quota + circuit | 故障扩散风险 | flood/leak/hang fixtures | quota action matrix |
| W9.4 | Engine Plugin on-demand process lifecycle | 具体 CLI 全插件化 | send/resume/select/idle/close | process ownership proof |
| W9.5 | install/update verify 与 startup cache 分离 | signature/Registry 成本 | offline/corrupt cache/update | supply-chain startup proof |
| W9.6 | plugin conformance harness | 独立仓库需要统一门禁 | first Engine + Feature pilot | signed conformance report |

## 12. W10 · CI Stress and Cross-platform Release Gate

**Common card**

- Prerequisites：W0 schema；持续接入 W1-W12 fixture，W11/W12 完成后纳入最终 release matrix。
- Boundary：producer/evaluator/release policy；不把不稳定 benchmark 直接变硬门禁。
- Prohibited：只跑一次、忽略噪声、unsupported 写 0、过期 baseline 自动通过。
- Rollback：有噪声的 gate 先 advisory；Safety redline 永远 hard fail。

| ID | Task | Evidence | Verification | Completion |
|---|---|---|---|---|
| W10.1 | microbench repeat/statistical evaluator | 单次数值不可靠 | synthetic regression injection | evaluator tests |
| W10.2 | per-PR static/perf guard | 反模式可提前阻断 | known-bad fixtures | required CI checks |
| W10.3 | nightly large-session/plugin loops | PR 时间预算有限 | scheduled LS/ST/PLUGIN matrix | trend artifacts |
| W10.4 | packaged Win/mac/Linux release rehearsal | dev 不能代替 packaged | clean/upgrade/safe/offline | signed release evidence |
| W10.5 | baseline freshness/approval workflow | 历史 artifact 误用 | stale/changed hardware cases | governance runbook |
| W10.6 | regression ownership and waiver expiry | 临时豁免易永久化 | expired waiver test | owner/deadline registry |

## 13. W11 · Conversational Acquisition and Task Resume

**Common card**

- Prerequisites：W9 runtime/transaction，W12 Manifest/Capability/Resolver contract。
- Boundary：capability gap、discovery、consent、install orchestration、dynamic refresh、continuation；不让 LLM 获得安装 authority。
- Prohibited：silent install、Marketplace 文案进入 instruction、盲目重放 prompt、自动放宽权限、失败后连续试装多个插件。
- Platform：普通 Worker/process 插件 Win/mac/Linux；restart continuation 覆盖 packaged app。
- Rollback：撤销 candidate generation、恢复 lock/checkpoint/binding，原任务安全 suspended。

| ID | Task | Evidence | Verification | Completion |
|---|---|---|---|---|
| W11.1 | Capability Gap 与 versioned Capability Graph | 截图体验首先依赖机器可判定“缺什么” | installed/missing/blocked/schema mismatch fixtures | resolver contract |
| W11.2 | deterministic candidate resolver + ranking policy | 同 capability 多 provider | trust/permission/egress/platform cases | selection decision table |
| W11.3 | structured InstallPlan + consent UI contract | Agent 不能直接安装 | permission expansion/reject/organization policy | consent audit evidence |
| W11.4 | staged install → generation refresh | 安装后当前会话需看到新 tool | signature/health/stale generation tests | atomic graph refresh |
| W11.5 | idempotent TaskContinuation | restart/安装后要续跑原任务 | side-effect/resource-expiry/cancel fixtures | resume correctness artifact |
| W11.6 | “读取图片”端到端 acceptance | 用户给出的目标体验 | no plugin → discover → install → read → disable | packaged demo/evidence |

## 14. W12 · Developer Platform and Ecosystem Governance

**Common card**

- Prerequisites：Plugin Platform P0-P2，W9 conformance skeleton。
- Boundary：SDK/CLI/dependency/contract/publisher/team policy；不实现无关 Marketplace 商业功能。
- Prohibited：独立仓库 import Core internals、runtime `npm install`、plugin 直接访问其他 namespace、随机 provider 抢占。
- Platform：SDK build/conformance 覆盖声明平台/arch；native dependency 必须显式矩阵。
- Rollback：exact lockfile、channel rollback、publisher revoke、old Contract adapter。

| ID | Task | Evidence | Verification | Completion |
|---|---|---|---|---|
| W12.1 | Manifest v1/SDK packages boundary | 独立仓库需要稳定入口 | schema compatibility + no Core internal import | published contract draft |
| W12.2 | Plugin CLI scaffold/dev install/hot reload/debug | 生态 DX 未定义 | clean repo to local plugin journey | Developer Guide + testkit |
| W12.3 | dependency resolver/lockfile/service contracts | transitive 权限与版本冲突 | cycle/conflict/optional/provider cases | deterministic resolution artifact |
| W12.4 | scope/profile/binding model | user/workspace/session 行为未定 | profile merge/policy conflict | scope decision/spec |
| W12.5 | secrets/accounts/network egress broker | 高风险数据边界 | revoke/redaction/domain deny | security conformance |
| W12.6 | publisher/signing/review/revocation workflow | 社区市场供应链 | key rotation/compromise/yank/offline | governance runbook |
| W12.7 | private Registry/team policy | 企业使用边界 | mandatory/blocked/exception expiry | team policy conformance |
| W12.8 | uninstall/export/data retention/dependent handling | 安装容易，退出语义未定义 | keep/export/delete/dependent fixtures | lifecycle acceptance |

## 15. Prioritization

| Priority | Tasks | 理由 |
|---|---|---|
| P0 Safety | W0.1-W0.5, W1.1-W1.5, W2.1/W2.3/W2.5 | 先排 crash/hang 与观测反馈环 |
| P0 Responsiveness | W3.1-W3.3, W4.1-W4.5 | 保护首交互并拆高频根链 |
| P1 Scale | W5.*, W6.*, W7.*, W8.1/W8.3/W8.5 | 控制长会话增长成本 |
| P1 Platform | W9.*, W12.1-W12.3, W10.1-W10.4 | 插件 runtime、SDK 基础与 release gate |
| P1 Experience | W11.1-W11.6 | 完成对话式发现、安装与原任务续跑 |
| P2 Ecosystem | W12.4-W12.8, W8.2/W8.4, W10.5/W10.6 | 在底层 contract 稳定后扩展团队/市场治理 |

## 16. Completion Discipline

任务不能仅以代码 merged 关闭。必须回写：

- baseline/candidate artifact 路径；
- 实际运行命令；
- Win/mac/Linux 状态；
- correctness 与 performance 结论；
- rollback drill；
- 新发现的 deferred risk；
- 受影响 ADR/OpenSpec/main spec/index。
