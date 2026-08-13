## ADDED Requirements

### Requirement: Unknown third-party base MUST fall back to Sub2API usage endpoint

当 provider 的 `base_url` **不是** 已接入的主流 Coding Plan / DeepSeek / 官方 Anthropic·OpenAI / dashscope coding host，且 `api_key` 非空时，系统 MUST 通过 Sub2API 兼容接口查询额度：

- Endpoint MUST 为 `GET` 归一化后的 usage URL（见 URL 规则）。
- 鉴权 MUST 使用 `Authorization: Bearer <api_key>`。
- 成功时 `CodingPlanQuotaSnapshot.source` MUST 为 `sub2api`，`via` MUST 为 `api`。
- MUST NOT 要求维护中转域名白名单。

#### Scenario: Root base URL

- **WHEN** `base_url` 为 `https://fufei.mossx.ai`（或等价 root）
- **AND** API key 非空
- **THEN** 请求 URL MUST 为 `https://fufei.mossx.ai/v1/usage`
- **AND** 成功响应 MUST 映射为 `source=sub2api`

#### Scenario: Base ends with /v1

- **WHEN** `base_url` 为 `https://example.com/v1`
- **THEN** 请求 URL MUST 为 `https://example.com/v1/usage`

#### Scenario: Chat completions suffix stripped

- **WHEN** `base_url` 为 `https://example.com/v1/chat/completions`
- **THEN** 请求 URL MUST 为 `https://example.com/v1/usage`

#### Scenario: Known coding-plan host priority

- **WHEN** `base_url` 匹配 Kimi / MiniMax / 智谱 / DeepSeek 已识别 host
- **THEN** 系统 MUST 走专用查询路径
- **AND** MUST NOT 调用 Sub2API `/v1/usage` 作为首选

#### Scenario: Dashscope coding plan stays unsupported

- **WHEN** `base_url` 为阿里云 Bailian coding host
- **THEN** 系统 MUST NOT 将失败伪装为 Sub2API 成功
- **AND** MUST 返回既有「无公开额度 API」类 unsupported 语义

### Requirement: Sub2API usage response MUST map to balance and optional windows

解析 `GET /v1/usage` 成功 body 时系统 MUST：

- 将 `balance` 或 `remaining`（数值）与 `unit`/`currency`（默认 `USD`）映射为 `balance.items[0]`（`totalBalance` 为格式化字符串）。
- 将 `isValid` / `is_available` 映射为 `balance.isAvailable`（缺省 `true`）。
- 将 `planName` 与可选 `usage.today|total.actual_cost` 合成 `planLabel`（超长截断）。
- 若存在 `rate_limits` / `windows` / `limits` 或 subscription 日周月窗，MUST 解析为 `windows[]`，最多保留 2 个，优先 `five_hour` 再周窗。
- `daily_usage`、`model_stats`、`rpm`、`tpm` MAY 忽略。

成功条件：`balance.items` 非空 **或** `windows` 非空 **或** `usageSummary` 有任一字段；否则 MUST `success=false` 并给出可读 error。

### Requirement: Sub2API HUD MUST show usage summary rows

成功解析 Sub2API usage 时，snapshot MUST 填充 additive 字段 `usageSummary`（camelCase），供配额窗口展示：

| 展示 | 字段 |
| ---- | ---- |
| 余额 | `balance.items[0]`（既有 credits） |
| 总计请求 | `usageSummary.totalRequests` ← `usage.total.requests` |
| 累计消费 | `usageSummary.totalActualCost` ← `usage.total.actual_cost`（格式化字符串） |
| 输入 / 输出 | `totalInputTokens` / `totalOutputTokens` |
| 累计 Token | `totalTokens` |
| 平均响应 | `averageDurationMs` ← `usage.average_duration_ms` |

UI MUST 用紧凑 Token（如 6.6K）与秒级耗时（如 3.88s）。

#### Scenario: fufei wallet payload fills summary

- **WHEN** body 含 balance 与 usage.total / average_duration_ms
- **THEN** HUD MUST 可同时展示余额与上述用量行
- **AND** `source` MUST 为 `sub2api`

### Requirement: Sub2API failures MUST use user-facing copy

对 Sub2API 查询失败，error 文案 MUST 为中文用户可读句，MUST NOT 包含 HTTP status 原文、URL、响应 body 或上游 `message` 堆栈：

| 情况 | 文案示例 |
| ---- | -------- |
| 404 / 客户端 4xx | 该中转站暂不支持额度查询 |
| 401 / 403 / invalid key | 密钥无效或未授权 |
| 网络 / 5xx | 网络异常，请稍后重试 |
| 空 payload / 无法解析 | 暂无可用额度数据 / 暂不支持该中转站的额度格式 |

#### Scenario: 404 does not leak raw body

- **WHEN** usage 接口返回 404
- **THEN** snapshot.error MUST 为「该中转站暂不支持额度查询」或等价友好句
- **AND** MUST NOT 包含 `HTTP 404`、路径或 HTML body

### Requirement: Relay probe MUST fall back Sub2API then New API

对未知中转 base+key，额度查询 MUST 按顺序：

