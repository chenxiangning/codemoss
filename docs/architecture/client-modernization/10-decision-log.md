---
type: architecture
status: active
---

# 10 · Decision Log

> 主线入口：[Client Modernization](README.md)
> 记录规则：Confirmed Decision 只有用户明确确认或 current code/evidence 能证明时才进入；未确认项保留 Open Question。

## 1. Confirmed Product and Architecture Decisions

| ID | Decision | Reason / Consequence | Date |
|---|---|---|---|
| D-001 | Mossx Core 只保留 Engine Contract，具体 CLI 全部插件化 | Engine implementation/version/release 离开 Core | 2026-08-14 |
| D-002 | Core 是“插排 + 少量核心部位”，非核心业务模块逐步插件化 | 内置浏览器、意图画布、便签、项目知识地图等迁出 | 2026-08-14 |
| D-003 | 一个 Extension Host 控制进程；普通插件 per-plugin Worker | control plane 与 execution fault domain 分离 | 2026-08-14 |
| D-004 | 高权限 C 插件与全部 local 插件使用独立受限进程 | Worker 不被误当强安全沙箱 | 2026-08-14 |
| D-005 | UI 支持 trusted React 与 declarative/sandbox 双模式 | 同时支持第一方深集成与第三方安全默认 | 2026-08-14 |
| D-006 | trusted React 白名单后仍须 Error Boundary、熔断、快速拔除与版本回退 | 信任不等于无故障 | 2026-08-14 |
| D-007 | 每插件独立 Storage Namespace | 禁止直接改 Core/其他插件表 | 2026-08-14 |
| D-008 | update 前 Core checkpoint；普通更新向后兼容；破坏性 migration 明示 | 回退 code 时同步恢复 matching data | 2026-08-14 |
| D-009 | 业务插件最终使用独立 Git 仓库，并走统一 Contract/发布链 | repo independence 不等于绕过治理 | 2026-08-14 |
| D-010 | 本轮先写 `docs/` 架构设计，不创建 OpenSpec proposal | 先把综合主线与细节理清，再分小 change | 2026-08-14 |
| D-011 | 冷启动、长会话与 Plugin Performance 必须作为同一综合改善计划 | 插件化会新增 startup/IPC/DOM/storage 成本 | 2026-08-14 |
| D-012 | 后续目标包含对话式插件发现、授权、安装、能力刷新和原任务续跑 | 达到“缺什么能力就安全补什么”的用户体验 | 2026-08-14 |

## 2. Current Implementation Calibration

| ID | Current fact | Status | Implication |
|---|---|---|---|
| C-001 | Windows v0.8.9 packaged startup stack overflow 已用 deep `Box::pin` + `/STACK:8388608` 修复 | fixed-needs-regression | W1 packaged matrix 必须补齐 |
| C-002 | UI scale 当前固定 100%，清理 residual scale | current code | 旧 Windows/macOS zoom 分流结论 stale |
| C-003 | `ComposerGate`/`ComposerLight` 延迟 full Composer | current code | 保留并重测首次输入/activation fan-out |
| C-004 | live assistant text 已外置 | implemented historical/current path | 禁止恢复逐 delta reducer |
| C-005 | reasoning/toolOutput 仍存在 32ms batched operation 路径 | current static evidence | W4 priority |
| C-006 | full Markdown runtime 仍基于 `react-markdown`，没有 true incremental block parser | current static evidence | W5 priority |
| C-007 | timeline static window 仍非常大，virtualization 不构成当前主解 | current static evidence | W6 bounded data window |
| C-008 | AppShell governance split 已推进，但 current render budget 未复测 | unmeasured | 不宣布 root 问题关闭 |
| C-009 | watchdog 有约 15s start delay | current code | 仍需验证 diagnostics feedback |
| C-010 | 2026-07-08 render/FPS 数字是 historical snapshot | historical | W0 必须重新采样 |

## 3. Confirmed Design Constraints for Conversational Install

以下是为实现目标体验所需的 architecture constraints；它们是本设计提出的默认基线，进入产品行为前还需 OpenSpec/用户确认：

