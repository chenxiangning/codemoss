# pi-provider-auth Specification

## Purpose
TBD - created by archiving change add-pi-provider-auth. Update Purpose after archive.
## Requirements
### Requirement: auth.json MUST be the single source of truth for PI provider credentials

系统 MUST 以 `~/.pi/agent/auth.json` 作为 PI CLI 供应商凭证的唯一读写事实源，并遵守以下 contract：

- auth.json 不存在时，系统 MUST 将全部 provider 视为未配置且 MUST NOT 报错。
- auth.json 存在但 JSON 损坏时，系统 MUST fail-closed：返回错误且 MUST NOT 覆写该文件。
- 读取时，catalog 之外的未知条目、`type == "oauth"` 条目、credential 的 `env` 子对象 MUST 原样保留。
- 写入 MUST 为原子写（同目录临时文件 + rename），且 Unix 上文件权限 MUST 为 `0600`。

#### Scenario: Missing auth file renders all-unconfigured

- **WHEN** `~/.pi/agent/auth.json` 不存在
- **THEN** provider 列表 MUST 全部返回未配置 / 未授权状态
- **AND** MUST NOT 创建该文件

#### Scenario: Corrupted auth file is never overwritten

- **WHEN** auth.json 内容不是合法 JSON
- **THEN** 任何写操作 MUST 返回错误
- **AND** 原文件 MUST 保持字节级不变

#### Scenario: Unknown and oauth entries survive writes

- **WHEN** auth.json 含 catalog 外条目与 `type == "oauth"` 条目
- **AND** 用户设置或删除某个 API Key
- **THEN** 写回后的文件 MUST 逐字节保留这些条目（键序可重排，值与结构 MUST 等价）

### Requirement: Full API keys MUST never reach the frontend

后端 MUST 是 key 明文的唯一处理点；任何 command 返回值 MUST NOT 包含完整 API key。mask 规则：

- key 长度 > 10：MUST 返回 `head(6) + "········" + tail(4)`。
- key 长度 ≤ 10：MUST 返回全 mask（不暴露任何字符）。
- key 以 `!`（命令执行）或 `$`（env 插值）开头：MAY 原样返回（本身非秘密）。

#### Scenario: Configured provider shows masked key only

- **WHEN** 某 provider 在 auth.json 有 `api_key` 条目
- **THEN** 列表项 MUST 携带 mask 后的展示串
- **AND** MUST NOT 携带原始 key 的任何超过 head(6)+tail(4) 的片段

#### Scenario: Editor never pre-fills existing key

- **WHEN** 用户打开已配置 provider 的行内编辑器
- **THEN** 输入框 MUST 为空（placeholder 展示 mask）
- **AND** 留空保存 MUST 视为取消，不改动凭证

### Requirement: Credential state MUST follow pi resolution order

provider 状态推导 MUST 与 pi 官方解析顺序（auth.json > 环境变量）一致：

- auth.json 存在该 provider 的 `api_key` 条目 → `configured`（无论 env 是否存在）。
- 否则 mossx 进程环境变量非空 → `env`（「环境变量生效中」）。
- 否则 → `none`。
- `type == "oauth"` 条目 MUST 归类为订阅授权态，不参与 API Key 组状态。

#### Scenario: auth.json wins over environment

- **WHEN** 某 provider 同时存在 auth.json `api_key` 条目与非空环境变量
- **THEN** 状态 MUST 为 `configured`
- **AND** UI MUST NOT 提示「环境变量生效中」

#### Scenario: Env-only provider is read-only informative

- **WHEN** 某 provider 仅环境变量非空
- **THEN** 状态 MUST 为 `env`
- **AND** UI MUST 提供「覆盖设置」入口（写入 auth.json 后转为 `configured`）

### Requirement: API Key set / delete MUST be scoped and safe

- `pi_auth_set_api_key` MUST 只写入目标 provider 的 `{ "type": "api_key", "key" }` 条目。
- `pi_auth_delete_credential` MUST 只删除 `type == "api_key"` 的目标条目；目标为 `type == "oauth"` 时 MUST 拒绝并返回业务错误（OAuth 凭证由 pi 自管）。
- 删除已配置凭证前，UI MUST 二次确认。

#### Scenario: OAuth credential deletion is rejected

- **WHEN** 用户尝试删除 `type == "oauth"` 的条目
- **THEN** 后端 MUST 返回业务错误
- **AND** auth.json MUST 不变

#### Scenario: Delete requires confirmation

- **WHEN** 用户在 UI 点击删除某个已配置 API Key
- **THEN** UI MUST 先展示确认对话框
- **AND** 确认前 MUST NOT 调用删除 command

### Requirement: Provider auth UI MUST live inside the PI CLI settings tab

- 「供应商认证」区块 MUST 渲染在 PI CLI 设置 tab 的「引擎设置」之后，包含订阅授权组（只读状态 + 终端 `pi /login` 引导）与 API Key 组（搜索、三态行、行内编辑器）。
- 订阅授权组 MUST NOT 在 mossx 进程内直接执行 OAuth 流程；引导动作 MUST 为「在工作区内嵌终端启动 `pi` TUI 并自动写入 `/login <provider>」（跨 surface 走 `mossx:terminal-command-request` 事件 + 两段式 PTY 输入）。slash 命令 MUST NOT 作为 argv 传给 pi（会被当作 prompt 发给模型）。终端面板在主 App shell 内，设置页等全屏覆盖层会遮挡终端，处理事件时 MUST 先退出覆盖层（`closeSettings`）再呈现终端。无 active workspace 时 MUST 记录 debug entry 且不破坏设置页。
- 终端内完成 OAuth 后，前端 MUST 以 window focus 事件驱动刷新授权状态（禁轮询）。
- 区块状态 MUST 为组件局部 state：MUST NOT 挂载到 AppShell 根 hook 链，MUST NOT 引入轮询（仅在挂载、写操作与窗口聚焦后刷新）。

#### Scenario: Section renders below engine settings

- **WHEN** 用户打开 CLI 配置管理 → PI CLI
- **THEN** 「供应商认证」区块 MUST 出现在「引擎设置」区块之后
- **AND** 订阅授权组与 API Key 组 MUST 分卡呈现

#### Scenario: OAuth login launches embedded terminal

- **WHEN** 用户点击订阅授权组的「登录」
- **THEN** 系统 MUST 通过 `mossx:terminal-command-request` 事件请求 AppShell 打开工作区内嵌终端
- **AND** 终端 MUST 先启动 `pi`（或用户自定义 piBin），就绪后写入 `/login <provider>`
- **AND** MUST NOT 将 `/login` 作为 argv 传给 pi 进程

#### Scenario: No polling, no root state

- **WHEN** 区块处于空闲展示状态
- **THEN** MUST NOT 存在任何定时器驱动的凭证刷新
- **AND** AppShell domain bag MUST NOT 新增凭证相关 key

### Requirement: Brand icons MUST come from the existing lobehub npm dependency

供应商品牌图标 MUST 从已有 npm 依赖 `@lobehub/icons-static-svg` import（沿用 `providerBrandIcon.ts` 模式，含深底衬规则）；MUST NOT 从 `docs/prototypes/**` 拷贝二进制资产进 `src/`；无公开 logo 的 provider（Radius）MUST 使用 PI mono 黑标，MUST NOT 用字母占位冒充品牌。

#### Scenario: Icon resolution follows existing brand-icon pattern

- **WHEN** 渲染任一 provider 行
- **THEN** 图标 MUST 为 `@lobehub/icons-static-svg` 的 import 资源
- **AND** 白色主体字形图标 MUST 套用既有深底衬瓦片规则

