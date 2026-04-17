# Cross-Layer Thinking Guide（跨层思考指南）

## mossx 的主链路

```text
React Component
  -> Feature Hook
  -> Service Wrapper (src/services/tauri.ts)
  -> Tauri Command (Rust)
  -> Storage / Engine Runtime
  -> Response Mapping
  -> UI State + Render
```

## 高风险边界（High-Risk Boundaries）

- hook <-> `services/tauri.ts`
- `services/tauri.ts` <-> Rust command 参数/字段
- client storage <-> runtime default/fallback
- i18n key <-> UI copy fallback

## 变更前必做

1. 列出所有受影响 command/event/payload 字段。
2. 明确 request 与 response 的 mapping 方向。
3. 定义 fallback（Tauri 不可用 / web-service mode）。
4. 先定义验证策略再写代码。

## 常见失败模式

- 前端字段名改了，service mapping 没更新。
- optional 字段被当 required 使用。
- retry 流程非 idempotent，触发重复副作用。
- listener 未清理，导致重复触发。

## 最低验证集（Minimum Verification）

- `src/services/tauri.test.ts` payload mapping 测试。
- 对应 feature hook/component 的 error + edge case 测试。
- contract 相关命令：

```bash
npm run check:runtime-contracts
npm run doctor:strict
```

## PR 记录要求

- 标注 cross-layer 影响面。
- 标注关键 mapping 变更点。
- 标注验证结果与剩余风险。
