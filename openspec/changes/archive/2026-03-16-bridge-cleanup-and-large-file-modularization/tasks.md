## 1. Baseline Inventory and Governance Setup

- [x] 1.1 生成并提交 `>3000` 大文件基线清单（输入: 当前仓库源码与样式文件；输出: `docs/architecture/large-file-baseline.md`；验证: 清单包含路径/行数/类型/P0-P2；优先级: P0；依赖: 无）
- [x] 1.2 新增大文件治理脚本（输入: 文件扫描规则与阈值；输出: `scripts/check-large-files.*`；验证: 本地运行可输出超阈值文件；优先级: P0；依赖: 1.1）
- [x] 1.3 在 CI 接入 warning 模式哨兵（输入: 1.2 脚本；输出: CI job 与日志产物；验证: PR 可看到 warning 且不阻断；优先级: P0；依赖: 1.2）

## 2. Bridge Cleanup Hardening (Rust)

- [x] 2.1 抽取 Bridge command registry 模块骨架（输入: `app_server.rs`/`engine/commands.rs` 当前注册逻辑；输出: 新 registry 模块与兼容入口；验证: 编译通过且命令可被解析；优先级: P0；依赖: 1.1）
- [x] 2.2 抽取 Bridge domain service 层首批能力（输入: 混合 command+业务逻辑函数；输出: service 模块与调用适配；验证: 单元测试或 smoke 用例保持通过；优先级: P0；依赖: 2.1）
- [x] 2.3 统一错误映射与响应 envelope（输入: 各模块错误类型；输出: 统一 error mapper；验证: 前端侧错误字段结构不变；优先级: P0；依赖: 2.2）
- [x] 2.4 强化 mutex/with_file_lock 守卫（输入: 共享状态与文件访问点列表；输出: 守卫补齐提交；验证: 并发相关测试/回归脚本通过；优先级: P0；依赖: 2.2）

## 3. P0 Frontend TSX Modularization

- [x] 3.1 拆分 `GitHistoryPanel.tsx` 的 state/actions/render 分层（输入: 现有 9489 行实现；输出: hooks/components/utils 子模块；验证: `GitHistoryPanel` 现有测试与关键交互通过；优先级: P0；依赖: 1.1）
- [x] 3.2 拆分 `SpecHub.tsx` 的面板编排与业务逻辑（输入: 现有 6389 行实现；输出: orchestration/hooks/presentational 模块；验证: `SpecHub` 测试通过；优先级: P0；依赖: 1.1）
- [x] 3.3 拆分 `App.tsx` 路由装配与生命周期逻辑（输入: 现有 5254 行实现；输出: app-shell/router/bootstrap 子模块；验证: app 启动链路与关键导航回归通过；优先级: P0；依赖: 1.1）
- [x] 3.4 拆分 `SettingsView.tsx` 模块并稳定导出接口（输入: 现有 4659 行实现；输出: settings sections/hooks/actions 子模块；验证: settings 关键操作行为等价；优先级: P0；依赖: 1.1）

## 4. P0 Rust Large File Modularization

- [x] 4.1 拆分 `src-tauri/src/git/mod.rs` 为 feature 子模块（输入: git 子系统函数分组；输出: `git/*` 子模块与 re-export；验证: git 相关命令编译与回归通过；优先级: P0；依赖: 2.1）
- [x] 4.2 拆分 `src-tauri/src/backend/app_server.rs` 为 server/runtime 子模块（输入: server 初始化与事件处理逻辑；输出: backend 分层模块；验证: app server 启停与事件链路通过；优先级: P0；依赖: 2.1）
- [x] 4.3 拆分 `src-tauri/src/engine/commands.rs` 与 `claude.rs`（输入: engine 命令/提供商逻辑；输出: provider command/service 子模块；验证: engine 命令调用行为等价；优先级: P0；依赖: 2.2）

## 5. P1/P2 Style and i18n Modularization

- [x] 5.1 拆分 `settings.css`、`git-history.css`、`composer.css` 为按 feature 命名空间样式（输入: 现有样式规则；输出: 分模块样式文件与稳定导入顺序；验证: 关键页面无布局重叠/裁剪回归；优先级: P1；依赖: 3.1,3.4）
- [x] 5.2 拆分 `en.ts`、`zh.ts` 为按 feature locale 包（输入: 现有 i18n key；输出: feature-locale 文件结构与聚合导出；验证: 运行时 key 命中率与文案显示正确；优先级: P2；依赖: 3.2,3.3）

## 6. Verification, Rollout, and Hard Gate

- [x] 6.1 执行全量质量门禁（输入: 改造分支；输出: 测试/类型/构建报告；验证: Rust tests + 前端 tests + typecheck 全通过；优先级: P0；依赖: 2.4,3.4,4.3,5.2）
- [x] 6.2 发布治理结果与回滚手册（输入: 改造结果与风险清单；输出: `docs/architecture/large-file-governance-playbook.md`；验证: 包含回滚步骤与能力保留矩阵；优先级: P0；依赖: 6.1）
- [x] 6.3 将 CI 哨兵从 warning 切换为 hard gate（输入: 稳定期观察数据；输出: CI 阻断规则；验证: 新增超阈值文件会阻断并给出 remediation 提示；优先级: P0；依赖: 6.2）