1. Sub2API：`GET {origin}/v1/usage`（Bearer API key）
2. 若失败（含 404 / 鉴权失败 / 空 payload / 网络错误）→ New API / One API：`GET {origin}/api/user/self`（Bearer 同一 key）

New API 成功时：

- `source` MUST 为 `new_api`
- `data.quota`（或 `remain_quota`）MUST 按 `quota / 500000` 折算为 USD 余额填入 `balance`
- `used_quota` MAY 映射为 `usageSummary.totalActualCost`
- `request_count` MAY 映射为 `usageSummary.totalRequests`

供应商展示 MUST 为变量拼接：`{siteOrigin} {source}`（空格分隔，禁止 `+`，禁止写死「站点接口」/协议名）。金额字段 MUST 保留 2 位小数。

#### Scenario: Sub2API 404 then New API success

- **WHEN** `/v1/usage` 返回 404
- **AND** `/api/user/self` 返回 200 且含 `data.quota`
- **THEN** snapshot MUST `success=true` 且 `source=new_api`
- **AND** 前端供应商 MUST 显示 `{siteOrigin} new_api`（origin 为真实 base 解析值）

#### Scenario: both fail

- **WHEN** Sub2API 与 New API 均失败
- **THEN** 系统 MUST 返回友好 error（不暴露原始 HTTP body）

#### Scenario: Wallet-only response

- **WHEN** body 含 `balance`、`unit=USD`、`planName`，无 rate_limits
- **THEN** snapshot MUST `success=true`
- **AND** `balance.items[0].currency` MUST 为 `USD`
- **AND** `windows` MUST 为空数组

#### Scenario: Rate-limit windows without wallet

- **WHEN** body 仅含可解析的 `rate_limits` 百分比或 used/limit
- **THEN** snapshot MUST `success=true`
- **AND** `windows.length` MUST 在 1..2
- **AND** `balance` MAY 为空

#### Scenario: Invalid API key envelope

- **WHEN** body 为 `{ "code": "INVALID_API_KEY", "message": "..." }` 且无 balance
- **THEN** 解析 MUST 失败
- **AND** 对外 error MUST 包含 message 或等价认证失败语义

#### Scenario: HTTP 401/403

- **WHEN** usage 接口返回 401 或 403
- **THEN** snapshot MUST `success=false`
- **AND** `error` MUST 表明认证失败
- **AND** `source` MUST 为 `sub2api` 或等价错误归类

### Requirement: Third-party Codex/Claude routes MUST reach HTTP quota path

Codex / Claude 在非官方 base 且 API key 非空时，MUST 进入 `CodingPlanApi` 查询路径（已知 host 专用或 Sub2API 回退），MUST NOT 仅因「not a known coding-plan host」短路为 unsupported。

#### Scenario: Codex managed Sub2API relay

- **WHEN** engine 为 `codex`，managed provider `base_url` 为自定义中转 root，key 非空
- **THEN** 路由 MUST 为 CodingPlanApi
- **AND** 查询层 MUST 尝试 Sub2API usage（若非已知 host）

#### Scenario: Empty key still fails closed

- **WHEN** 第三方 base 非空但 api_key 为空
- **THEN** snapshot MUST 表示凭据缺失
- **AND** MUST NOT 发起 usage HTTP 请求

### Requirement: Grok non-official managed providers MUST use Sub2API

Grok 引擎 MUST 区分官方与自定义中转：

- Profile id 为 `__local_config_toml__`（或等价本地官方）→ MUST NOT 报 `credentials not found` 为 unsupported；MUST 视为无 HTTP 额度（`source=none` 或等价可隐藏空态）。
- Managed provider 的 `baseUrl` 为官方 `api.x.ai` / `grok.x.ai` → MUST NOT 走 Sub2API。
- Managed provider 的 `baseUrl` 为其它中转且 `apiKey` 非空 → MUST 走 Sub2API `GET /v1/usage`（与通用未知 host 回退一致）。
- 凭据解析失败文案含 `credentials` 时，source MUST 归类为 `empty_credentials`，MUST NOT 仅因含 `not found` 映射为 `unsupported`。

#### Scenario: Grok local profile reads ~/.grok/config.toml

- **WHEN** engine 为 `grok` 且 providerProfileId 为 `__local_config_toml__`（或 current 指向 local）
- **THEN** 系统 MUST 从 `$GROK_HOME/config.toml` 或 `~/.grok/config.toml` 读取 default model 的 `base_url` + `api_key`
- **AND** MUST NOT 因 app `grok.providers` 为空而直接报 credentials not found

#### Scenario: Grok local toml points at Sub2API relay

- **WHEN** local config.toml 中 `base_url` 为 `https://fufei.mossx.ai/v1`（非 `api.x.ai`）且 `api_key` 非空
- **THEN** 路由 MUST 进入 Sub2API `GET /v1/usage`
- **AND** 成功时 `source` MUST 为 `sub2api`

#### Scenario: Grok managed custom Sub2API relay

- **WHEN** engine 为 `grok`，managed provider `baseUrl` 为自定义中转，`apiKey` 非空
- **THEN** 路由 MUST 进入 CodingPlanApi / Sub2API usage 查询
- **AND** 成功时 `source` MUST 为 `sub2api`
