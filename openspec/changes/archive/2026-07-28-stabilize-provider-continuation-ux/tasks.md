## 1. Native bootstrap 正确性

- [x] 1.1 [P0, depends: none] 追踪 continuation command、Claude history 与 runtime event owner；输出 bootstrap evidence/terminal matrix，并用现有测试复现 marker 未回显但 target 已创建的路径。
- [x] 1.2 [P0, depends: 1.1] 将 Claude bootstrap acceptance 改为 target identity + frozen artifact checksum + durable delivery evidence；保持 operation 幂等并补充首次成功、bounded recovery、duplicate-create 回归测试。
- [x] 1.3 [P0, depends: 1.2] 隔离 bootstrap control exchange 的普通 processing/reasoning/message/title projection；验证首个真实用户 Turn 可独立开始和 terminal 收口。

## 2. 低侵入 Continuation UX

- [x] 2.1 [P0, depends: 1.2] 将 Dialog 改为诚实的 creating/verifying pending、ready/recovery-required 状态，映射人类可读错误并提供安全恢复动作；补齐 accessibility 与 component tests。
- [x] 2.2 [P0, depends: 1.3] 从 Canvas 根节点移除 continuation card，接入既有 `.messages` metadata slot，默认折叠且不参与普通消息 grouping/streaming/end/scroll anchor；补齐布局和来源导航回归测试。
- [x] 2.3 [P1, depends: 1.3] 统一 protocol title normalization，保证历史和 reload 不展示 Context Package/hash；验证普通包含 `MOSSX` 的用户文本不被误过滤。

## 3. Shared Turn 身份闭环

- [x] 3.1 [P0, depends: none] 追踪 picker → V2 send → `turnRequested` → canonical projection → reload badge，定位 stale target/provider metadata 丢失点并建立端到端断言。
- [x] 3.2 [P0, depends: 3.1] 在 send boundary 冻结 CLI/Provider/Model display identity，并让 live/rebuild/reload 只读 snapshot；legacy unknown 与 explicit local/default 使用不同 fallback。
- [x] 3.3 [P0, depends: 3.2] 补充 Claude Provider A → Codex Provider B → reload/rebuild 自动化测试，验证逐 Turn badge 精确且历史不随 picker 改写。

## 4. 契约、质量与交付

- [x] 4.1 [P0, depends: 1.*,2.*,3.*] 更新 `dev-guidelines` executable contract、任务清单/人工验收说明；写明 control-plane 隔离、error matrix、Good/Base/Bad cases 与断言点。
- [x] 4.2 [P0, depends: 4.1] 运行 targeted Rust/Vitest、typecheck、scoped lint、runtime contracts 与 OpenSpec strict validation；记录命令和结果。
- [x] 4.3 [P0, depends: 4.2] 执行 cross-layer/code reuse/performance review，修复发现项，完成 OpenSpec verification 并提交。
