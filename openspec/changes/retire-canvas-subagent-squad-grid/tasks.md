## 1. 提案与契约

- [x] 1.1 创建 change `retire-canvas-subagent-squad-grid`（proposal / design / tasks / delta specs）
- [x] 1.2 写清与 `retire-claude-subagent-agent-session-card`、`fix-codex-collab-subagent-live-parity` 的 supersession
- [ ] 1.3 用户审阅 proposal；确认方案 A（幕布 Generic 行，不隐藏 tool）
- [x] 1.4 更新 `openspec/changes/README.md` active 表

## 2. 幕布入口拆除（代码已落地，验收勾选）

- [x] 2.1 `TimelineRowRenderer` 移除 `subagentGroup` → SquadGrid
- [x] 2.2 `ToolBlockRenderer` 移除 `isSubagentTool` → SquadGrid 兜底
- [x] 2.3 `MessagesCore` 移除 `enrichTimelineWithSyntheticSubagentsBeforeCollapse`
- [x] 2.4 `groupToolItems` 移除 `subagentGroup` kind 与强制分组
- [x] 2.5 projection / virtualization / renderUtils / dataSource 注释与 special-case 清理

## 3. 死代码与 i18n

- [x] 3.1 删除 `SubagentSquadGrid` / `SubagentRingCard` / `syntheticSharedSubagentTools` 及测试
- [x] 3.2 清理 `subagent-ui/index.ts` export
- [x] 3.3 10 语言删除 `squadTitle` / `squadTitleCount` / `statusShort.*`
- [x] 3.4 `subagent-ui.css` 删除 squad/ring 样式段
- [x] 3.5（nit）`toolConstants.classifyToolCategory` 注释改为 strip / status-panel 识别

## 4. 保留面回归

- [x] 4.1 `ComposerRunStatusStrip` + `RunStatusSubagentRows` 仍 enrich 并 `openSubagentInspector`
- [x] 4.2 `SubagentPersonaCard` / `SubagentProgressBar` / inspector / utils 保留
- [ ] 4.3 手工：strip 点击 inspector 通（Claude / Codex / Shared 至少一条）

## 5. 验证与提交卫生

- [x] 5.1 focused vitest：groupToolItems、run-status、subagent-ui、locale parity
- [x] 5.2 `tsc --noEmit`
- [x] 5.3 `rg "SubagentSquadGrid|SubagentRingCard|subagentGroup|squadTitleCount|statusShort" src` 无残留
- [ ] 5.4 commit **仅** messages / subagent-ui / i18n / styles 相关路径；**排除** multi-agent bridge 等无关 diff
- [ ] 5.5 archive 前 sync 主 specs（`subagent-canvas-persona-ui` 等）

## 6. 关联 change 收口（后续）

- [ ] 6.1 更新 `retire-claude-subagent-agent-session-card` 文档：canonical 表面改为 strip（或 archive 时合并说明）
- [ ] 6.2 更新 `fix-codex-collab-subagent-live-parity`：幕布合成任务标为 superseded by 本 change
