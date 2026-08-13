# Tasks: add-sub2api-relay-quota

## 1. Backend

- [x] 1.1 `sub2api_usage_url`：root / `/v1` / chat 尾缀归一
- [x] 1.2 `parse_sub2api_usage`：余额、planLabel、windows（最多 2）、错误信封
- [x] 1.3 `query_sub2api`：Bearer GET + HTTP 错误语义
- [x] 1.4 `query_by_base_url_and_key`：known host 优先；dashscope 排除；else Sub2API
- [x] 1.5 `resolve_quota_route`：Codex/Claude/Grok 等第三方未知 host + key → `CodingPlanApi`
- [x] 1.6 单元测试：URL、fufei/hajimi 样例 JSON、rate_limits、空 payload、error envelope
- [x] 1.7 Grok：local 官方空凭据 / 非官方 base+key 走 Sub2API；`credentials not found` 不再误映射 unsupported
  - 验证：`cargo test --manifest-path src-tauri/Cargo.toml --lib coding_plan_quota`

## 2. Frontend

- [x] 2.1 确认 HUD / session overview 已支持 balance-only 与 windows+credits
- [x] 2.2 Sub2API HUD 多行：余额 / 总计请求 / 累计消费 / 输入输出 / 累计 Token / 平均响应
- [x] 2.3 404 等错误友好文案（暂不支持），不展示原始 HTTP body
- [x] 2.4 供应商展示 `站点接口+sub2api` / `站点接口+new-api`；金额 2 位小数
- [x] 2.5 Sub2API 失败后回退 New API `GET /api/user/self`（quota/500000）
- [x] 2.6 Review 优化：中文路由错误、失败带 siteOrigin、New API 鉴权文案、零余额可用、主/备超时 8s+6s、Token B 级
- [ ] 2.7（可选后续）`codingPlanWindowLabel` 增加 `daily` 中文标签；quota 倍率可配置


## 3. OpenSpec

- [x] 3.1 创建 change `add-sub2api-relay-quota`（proposal / design / tasks / specs）
- [x] 3.2 `openspec validate add-sub2api-relay-quota --strict --no-interactive` 已通过
- [ ] 3.3 手测：自定义 Sub2API provider 刷新配额窗见余额；主流 host 回归

## 4. Commit

- [ ] 4.1 **用户要求本轮不提交**；验收通过后再 commit
