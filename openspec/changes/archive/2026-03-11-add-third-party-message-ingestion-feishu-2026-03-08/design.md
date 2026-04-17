# Design: Third-Party Message Ingestion (Feishu First)

## 1. 概览

本设计将新增一个客户端内置模块 `ThirdPartyMessageHub`，负责：

- Provider 配置管理（首期 Feishu）
- 连接生命周期管理（start/stop/health/test）
- 外部消息标准化与入站队列
- 与聊天线程系统的会话桥接（Phase 2）

核心目标是把“脚本接入”升级为“产品内接入”，并保证后续可扩展多个 Provider。

## 2. 架构分层

### 2.1 Frontend

- `IntegrationsPage`
  - Provider 列表、配置表单、状态面板、连通性测试按钮
- `FeishuProviderCard`
  - 显示在线状态、最近事件时间、错误诊断
- `ExternalMessageInboxPanel`
  - 展示标准化后的入站消息、过滤与详情
- `ExternalSessionComposer`（Phase 2）
  - 从入站消息创建特殊 session，选择“回复/任务”

### 2.2 Backend (Tauri / Rust)

- `provider_registry`
  - 维护可用 Provider 及运行状态
- `feishu_connector`
  - 基于官方 SDK 长连接接收 `im.message.receive_v1`
- `message_normalizer`
  - 将 Feishu 事件映射为统一 `ExternalMessage`
- `external_session_runtime`（Phase 2）
  - 把外部消息桥接到 CodeMoss 线程与任务执行器

### 2.3 Storage

- `provider_configs`
  - `provider_id`, `app_id`, `secret_encrypted`, `updated_at`
- `external_messages`
  - `provider`, `external_message_id`, `chat_id`, `sender_id`, `content`, `received_at`, `dedupe_key`
- `external_sessions`
  - `session_id`, `provider`, `external_message_id`, `thread_id`, `status`, `last_action_at`

## 3. 关键流程

## 3.1 Phase 1: 配置 + 连通性 + 可视化

1. 用户在 Integrations 页面填写 Feishu `App ID/App Secret`
2. 前端调用 `save_provider_config`，后端加密存储
3. 用户点击“连通性测试”
4. 后端启动 Feishu 长连接并返回状态
5. 收到消息后写入 `external_messages`，前端订阅事件流实时展示

## 3.2 Phase 2: 特殊 Session

1. 用户在消息面板选择一条入站消息
2. 点击“创建特殊 session”
3. 系统创建 `external_session` 并绑定 thread
4. 用户可执行：
   - `Reply`: 发送回复到飞书会话
   - `Run Local Task`: 触发本地任务（需确认）
5. 结果和关联关系写入审计记录

## 4. 关键设计决策

### 决策 A：统一消息模型

- 采用 `ExternalMessage` 统一结构，避免后续每个 Provider 定制 UI。
- 好处：扩展新平台仅需要新增 connector + mapper。

### 决策 B：默认长连接模式

- 首期仅做长连接，避免公网回调部署复杂度。
- Webhook 模式后续作为可选增强能力。

### 决策 C：本地任务强确认

- 特殊 session 触发本地任务必须 explicit confirm，默认拒绝自动执行。
- 降低误触发和安全风险。

## 5. 错误处理与可观测性

- 连接错误分级：认证失败 / 网络失败 / 配置缺失 / 权限不足
- UI 必须展示可读错误文案与建议动作（如“检查发布版本是否生效”）
- 关键操作记录结构化日志：
  - `provider_connected`
  - `provider_connect_failed`
  - `external_message_received`
  - `external_session_created`
  - `external_task_requested` / `external_task_approved` / `external_task_rejected`

## 6. 安全与合规

- `App Secret` 不明文展示，不写入普通日志。
- 本地任务执行必须二次确认并记录审计。
- 对外回复仅允许绑定会话上下文，禁止“无来源发送”。

## 7. 迁移与发布策略

- Phase 1 与 Phase 2 使用 feature flag 分阶段发布：
  - `third_party_ingestion_v1`
  - `external_special_session_v1`
- Phase 1 验证稳定后，再开启 Phase 2。

## 8. 风险与缓解

- 风险：飞书连接在网络波动下频繁重连
  - 缓解：指数退避 + 状态可视化 + 手动重连按钮
- 风险：消息重复推送造成 UI 重复
  - 缓解：基于 `external_message_id` 去重
- 风险：特殊 session 误触发本地任务
  - 缓解：强确认 + 默认只读模式 + 审计日志
