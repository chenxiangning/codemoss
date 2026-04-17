## Why

CodeMoss 目前缺少“外部消息进入客户端”的统一入口。用户已验证飞书机器人长连接可接收消息，但在产品内还没有配置界面、连通性检测和消息可视化能力，导致接入流程依赖命令行和临时脚本，不可运营、不可维护。

本提案目标是把“飞书消息接入”从临时脚本升级为正式模块，并在后续扩展为“基于外部消息创建特殊会话，支持自动答复与本地任务执行”的创新交互模式。

## 目标与边界

### 目标

- 增加全新模块：`三方消息接入`。
- 第一步落地飞书接入配置页：支持填写 `App ID/App Secret`、保存配置、连通性测试、状态可视化、接收消息可视化。
- 第二步定义“特殊 session”能力：基于外部消息创建会话，支持飞书答复与本地任务执行。
- 采用统一 Provider 抽象，为后续钉钉/企业微信/Slack 等扩展留接口。

### 边界

- 本变更以 `飞书` 为首个 Provider，不实现其他平台接入。
- 连接模式优先 `长连接`，Webhook 作为后续能力，不在本阶段实现。
- 不在本变更内实现复杂自动化编排市场能力（如可视化工作流编辑器）。
- 不变更现有 Codex/Claude/OpenCode 普通聊天链路。

## 非目标

- 不做多租户 SaaS 管理后台。
- 不在本次提案中接入支付、计费、审计报表。
- 不做“无确认自动执行高风险本地任务”。

## 技术方案对比

| 方案 | 描述 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A. 客户端内置 Provider Runtime（推荐） | 在 CodeMoss 客户端中新增 `third-party-message` 模块，内置飞书连接器、状态机、事件总线与会话桥接 | 用户体验完整、配置可视、状态可观测、可演进为统一多平台网关 | 首次改动面较大，需要定义统一事件模型 | 采用 |
| B. 外部 Sidecar 进程桥接 | 继续使用独立脚本/服务接收飞书消息，再通过本地端口推送到客户端 | 研发启动快，改动主程序少 | 运维碎片化、配置分散、稳定性与可观测性弱 | 不采用 |
| C. 仅保留 CLI 手工命令 | 维持当前脚本模式，不做 UI 模块化 | 成本最低 | 对普通用户不可用，不具备产品能力 | 不采用 |

## What Changes

- 新增 capability：`third-party-message-ingestion`
- 新增 capability：`feishu-message-connector`
- 新增 capability：`external-message-special-session`

Phase 1（先交付）：
- 客户端新增“第三方消息接入”配置页（Provider 列表 + Feishu 配置表单 + 连通性测试）。
- 增加 Feishu 长连接生命周期状态（未配置/已配置/连接中/在线/失败）。
- 接收消息入统一消息模型，并在 UI 中可见（最近消息时间线 + 原始 payload 预览）。

Phase 2（创新能力）：
- 基于入站消息创建“特殊 session”（External Session）。
- 在特殊 session 中提供两类动作：`回复飞书消息`、`执行本地任务`。
- 增加执行守卫：本地任务默认需用户确认，保留审计链路。

## 验收标准

- 功能可见性
  - 客户端 MUST 存在独立“第三方消息接入”模块入口。
  - 飞书 Provider 配置页 MUST 支持填写并保存 `App ID/App Secret`。
- 连通性
  - 用户点击“连通性测试”后，系统 MUST 给出明确结果（成功/失败）和可读诊断信息。
  - 成功后 MUST 展示在线状态与最近心跳/事件时间。
- 消息接入
  - 接收到 `im.message.receive_v1` 文本消息后，UI MUST 在消息列表展示对应记录。
  - 同一 `message_id` 重复上报 MUST 去重。
- 特殊 session（Phase 2）
  - 用户从入站消息发起特殊 session 后 MUST 可执行“答复飞书”。
  - 用户触发本地任务时 MUST 经过显式确认并记录执行结果。

## Impact

- 前端
  - `src/features/integrations/third-party-messages/*`（新）
  - `src/features/integrations/providers/feishu/*`（新）
  - `src/features/threads/*`（新增 external session 路由分支）
  - `src/i18n/locales/en.ts`
  - `src/i18n/locales/zh.ts`
- 后端（Tauri / Rust）
  - `src-tauri/src/integrations/feishu/*`（新）
  - `src-tauri/src/engine/events.rs`（新增 external message event mapping）
  - `src-tauri/src/commands/*`（新增连接测试/状态查询/回复发送命令）
- 存储
  - `external-provider-config`（密钥加密存储）
  - `external-message-inbox`（消息元数据与去重键）
  - `external-session-links`（消息与会话/任务关联）
