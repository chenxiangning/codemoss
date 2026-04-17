# Error Handling（backend）

## 基本原则

- backend command 统一返回 `Result<T, String>`（当前项目约定）。
- 错误要可定位（定位到模块/动作/关键参数上下文）。
- 不允许 silent failure；失败必须返回可解释 message。

## Scenario: Tauri command / storage / process error

### 1. Scope / Trigger

- Trigger：新增或修改 `#[tauri::command]`、storage 读写、外部 process 调用、engine/runtime 边界。
- 这类错误会直接穿透到 frontend `src/services/tauri.ts`，因此 message contract 必须稳定、可读、可追踪。

### 2. Signatures

- Tauri command：`Result<T, String>`
- 内部 helper：可先返回 richer error，但在 command boundary 必须统一 normalize 成 `String`
- frontend 侧按 string message 消费，不依赖 backend 私有 error type

### 3. Contracts

- 返回消息至少包含：动作 + 对象 + 失败原因，例如 `failed to read settings: ...`
- message 可以带上下文，但不能泄露 secret/token/完整敏感内容
- 需要 retry 的操作必须保持 idempotent，避免半成功状态重复污染

### 4. Validation & Error Matrix

| 场景 | 正确处理 | 禁止处理 |
|---|---|---|
| 文件不存在 | 返回 default/fallback 或明确 not found message | `unwrap()` panic |
| JSON 解析失败 | 返回 parse failure message，必要时 fallback | 吞掉错误继续返回成功 |
| lock timeout | 返回 timeout + path context | 无限重试卡死 |
| 外部命令失败 | 附操作上下文返回 `Err(String)` | 只返回 `failed` |

### 5. Good / Base / Bad Cases

- Good：`map_err(|error| format!("failed to write settings: {error}"))`
- Base：读不存在文件时返回 default model
- Bad：`expect("write settings")`、`let _ = write_settings(...)`

### 6. Tests Required

- command happy path / error path
- IO error、parse error、timeout error
- frontend 依赖该 command 时，至少校验一条 message contract 不为空且可读

### 7. Wrong vs Correct

#### Wrong

```rust
let data = std::fs::read_to_string(path).unwrap();
let payload: Settings = serde_json::from_str(&data).unwrap();
Ok(payload)
```

#### Correct

```rust
let data = std::fs::read_to_string(path)
    .map_err(|error| format!("failed to read settings {}: {error}", path.display()))?;
let payload: Settings = serde_json::from_str(&data)
    .map_err(|error| format!("failed to parse settings {}: {error}", path.display()))?;
Ok(payload)
```

## 传播策略

- IO/serde/process 错误统一 `map_err(|e| e.to_string())` 并补充上下文。
- 对外 message 要稳定，不把内部敏感实现细节暴露给 UI。
- 对 retry-safe 操作，保持 idempotent 语义。

## 并发与锁相关错误

- 锁超时必须返回明确提示（例如 lock file timeout）。
- 遇到 stale lock 时按既有策略清理，不可直接 panic。
- `Mutex` 临界区最小化，避免在锁内执行重 IO 或长耗时操作。

## 禁止项

- `unwrap()` / `expect()` 出现在 runtime path。
- 直接吞掉 `Err` 后继续返回成功。
- 在跨层 contract 改动时只改一侧（backend/frontend 不一致）。

## 推荐实践

- 对 command 入口先做参数校验（validate first）。
- 对未知错误统一 normalize 后返回。
- 在测试里覆盖 error path（尤其是 IO/parse/timeout 场景）。
