# Data Storage Guidelines（文件存储与一致性）

> 当前项目核心是 file-based persistence，不是传统 SQL-first 架构。

## 现有模式（必须复用）

- 原子写：`write_string_atomically(...)`
- 文件锁：`acquire_storage_lock(...)` / `with_storage_lock(...)`
- stale lock 处理：按超时策略清理
- JSON 序列化：`serde_json`（必要时 `rename_all = "camelCase"`）

## Scenario: 持久化 workspace / settings / client store / project memory

### 1. Scope / Trigger

- Trigger：修改 `storage.rs`、`client_storage.rs`、`project_memory.rs`、任何 file-based persistence。
- 目标：避免并发写覆盖、半写入、锁泄漏、旧数据不兼容。

### 2. Signatures

- lock acquisition：`acquire_storage_lock(...)` / `with_storage_lock(...)`
- atomic write：`write_string_atomically(...)`
- 调用方 contract：先准备完整 payload，再进入 lock + write path

### 3. Contracts

- 关键 JSON 文件写入必须遵循 `lock -> serialize -> temp write -> rename`
- 多线程/多进程都可能竞争同一路径，不能假设单写者
- serialization 字段名与 frontend mapping 保持兼容；变更字段时优先 backward compatibility

### 4. Validation & Error Matrix

| 场景 | 正确处理 | 禁止处理 |
|---|---|---|
| 并发写 | 加 lock 后写入 | 无锁直接覆盖 |
| stale lock | 清理过期 lock 后继续 | 永久阻塞 |
| Windows rename | 先移除旧文件再 rename（按现有实现） | 直接假设 Unix 行为 |
| JSON 损坏 | 返回 parse error / fallback default | 写入空对象掩盖问题 |

### 5. Good / Base / Bad Cases

- Good：复用 `with_storage_lock` + `write_string_atomically`
- Base：不存在的 settings 文件返回 default
- Bad：`std::fs::write(path, payload)` 直接覆盖关键状态文件

### 6. Tests Required

- 并发写入不会生成损坏文件
- stale lock 被正确清理
- Windows / rename 兼容逻辑至少有行为说明或测试覆盖
- 旧版 JSON 结构读取后仍能 fallback

### 7. Wrong vs Correct

#### Wrong

```rust
let data = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
std::fs::write(path, data).map_err(|e| e.to_string())?;
```

#### Correct

```rust
with_storage_lock(path, || {
    let data = serde_json::to_string_pretty(&settings)
        .map_err(|error| format!("failed to serialize settings: {error}"))?;
    write_string_atomically(path, &data)
})?;
```

## 写入规则

- 先写 temp file，再 rename 覆盖（atomic replace）。
- 任何可并发写入路径必须加锁。
- 不允许直接 `std::fs::write` 覆盖关键状态文件。

## 一致性规则

- 读写 key/字段命名与 frontend mapping 保持一致。
- 数据迁移必须兼容旧结构（backward compatibility）。
- 默认值逻辑要集中，避免多处分叉 fallback。

## 性能规则

- CPU/IO 重任务使用 `tokio::task::spawn_blocking`。
- 不在锁内做重计算或外部命令调用。

## 测试建议

- 覆盖并发写、锁冲突、stale lock、损坏 JSON、fallback default 场景。
