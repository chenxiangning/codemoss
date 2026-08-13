# Design: add-sub2api-relay-quota

## Context

`get_coding_plan_quota(engine, providerProfileId)` 决策链：

1. `engine=kimi` → CLI OAuth `/usages`（不变）
2. 解析 base_url + api_key
3. 官方 Codex / Claude → OfficialRuntime / none
4. 已知 host → Kimi/Zhipu/MiniMax/DeepSeek 专用 HTTP
5. **（本 change）** 其余第三方 → Sub2API `GET /v1/usage`

前端 `buildSessionOverviewQuota` / `SessionControlQuotaPane` 已支持：

- 仅 `balance` → 余额-only 行
- `windows` + 可选 `hasCredits` → 双窗 + 次级余额行
- `planLabel` → planType 文案

## Decisions

### D1: 未知 host 一律尝试 Sub2API，而非域名白名单

**理由**：中转域名极多且常变；Sub2API 约定稳定。非 Sub2API 站返回 404/非 JSON 时表面失败即可。

### D2: URL 归一

| base 形态 | usage URL |
| --------- | --------- |
| `https://host` | `https://host/v1/usage` |
| `https://host/v1` | `https://host/v1/usage` |
| `https://host/v1/chat/completions` | 剥 chat 尾缀后按 `/v1` 规则 |

### D3: 字段映射（MVP）

| API | Snapshot |
| --- | -------- |
| `balance`/`remaining` + `unit` | `balance.items[0]` |
| `isValid` | `balance.isAvailable` |
| `planName` + today/total cost | `planLabel`（≤40 字） |
| `rate_limits`/`windows`/subscription 窗 | `windows[]`（最多 2，优先 five_hour / weekly_limit） |
| `daily_usage`/`model_stats`/`rpm`/`tpm` | **不映射**（HUD 无槽） |

### D4: 成功条件

`balance` 有条目 **或** `windows` 非空 → `success=true`，`source=sub2api`。

### D5: 排除面

- 已 `detect_provider` 命中 → 专用路径优先
- dashscope coding plan → 保持「无公开 API」文案
- 官方 openai/anthropic → 不进 Sub2API
- 空 base/key → `empty_credentials`（如 Grok credentials not found 仍在解析层）

## Risks

| 风险 | 缓解 |
| ---- | ---- |
| New-API 站无 `/v1/usage` | 明确 error；后续可加第二条探测 |
| planLabel 过长 | 截断 40 字 |
| rate_limits schema 分叉 | 宽松解析 used/limit/percent；解析不到则仅余额 |

## Rollback

还原 `coding_plan_quota.rs` 即可；IPC 无破坏性字段删除。
