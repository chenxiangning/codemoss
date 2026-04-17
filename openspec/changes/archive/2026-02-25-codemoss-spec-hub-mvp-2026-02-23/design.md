## Context

CodeMoss 当前已具备 OpenSpec 使用基础，但规范流程仍分散在文件树、终端命令和聊天上下文中，缺少统一工作台承载执行闭环。Spec
Hub MVP 的目标是建立统一运行时、统一动作层和统一可视化层，让 change 生命周期在客户端内可见、可执行、可验证。

同时，真实使用中存在“首次接入无 OpenSpec”空白场景：

- 老项目：已有业务复杂度，但没有 OpenSpec 目录和项目背景沉淀。
- 新项目：项目刚创建，尚未建立规范骨架与上下文基线。

如果 Spec Hub 仅支持“已存在 OpenSpec”场景，将导致大量项目无法进入规范驱动路径。
此外，在企业/多盘符开发环境中，存在“仓库目录与规范目录分离”的常态：代码在当前 workspace，OpenSpec 资产在外部目录（甚至不同磁盘）。
如果不支持显式配置 Spec 根目录，Spec Hub 会将此类项目误判为 unknown provider，导致能力不可用。

关键约束：

- 前端技术栈为 React + TypeScript，后端通过 Tauri IPC 调用本地能力。
- CLI 执行失败在桌面端是常态场景，必须结构化暴露错误上下文。
- spec-kit 与 OpenSpec 语义不完全一致，首期不应强行做等价支持。

## Goals / Non-Goals

**Goals:**

- 建立统一 Spec Runtime，稳定计算 change 状态与动作可用性。
- 在 Spec Hub 界面提供完整主路径：浏览、执行、验证、反馈。
- 通过 OpenSpec Adapter 提供可追踪的执行编排与结构化诊断。
- 提供 spec-kit 最小兼容（detect/read-only/passthrough），避免误导用户。
- 引入 Environment Doctor，支撑 Managed/BYO 双模式与失败恢复。
- 对无 OpenSpec 的 workspace 提供初始化引导与项目信息采集流程，支持老项目与新项目两类接入路径。
- 提供项目信息后续更新机制，确保规范上下文随项目演进持续维护。
- 支持项目级自定义 Spec 根目录配置，兼容“代码与规范分离存储”场景。

**Non-Goals:**

- 不在本期实现 spec-kit 全动作语义适配。
- 不在本期引入跨仓库统一调度能力。
- 不在本期重构既有 chat 工作流，只做轻量链接与可追踪增强。
- 不在本期实现多 Spec 根目录聚合（single root only）。

## Decisions

### Decision 1: Runtime-First 架构

- 方案 A：UI 直接读取文件并临时计算状态。
- 方案 B：先构建统一 Runtime，再由 UI 订阅状态。**（采用）**

选择理由：

- 状态计算与执行反馈可复用，避免 UI 层重复逻辑。
- 便于后续接入更多 provider，不破坏现有界面契约。

### Decision 2: OpenSpec-first + spec-kit minimal hook

- 方案 A：OpenSpec 与 spec-kit 同期全量支持。
- 方案 B：OpenSpec 深支持，spec-kit 最小兼容。**（采用）**

选择理由：

- 缩短 MVP 交付路径，先拿到稳定可执行闭环。
- 控制语义分歧风险，避免“表面支持、实则不可执行”。

### Decision 3: 执行台动作 Tab 走 Preflight Gate

- 方案 A：允许直接执行，失败后再提示。
- 方案 B：执行前置 gate，先显示 blocker。**（采用）**

选择理由：

- 减少无效命令执行，提高用户预期一致性。
- 可直接把失败变成“可行动修复项”，而非黑盒错误。

### Decision 4: 结构化诊断优先于原始日志

- 方案 A：仅显示 CLI 原始输出。
- 方案 B：输出结构化诊断，并附原始日志入口。**（采用）**

选择理由：

- 结构化数据更易用于 UI 定位与后续统计。
- 保留原始日志入口，兼容高级排障场景。

### Decision 5: Environment Doctor 提供双模式治理

- 方案 A：只支持 BYO，依赖用户自行维护。
- 方案 B：Managed/BYO 并存，workspace 级持久化。**（采用）**

选择理由：

- 新用户可直接进入可用状态，高级用户保留可控路径。
- 统一诊断模型，避免模式切换时行为分裂。

### Decision 6: 无 OpenSpec 场景采用“引导式初始化”，而非仅提示命令

- 方案 A：仅显示“未支持/未知”状态与文档链接。
- 方案 B：在 Spec Hub 内提供初始化引导与执行入口。**（采用）**

选择理由：

