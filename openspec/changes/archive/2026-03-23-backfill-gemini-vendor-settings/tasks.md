## 1. OpenSpec Artifacts Completion（P0）

- [ ] 1.1 [P0][depends: proposal][I: 已实现 Gemini 供应商配置代码与行为][O: design.md][V: 包含 Context / Goals / Decisions / Risks，且与现状实现一致] 完成技术设计文档回补。
- [ ] 1.2 [P0][depends: proposal][I: 提案中定义的 `vendor-gemini-settings` capability][O: specs/vendor-gemini-settings/spec.md][V: 每个 Requirement 至少 1 个 `#### Scenario`，并使用 SHALL/MUST 语义] 完成能力规范文档。

## 2. Backend Contract Alignment（P0）

- [ ] 2.1 [P0][depends: 1.2][I: Gemini 配置持久化命令][O: `vendor_get/save_gemini_settings` 行为契约][V: `auth_mode` 归一化、env 清洗、默认 enabled 语义明确] 对齐后端配置读写契约与 spec。
- [ ] 2.2 [P0][depends: 1.2][I: Gemini 预检命令实现][O: 三项预检契约][V: `Gemini CLI / Node.js / npm` 均可返回 PASS/FAIL 与 message] 对齐预检行为与 spec。

## 3. Frontend Behavior & UX Alignment（P0）

- [ ] 3.1 [P0][depends: 1.2][I: 供应商 Tabs 入口][O: 引擎图标 + Gemini 入口可见性][V: Claude/Codex/Gemini tab 均可见且带对应 icon] 对齐 tab 可见性与图标契约。
- [ ] 3.2 [P0][depends: 1.2][I: Gemini Auth 模式切换逻辑][O: 字段显隐与字段清理一致性][V: 模式切换后 env 文本同步，冲突字段被清理] 对齐前端模式驱动行为。
- [ ] 3.3 [P0][depends: 3.1][I: Gemini 面板布局][O: 隐藏 banner 后仍可操作][V: 预检、环境变量、认证配置三区域可直接使用] 对齐当前 UI 约束。

## 4. Verification & Traceability（P0）

- [ ] 4.1 [P0][depends: 2.1,2.2,3.2][I: 前后端改动及文档][O: 构建与静态检查结果][V: `npm run typecheck` 通过，关键文件 eslint 无新增 error] 完成基础质量门禁验证。
- [ ] 4.2 [P0][depends: 4.1][I: OpenSpec change artifacts][O: change 状态可进入 apply-ready][V: `openspec status --change backfill-gemini-vendor-settings` 显示 proposal/design/specs/tasks 完成] 完成变更状态收口。

