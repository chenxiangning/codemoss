# Backend Quality Guidelines

## 必须遵守（Must）

- command 行为可预测（deterministic）且具备 clear error path。
- 共享状态访问遵循 `AppState` 锁策略。
- 文件写入遵循 lock + atomic write 模式。
- 关键行为变更同步更新 frontend mapping/tests。

## 禁止项（Never）

- runtime path 使用 `unwrap/expect`。
- 新增 command 但遗漏 `command_registry.rs` 注册。
- 命令参数改名后不更新 `src/services/tauri.ts`。
- 破坏幂等性导致 retry 重放污染。

## 推荐验证命令

```bash
npm run check:runtime-contracts
npm run doctor:strict
npm run test
npm run typecheck
```

必要时补充 Rust 侧测试：

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

## Review Checklist

- command contract 是否与 frontend 一致？
- 锁粒度是否合理？是否存在锁内重 IO？
- 错误信息是否可追踪且无敏感泄露？
- 是否有回归测试覆盖新增/修改路径？