- 用户在当前上下文即可完成初始化，不需要切换终端和记忆命令。
- 可把初始化与项目背景采集合并，避免“初始化完成但无上下文”的空壳状态。

### Decision 7: 项目信息采用“结构化文件 + 可追踪更新”管理

- 方案 A：只在首次初始化时收集，不维护后续变更。
- 方案 B：首次采集后支持增量更新，落盘为可追踪文件。**（采用）**

选择理由：

- 规范上下文（领域术语、架构边界、运行约束）会随项目演进变化。
- 将更新记录纳入规范资产，可提升后续 proposal/design/tasks 的一致性。

### Decision 8: Spec 根目录采用“可配置单根 + 默认回退”策略

- 方案 A：仅支持 `<workspace>/openspec` 固定路径。
- 方案 B：支持项目级可配置 Spec 根目录，默认回退 `<workspace>/openspec`。**（采用）**

选择理由：

- 真实工程存在规范资产外置目录，不支持配置会直接阻断 Spec Hub 可用性。
- 保留默认回退路径，避免对现有项目造成迁移成本。
- 单根模型可控，先解决 80% 场景，再评估多根聚合复杂度。

实现约束（MVP）：

- 配置范围为 workspace 级持久化（client store）。
- 路径类型仅支持绝对路径。
- 判定优先级：`customSpecRoot > workspaceDefaultSpecRoot`。
- 自定义路径无效时，Provider 状态降级为 unknown，动作区进入只读并提示修复入口。

### Decision 9: Tasks 复选框采用“可交互写回 + 验证解耦”策略

- 方案 A：Tasks 仅只读，要求用户在外部编辑器手动改 `tasks.md`。
- 方案 B：Tasks 支持直接点击复选框并写回 `tasks.md`，`验证` 与复选框状态解耦。**（采用）**

选择理由：

- 用户测试完成后可在同一工作台完成任务状态维护，减少“实现已完成但任务文档滞后”。
- `验证` 保持语义纯粹（只做规范校验），避免自动勾选导致审计语义混淆。
- 可在 `归档` 门禁中明确要求“验证通过 + 必需任务已勾选”，提升流程可信度。

实现约束（MVP）：

- 仅允许编辑当前选中 change 的 `tasks.md` 复选框，不改动其他 artifact。
- 采用乐观更新 + 失败回滚：写回失败时恢复原勾选状态并提示错误。
- 写回成功后触发局部 snapshot 重建，保证任务进度与动作门禁同步。
- `归档` 门禁默认以 `P0/P1` 任务为必需项（策略可后续配置化）。

### Decision 10: 会话层继承 Spec Hub 的 resolvedSpecRoot（会话级关联）

- 方案 A：新会话只执行默认规范扫描规则（项目内 `.claude/.codex/openspec` + 平级推导）。
- 方案 B：新会话继承 Spec Hub 当前 `resolvedSpecRoot`，并将其作为会话规范扫描白名单输入。**（采用）**

选择理由：

- 解决“Spec Hub 可见但新会话不可见”的一致性断裂。
- 降低用户重复配置成本，确保跨会话行为稳定。
- 避免 silent fallback：从“猜路径”改为“显式绑定 + 可观测”。

实现约束（MVP）：

- 继承范围为 workspace 级，仅作用于新建会话。
- 会话启动时执行 spec 可见性探测：`visible | invalid | permissionDenied | malformed`。
- 探测失败时必须展示结构化修复入口（重绑当前 Spec Hub 路径 / 恢复默认路径）。
- 问答“你能看到我的 spec 吗”必须基于探测结果，而非模板化回答。

## Risks / Trade-offs

- [Risk] Runtime 与真实文件状态短暂不一致。  
  Mitigation: 动作执行后强制触发局部重建与状态刷新。

- [Risk] Provider 识别误判导致错误动作可见。  
  Mitigation: provider 识别失败默认降级为只读，并显式展示“不确定”状态。

- [Risk] 环境诊断信息不足导致修复成本高。  
  Mitigation: 诊断结果包含命令、路径、版本、建议修复步骤。

- [Risk] spec-kit 用户预期过高。  
  Mitigation: 在执行台与详情视图中明确标注 minimal 支持边界与外部跳转策略。

- [Risk] 外部路径权限或可用性波动导致状态抖动。  
  Mitigation: 增加路径校验缓存与显式刷新按钮；错误状态保留最后一次有效路径信息。

- [Risk] 配置错误导致动作误执行到错误目录。  
  Mitigation: 执行前回显“当前 Spec 根目录”，并在 preflight 中校验关键目录结构（`changes/`、`specs/`）。

