# Type Safety（类型安全规范）

## Baseline

- `TypeScript strict` 开启。
- `noUnusedLocals/noUnusedParameters` 开启。
- 使用 `@/*` alias 统一 import 路径。

## 类型组织（Type Organization）

- 通用 domain/runtime type 放 shared type 模块（例如 `src/types` 或 service type export）。
- feature 私有 type 放 feature slice 内。
- command payload/response type 以 service 层为单一入口。

## Runtime Validation 策略

项目当前不是单一 schema 库驱动，采用 guard + sanitize 模式：

- `unknown` 错误先 normalize。
- persisted value 先校验再用。
- runtime payload 先 mapping 再进 UI。

## 推荐模式

- mode/state 分支优先使用 discriminated union。
- 可空字段显式 `T | null`。
- `Result`/`fallback` 风格函数优先于裸断言。

## `any` 使用策略

- ESLint 未全局禁止 `any`，但团队规范将其限定在 boundary ingestion。
- 一旦使用 `any`，必须在最近位置完成 narrowing/mapping。
- 核心业务流程禁止传播裸 `any`。

## 禁止项

- 连环断言：`as unknown as X`。
- 未证明的宽泛 generic helper。
- 原始 backend payload 直接进入 UI state。