1. Agent 只能请求结构化 `InstallPlan`，不能直接获得安装/权限 authority。
2. Marketplace metadata 是 untrusted content，不能变成 Agent instruction。
3. 第一次安装与 permission expansion 默认显式确认。
4. exact version/digest、signature、permissions、data egress、restart scope 必须可见。
5. 安装使用 staged transaction、health gate、atomic generation switch 与 LKG。
6. 安装后动态刷新 Capability Graph/tool schema。
7. 原任务用 idempotent `TaskContinuation` 续跑，不盲目重放整个 prompt。
8. 优先重启最小故障域；只有 Core/native/contract major 才要求 App restart。
9. resume 不得重复外部副作用。
10. 插件失败不影响 Core first-interactive 和当前对话可恢复性。

## 4. Rejected Defaults

| ID | Rejected default | Why |
|---|---|---|
| R-001 | 所有插件无重启热替换 | Core/native major 与某些 trusted UI 需要受控 reload |
| R-002 | Worker = security sandbox | 高权限/local 必须进受限进程 |
| R-003 | Marketplace 先于 isolation/checkpoint 上线 | 会放大供应链和数据风险 |
| R-004 | 启动时联网刷新/验证全部插件 | 污染 critical path，离线不可用 |
| R-005 | 用 debounce 作为长会话根治 | 不改变全量 projection/parse/DOM 成本 |
| R-006 | 用无限 DOM + CSS 隐藏做窗口化 | 内存、更新、语义问题仍存在 |
| R-007 | 直接复制 DeepSeek Harness/Cordis/state library | 应迁移机制，先以 Mossx evidence 决策 |
| R-008 | Agent 静默安装 community plugin | 权限、供应链、prompt injection 风险不可接受 |
| R-009 | 插件独立仓库后直接依赖 Core internals | 会形成分布式 monolith |
| R-010 | 回退代码但保留新 schema 数据 | 会造成未知状态与二次损坏 |

## 5. Open Product Decisions

| ID | Question | Why it matters | Decision deadline |
|---|---|---|---|
| O-001 | 首批 Feature Plugin pilot 选便签、项目知识地图、Browser 还是意图画布？ | 决定 UI/storage/permission 复杂度 | P5 proposal 前 |
| O-002 | organization 预批准的低风险插件能否自动安装？ | consent UX 与企业治理 | W11 proposal 前 |
| O-003 | 默认安装 scope 是 user 还是 workspace？ | profile、数据、同步与权限 | Manifest contract 前 |
| O-004 | 多 provider 默认用户选，还是 policy 选最小权限？ | capability routing UX | Resolver design 前 |
| O-005 | local plugin 是否可能进入 trusted React？ | 最大 renderer 风险之一 | UI runtime gate 前 |
| O-006 | 第一期支持 plugin-to-plugin dependency 吗？ | resolver/lockfile 复杂度 | SDK v1 freeze 前 |
| O-007 | Marketplace 首期仅 curated，还是社区可自助发布？ | review/abuse/operations | P6 proposal 前 |
| O-008 | plugin data 是否进入 Mossx Sync？ | encryption、version、data residency | Storage v1 前 |
| O-009 | restart 后哪些 resumed action 必须再次确认？ | side-effect safety | Continuation contract 前 |
| O-010 | 是否规划 paid plugin/entitlement？ | manifest/listing/account 边界 | Marketplace schema freeze 前 |
| O-011 | plugin 推荐是否允许 telemetry 排序？ | privacy 与 ranking quality | Marketplace product design 前 |
| O-012 | Performance Budget 绝对阈值是多少？ | 需要 W0 current distribution，不可拍脑袋 | W0 completion |

## 6. Decision Process

每个 Open Decision 收口时：

1. 给出真实用户场景；
2. 列出 trust/data/performance/rollback 影响；
3. 使用最小 pilot 验证；
4. 用户明确确认；
5. 更新本表状态与日期；
6. 同步对应分册与 task；
7. 实施时进入独立 OpenSpec change。

## 7. Documentation Audit Trail

本轮综合改善新增：

- 主线、范围、证据交叉审查；
- 冷启动五层因果模型；
- 长会话 render economics；
- Plugin Runtime Performance Contract；
- Observability/Budget；
- W0-W12 workstreams/tasks；
- risk/rollback；
- conversational install/task resume；
- Developer Platform/Ecosystem Governance；
- 本 Decision Log。

后续对话确认任何架构结论时，应双写到对应专题分册与本表；不确定内容留在 Open Product Decisions。