- [Risk] 任务误点导致状态误写回。  
  Mitigation: 提供写回失败回滚、时间线记录变更事件，并支持快速反选恢复。

- [Risk] “验证通过”被误解为“任务已完成”。  
  Mitigation: 在文案和门禁中明确区分：验证只校验规范，任务完成需人工勾选确认。

- [Risk] 会话继承链路失败导致用户误判“未接入规范”。  
  Mitigation: 会话首屏回显已关联路径与探测状态，禁止 silent fallback。

- [Risk] Spec Hub 路径变更与新会话缓存不同步。  
  Mitigation: 新会话创建前强制读取 workspace 最新 `resolvedSpecRoot`，并记录注入日志。

## Migration Plan

1. Phase 1（MVP 主路径）
    - 上线 Runtime + OpenSpec Adapter + Spec Hub 基础界面。
    - 支持核心动作：`continue/apply/verify/archive`。
2. Phase 2（环境治理）
    - 上线 Environment Doctor 与 Managed/BYO 模式持久化。
    - 接入失败恢复与重试流程。
3. Phase 3（兼容扩展）
    - 上线 spec-kit minimal hook（detect/read-only/passthrough）。
    - 按使用数据评估是否进入完整 adapter 方案。
4. Phase 4（初始化与上下文治理）
    - 上线无 OpenSpec 场景引导：老项目接入 / 新项目接入。
    - 接入 `openspec init` 执行路径与失败恢复提示。
    - 上线项目信息采集与后续更新流程（结构化存储 + 历史追踪）。
5. Phase 5（会话级规范关联治理）
    - 新会话继承 Spec Hub `resolvedSpecRoot` 并注入规范扫描白名单。
    - 上线会话首屏 spec 可见性探测与修复入口。
    - 建立“会话回答与探测状态一致”的回归测试。

Rollback Strategy:

- 若执行链路不稳定，可临时关闭执行台动作 Tab，仅保留浏览与诊断视图。
- 若 Doctor 稳定性不足，可回退至 BYO-only 模式并保留诊断面板。

## Open Questions

1. Managed 模式依赖安装位置采用全局目录还是 workspace 私有目录？
2. Timeline 是否在 MVP 纳入 commit 关联，还是仅记录 spec actions/validate events？
3. spec-kit 从 minimal 升级为 full adapter 的准入阈值如何量化（使用量、失败率、维护成本）？
4. 项目信息文件最终落盘位置采用 `openspec/project.md` 还是 `openspec/context/project-info.md`？
5. 老项目项目信息采集是否需要引入“自动预填 + 人工确认”的双阶段策略？
6. 自定义 Spec 根目录是否需要团队共享（写入仓库配置）还是保持本地 workspace 私有配置？
7. `归档` 门禁中的“必需任务”是否长期固定为 `P0/P1`，还是改为可配置策略（例如按标签/责任人）？
8. 会话级 spec 关联是否需要“每次提问前重探测”，还是“启动探测 + 显式刷新”策略？

### Decision 11: `继续/执行` 采用“结果优先（Result-First）”交互契约

- 方案 A：保留现状，动作只触发命令并依赖时间线查看结果。
- 方案 B：动作执行后必须在当前动作面板同步回显“状态 + 结果摘要 + 下一步”。**（采用）**

选择理由：

- 用户点击行为的目标不是“执行过命令”，而是“获得可推进决策”。
- 结果可见是按钮价值成立的前提，否则体验退化为“黑盒触发器”。
- 可将 Spec Hub 从“命令入口”升级为“流程入口”，降低对外部聊天窗口依赖。

实现约束（MVP）：

- `继续` 与 `执行` 共用统一结果卡片协议（状态、摘要、下一步）。
- 300ms 内必须进入可见运行态，避免静默。
- 结果摘要优先于原始日志；原始日志作为折叠辅助信息。
- “无新增建议”必须显式提示，不允许仅更新时间戳。
- 失败时必须给出恢复动作：重试 / 查看原始输出 / AI 接管（可修复场景）。

## Risks / Trade-offs（追加）

- [Risk] 结果摘要解析错误，导致误导下一步。  
  Mitigation: 摘要由规则模板生成，保留原始输出对照，并在失败场景降级为“仅原始输出 + 明确提示”。

- [Risk] 动作面板信息过载，影响可读性。  
  Mitigation: 采用折叠策略，默认展示“当前状态 + 关键结论 + 下一步”，详细日志二级展开。

## Migration Plan（追加）

6. Phase 6（动作反馈闭环）
    - 为 `继续/执行` 接入统一运行态与结果卡片。
    - 接入“有产出/无产出”判定与下一步推荐按钮。
    - 建立 `继续/执行` 与时间线一致性回归测试。
