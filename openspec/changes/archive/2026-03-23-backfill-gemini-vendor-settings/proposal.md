## Why

当前项目已落地 Gemini 供应商配置能力（包含预检、环境变量、认证模式与保存链路），但该能力尚未在 OpenSpec 中形成可追溯的需求契约。  
缺少提案会导致后续设计、任务拆解与回归验收缺乏统一基线，增加维护与协作成本。

## 目标与边界

- 目标：
  - 将已实现的 Gemini 供应商配置行为反推为规范化能力定义。
  - 在“设置 > 供应商”中提供 Gemini 配置入口，与 Claude/Codex 形成一致的供应商管理体验。
  - 明确 Gemini 配置的保存协议、认证模式语义、预检语义与 UI 可见性约束。
- 边界：
  - 本变更仅覆盖“供应商配置”层，不覆盖 Gemini 实时会话/历史会话执行链路。
  - 本变更仅定义配置契约与验收标准，不引入新的外部服务依赖。

## 非目标

- 不实现 Gemini 模型调用、会话创建、消息收发或历史回放能力。
- 不改造 Claude/Codex 的既有供应商配置数据结构。
- 不引入新的鉴权方案，仅对现有认证模式进行配置化支持与校验。

## What Changes

- 新增 Gemini 供应商配置能力，覆盖：
  - 认证模式：`custom` / `login_google` / `gemini_api_key` / `vertex_adc` / `vertex_service_account` / `vertex_api_key`。
  - 关键环境变量映射与模式切换时的字段清理规则。
  - 供应商配置保存与读取（`~/.codemoss/config.json` 的 `gemini` section）。
  - 预检能力（Gemini CLI / Node.js / npm）与 PASS/FAIL 状态展示。
- 供应商页顶部 tab 增加引擎图标（Claude/Codex/Gemini），并保留 Gemini 配置入口。
- Gemini 面板视觉重构后，隐藏头部 banner 行，不影响配置行为与保存语义。
- Gemini 配置默认启用（`enabled=true`）并在保存时保持该语义。

## 方案对比（至少 2 个）

### 方案 A：仅写实现说明，不补 OpenSpec（放弃）

- 优点：短期成本最低。
- 缺点：缺少结构化契约，后续需求变更与回归标准不可追踪。
- 结论：不采用。

### 方案 B：创建独立 Gemini 供应商配置能力规范（采用）

- 优点：边界清晰，可直接驱动 design/tasks 与测试验收。
- 缺点：需要补齐一次性文档成本。
- 结论：采用。该方案与当前代码现状一致，且便于后续扩展到 Gemini 对话链路。

## Capabilities

### New Capabilities

- `vendor-gemini-settings`: 定义 Gemini 供应商配置的入口可见性、认证模式、环境变量映射、预检与保存契约。

### Modified Capabilities

- 无。

## Impact

- 受影响模块：
  - 前端供应商设置页（Tabs、Gemini 配置面板、样式与文案）。
  - Tauri vendors 命令层（Gemini 设置读写、预检命令与注册）。
  - 配置存储（`~/.codemoss/config.json` 的 `gemini` section）。
- 兼容性：
  - 对现有 Claude/Codex 配置无破坏性变更。
  - Gemini 配置路径新增为增量变更。

## 验收标准

- 在“设置 > 供应商”可见 Gemini tab，且 tab 显示引擎图标。
- 进入 Gemini 面板后，预检可返回 Gemini CLI / Node.js / npm 三项状态。
- 认证模式切换后，字段显隐与环境变量同步行为符合模式定义。
- 点击“保存环境变量”与“保存 Gemini 配置”后，重进页面可读回一致配置。
- Gemini 配置默认保持启用语义（`enabled=true`），且不因 UI 简化而丢失配置能力。

