# Change: add-sub2api-relay-quota

## Why

会话「配额窗口」已对接 Kimi / 智谱 / MiniMax / DeepSeek 等主流官方与 Coding Plan host。大量自定义中转站（`fufei.mossx.ai`、`ai.td.ee` 等）基于 **Sub2API** 开源网关，提供统一 `GET /v1/usage` 余额与用量接口，但当前 `detect_provider` 未命中时直接 `unsupported`，用户只能看到「额度查询失败 / unsupported」。

## What Changes

- 后端 `coding_plan_quota`：对 **非已接入主流 host** 且具备 `base_url + api_key` 的 provider，回退调用 Sub2API 兼容接口 `GET {origin}/v1/usage`。
- 解析并映射：钱包余额（`balance`/`remaining`/`unit`）、计划名（`planName`）、可选 rate-limit / subscription 百分比窗、今日/累计 cost（并入 `planLabel` 短文案）。
- `source = sub2api`，`via = api`；复用现有 `balance` + `windows` snapshot 与 HUD/状态面板展示。
- Codex/Claude 第三方未知 host 不再直接 `not a known coding-plan host`，改为走 HTTP 查询路径（内部 Sub2API 回退）。
- OpenSpec：新增 capability `sub2api-relay-quota`，并补充 `provider-balance-quota` 与 Sub2API 的并存规则。

## Impact

| 维度 | 说明 |
| ---- | ---- |
| Backend | `src-tauri/src/coding_plan_quota.rs` |
| Frontend | **无强制改动**（既有 balance-only / windows+credits 布局） |
| IPC | **无新增** command；`get_coding_plan_quota` 响应 additive（`source=sub2api`） |
| Out of scope | New-API `/api/user/self`；无 base/key 的 credentials 解析失败；模型分布/Token 明细表 |

## Acceptance

1. Sub2API 中转（如 root base `https://example.com`）+ 有效 sk → 配额窗显示余额（`USD x.xx`），`source=sub2api`。
2. 响应含 rate_limits 时最多展示 2 个百分比窗（优先 5h / 周）。
3. Kimi / 智谱 / MiniMax / DeepSeek / 官方 Codex·Claude 行为不变。
4. 无效 key → 可读认证错误，非 silent unsupported。
5. `cargo test` coding_plan_quota 相关用例通过。

## Capabilities

- **ADDED** `sub2api-relay-quota`：Sub2API 系中转额度查询路由、URL 归一、响应映射与失败语义。
- **MODIFIED** `provider-balance-quota`：余额型 snapshot 扩展为 DeepSeek **或** Sub2API 钱包余额共用 `balance` 形状。
