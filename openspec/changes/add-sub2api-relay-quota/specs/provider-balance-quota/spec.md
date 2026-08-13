## ADDED Requirements

### Requirement: Balance shape MUST be reusable by Sub2API wallet mode

`CodingPlanQuotaSnapshot.balance` 形态 MUST 继续作为货币余额载体，除 DeepSeek 外，Sub2API 钱包模式 MUST 填充同一结构：

- `balance.isAvailable: boolean`
- `balance.items[]`：至少 `currency`、`totalBalance`（string）
- Sub2API 成功且为钱包模式时 `source` MUST 为 `sub2api`（不是 `deepseek`）
- DeepSeek 成功路径 MUST 保持 `source=deepseek`，行为不变

#### Scenario: Sub2API wallet uses balance credits UI path

- **WHEN** Sub2API 返回钱包余额且 `windows` 为空
- **THEN** 前端额度视图 MUST 能走既有 balance-only / credits 展示
- **AND** MUST NOT 要求 `windows.length > 0` 才算 coding_plan 成功

#### Scenario: Sub2API windows plus balance coexist

- **WHEN** Sub2API 同时返回可解析 windows 与 balance
- **THEN** snapshot MUST 同时携带二者
- **AND** UI MAY 主展示 windows，并以 credits 次级行展示余额（既有布局）

#### Scenario: DeepSeek unchanged

- **WHEN** base_url 识别为 DeepSeek
- **THEN** 系统 MUST 仍调用官方 `GET https://api.deepseek.com/user/balance`
- **AND** MUST NOT 改为请求 DeepSeek host 上的 `/v1/usage`
