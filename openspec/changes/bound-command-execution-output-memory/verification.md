# Verification: bound-command-execution-output-memory

## 自动化

- `npx vitest run src/features/threads/utils/boundToolOutput.test.ts src/utils/threadItems.test.ts src/features/threads/contracts/conversationAssembler.test.ts src/features/threads/hooks/useToolOutputTailGate.test.ts`
  - 结果：172 passed（160 + 12 tail gate）
- `cargo test --manifest-path src-tauri/Cargo.toml --lib junk_dir_ignore`
  - 结果：4 passed
- `cargo test --manifest-path src-tauri/Cargo.toml --lib special_directory_path_detection`
  - 结果：3 passed
- `openspec validate bound-command-execution-output-memory --strict --no-interactive`
  - 结果：valid

日期：2026-08-14。已 `openspec-sync-specs` 同步 3 个 delta spec 到主 specs，工作区全量 commit（用户授权）。未 archive。

## 人工

- Shared 调 Codex，对含 `node_modules` / `target` / `temp` 的仓库跑递归列目录：对话 command 卡片应出现 omitted 标记，客户端内存不得线性涨到数 GB。
- 打开该 workspace 后检查根目录 `.codexignore` 出现 mossx 托管段，且用户手写规则仍在。
- `ccgui.perf.toolOutputBudget=off` 后，小输出行为与改前一致。
- 结论：用户 2026-08-14 手测后确认「问题不大」，收口提交。

## ADR 校准回写 Gate

- 未命中基石文档「更新触发器」：本 change 不改 engine registry / Shared 支持集合 / provider binding / canonical fact schema / context compiler / terminal-ACK contract / recovery exit。无需回写 `docs/research/mossx-multi-cli-provider-session-foundation-design.md`。

## 不在本次证据内

- 独立 Codex TUI 进程自身 RSS（层 1 只约束 mossx 会话态）。
- 侧栏 Session Index / catalog 扫盘。
- 全量 `cargo test` 集成套件（既有 `assemble_canonical_facts` 缺归档 schema 文件，与本 change 无关）。
