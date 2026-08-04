# Journal - chenxiangning (Part 31)

> Continuation from `journal-30.md` (archived at ~2000 lines)
> Started: 2026-08-03

---



## Session 1300: Codex 续接过滤 control 角色

**Date**: 2026-08-03
**Task**: Codex 续接过滤 control 角色
**Branch**: `cxn-version-0.7.15`

### Summary

codex_import_projection 不再 inject control 消息，避免 DeepSeek 等兼容 API invalid_request_error

### Main Changes

用户：本地 Codex 续接 DeepSeek-codex 后对话失败（control variant）。
已在 codex_import_projection 过滤非 portable message roles。


### Git Commits

| Hash | Message |
|------|---------|
| `c2c45e269` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1301: fix(models): 冷启 useModels selection 收敛环致 React #185 白屏

**Date**: 2026-08-03
**Task**: fix(models): 冷启 useModels selection 收敛环致 React #185 白屏
**Branch**: `cxn-version-0.7.15`

### Summary

onDebugRef 解耦、原子 selection state、乐观 snapshot、preferred 归一、epoch 熔断、playbook 追加 C-20260803-01

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2974b721e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1302: fix(models): 冷启 useModels selection 收敛环致 React #185 白屏

**Date**: 2026-08-03
**Task**: fix(models): 冷启 useModels selection 收敛环致 React #185 白屏
**Branch**: `cxn-version-0.7.15`

### Summary

onDebugRef 解耦、原子 selection state、乐观 snapshot、preferred 归一、epoch 熔断、playbook 追加 C-20260803-01

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `d4806464c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1303: fix shortcuts guide Quick Switcher i18n key

**Date**: 2026-08-03
**Task**: fix shortcuts guide Quick Switcher i18n key
**Branch**: `cxn-version-0.7.15`

### Summary

快捷键指南误用 sidebar.quickSwitcher.title，改为 quickSwitcher.title；仅提交 2 个文件，未混入其他 WIP。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `d2537a77b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1304: 修复 Codex 死 thread 恢复卡 Fork 静默失败

**Date**: 2026-08-03
**Task**: 修复 Codex 死 thread 恢复卡 Fork 静默失败
**Branch**: `cxn-version-0.7.15`

### Summary

(Add summary)

### Main Changes

| 项 | 内容 |
|----|------|
| OpenSpec | `fix-codex-stale-dead-thread-fork-continuation` |
| 问题 | 老 Codex 会话 `thread not found` 时点 Fork 无效（native fork 死父 + 静默 null） |
| 修复 | 恢复卡 Fork 走 `continueStaleThreadBindingForManualRecovery`：fork→fresh，失败可见 |
| 验证 | openspec validate ✅；recovery+runtime-reconnect 53 passed |

**Updated Files**:
- `src/app-shell-parts/manualThreadRecovery.ts`
- `src/app-shell-parts/useAppShellLayoutNodesSection.tsx`
- `src/features/messages/components/recovery/RuntimeReconnectCard.tsx`
- `openspec/changes/fix-codex-stale-dead-thread-fork-continuation/**`


### Git Commits

| Hash | Message |
|------|---------|
| `76951f6e2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1305: 修复 Shared Claude AskUserQuestion 弹窗与超时体验

**Date**: 2026-08-03
**Task**: 修复 Shared Claude AskUserQuestion 弹窗与超时体验
**Branch**: `cxn-version-0.7.15`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|----|------|
| 根因 | Shared control owner 校验时 Claude RequestUserInput 的 turnId 与 runtimeTurnId 不一致，提问事件被静默丢弃 |
| 修复 | events 映射用 turn_id_context；projection 对 control 方法强制对齐 turnId；OpenSpec change 收口 |
| 体验 | 超时 5→30 分钟，超时默认选推荐首项；提交后本地立即收起 live 卡；倒计时前展示超时说明 |
| 验证 | 用户手测弹窗通过；Vitest 44 通过；cargo MCP timeout 相关测试通过 |

**Updated Files**:
- `src-tauri/src/engine/events.rs`
- `src-tauri/src/shared_runtime_coordinator.rs`
- `src-tauri/src/engine/claude/user_input.rs`
- `src/features/app/components/RequestUserInputMessage.tsx`
- `src/features/app/components/UserInputQuestionCard.tsx`
- `src/features/app/components/userInputTimeout.ts`
- `openspec/changes/fix-shared-session-askuserquestion-control-owner/**`


### Git Commits

| Hash | Message |
|------|---------|
| `87836b7cb` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1306: 适配 Shared MCP AskUserQuestion 工具卡 UI

**Date**: 2026-08-03
**Task**: 适配 Shared MCP AskUserQuestion 工具卡 UI
**Branch**: `cxn-version-0.7.15`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|----|------|
| 问题 | Shared CLI 将 mcp__ccgui__AskUserQuestion 当通用 MCP 渲染，展示 raw QUESTIONS/_input/_output |
| 修复 | extractToolName/isMcpTool 识别；McpToolBlock 专用展示；完成态归一 requestUserInputSubmitted |
| 验证 | 用户验收通过；相关单测 124 通过 |

**Updated Files**:
- `src/features/messages/components/toolBlocks/McpToolBlock.tsx`
- `src/utils/threadItemsAskUserQuestion.ts`
- `src/utils/toolSemantics.ts`
- `src/features/messages/components/toolBlocks/toolConstants.ts`


### Git Commits

| Hash | Message |
|------|---------|
| `7c40eaaab` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1307: OpenSpec 批量归档已验证提案

**Date**: 2026-08-03
**Task**: OpenSpec 批量归档已验证提案
**Branch**: `CXN-version-0.7.16`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|----|------|
| 归档 | 7 个 verified/已验收 change → `archive/2026-08-03-*` |
| Spec sync | 新建 5 个 capability + 修改多个既有 main specs |
| 索引 | 重建 `changes/README`、`specs/README`，更新 `archive/README`、`project.md` |

**归档清单**:
- add-atlas-cloud-codex-preset
- close-native-session-provider-create-binding
- default-collapse-workspace-actions-menu
- fix-linux-startup-preserve-baidu-analytics
- honor-native-session-renamed-titles
- grok-cli-image-input-capability-gap
- enhance-subagent-canvas-persona-ui

**库存**: active=58, archive=791, main specs=462

**后续**: complete 但无 verification 的 active 可作下一波 archive；有 archive block 的 verification 提案暂留


### Git Commits

| Hash | Message |
|------|---------|
| `d8bc34a6f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1308: OpenSpec 第二波 bulk archive 37 complete 提案

**Date**: 2026-08-03
**Task**: OpenSpec 第二波 bulk archive 37 complete 提案
**Branch**: `CXN-version-0.7.16`

### Summary

归档 37 个 complete/archive-ready OpenSpec changes 到 2026-08-03；时间序同步 main specs；active 剩余 21（blocked/manual gates）；archive=828 specs=481

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `a8cd3f2f9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1309: OpenSpec 第三波：归档已上线人工 residual 提案

**Date**: 2026-08-03
**Task**: OpenSpec 第三波：归档已上线人工 residual 提案
**Branch**: `CXN-version-0.7.16`

### Summary

归档 20 个 shipped+manual residual active changes；active 仅剩 add-linux-native-menu-localization；archive=848 specs=492

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `5192d03df` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1310: Codex collab 子代理 live 与 history 呈现对齐

**Date**: 2026-08-03
**Task**: Codex collab 子代理 live 与 history 呈现对齐
**Branch**: `CXN-version-0.7.16`

### Summary

修复 Codex multi-agent 实时 wait 阶段幕布/Status 缺子代理呈现；engine-gate 隔离其他 CLI；仅提交本任务相关文件。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b725e011e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1311: Shared 队列 pending-ack UI 标识

**Date**: 2026-08-03
**Task**: Shared 队列 pending-ack UI 标识
**Branch**: `CXN-version-0.7.16`

### Summary

队列 pending-ack 显示「已发送，确认中（防重复）」；不改防双发出队逻辑；仅提交 composer/i18n 相关文件。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `1a6f7ea4a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1312: 文档信息架构治理

**Date**: 2026-08-03
**Task**: 文档信息架构治理
**Branch**: `CXN-version-0.7.16`

### Summary

重构 docs 信息架构与索引，统一 139 份文档 lifecycle metadata，归档废弃内容，新增文档治理 gate 与 CI 检查，并修复 review 发现的语义漂移。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `64b7a817f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1313: 收录轨道路由 Logo 示例

**Date**: 2026-08-03
**Task**: 收录轨道路由 Logo 示例
**Branch**: `CXN-version-0.7.16`

### Summary

将 9 个轨道路由 Logo 示例从临时 output 目录移动至 docs/assets/logo-concepts/orbit-routing，并作为文档设计资产提交。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `22164e20e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1314: 跨平台应用图标切换

**Date**: 2026-08-04
**Task**: 跨平台应用图标切换
**Branch**: `CXN-version-0.7.16`

### Summary

外观设置增加应用图标选择（默认+orbit-routing）；macOS Dock / Win-Linux 窗口任务栏；联动 About/锁屏；边界加固后提交

### Main Changes

| 能力 | 说明 |
|------|------|
| 设置 UI | 外观页单行图标轨 + 左右 chevron，无原生滚动条 |
| 持久化 | AppSettings.dockIconId，非法 id 回退 default |
| macOS | NSApplication.setApplicationIconImage，默认也走 PNG bytes |
| Win/Linux | Window.set_icon 遍历已开窗口；About/explorer 二次 reapply |
| 边界 | PNG magic 校验、4MB 上限、快速切换 generation 丢弃、Uint8Array IPC |

**Updated Files** (核心):
- `src/features/theme/utils/dockIcon.ts`
- `src-tauri/src/window.rs`
- `src/features/settings/.../BasicAppearanceSection.tsx`
- `src/assets/dock-icons/**`


### Git Commits

| Hash | Message |
|------|---------|
| `f3d57fac7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1315: 修复 dockIcon 测试 tsc 错误

**Date**: 2026-08-04
**Task**: 修复 dockIcon 测试 tsc 错误
**Branch**: `CXN-version-0.7.16`

### Summary

修复 dockIcon.test.ts 中 resolveFetch 推断为 never 导致 mac-arm64 构建失败

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `8cfa50e6f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1316: 修复 Shared 侧栏异步刷新 stale hide set 泄漏原生会话

**Date**: 2026-08-04
**Task**: 修复 Shared 侧栏异步刷新 stale hide set 泄漏原生会话
**Branch**: `CXN-version-0.7.16`

### Summary

异步 Grok/Kimi/Gemini refresh 重建 hide set 并 purge baseline 泄漏；补齐 OpenSpec 变更 fix-shared-sidebar-hide-set-staleness；typecheck/lint/36 测试全绿

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e0f8c0aa7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1317: 闭环 Shared 恢复出口

**Date**: 2026-08-04
**Task**: 闭环 Shared 恢复出口
**Branch**: `CXN-version-0.7.16`

### Summary

(Add summary)

### Main Changes

| 项 | 内容 |
|----|------|
| OpenSpec | `fix-shared-session-recovery-exit-closure` |
| P0 | Recovery Exit Ladder：Probe / Stop / 停止并重建 / 放弃本轮 |
| P0 | `target-unavailable` 分类纠偏；abandon durable + 清 binding recovery |
| P1 | force-stop 先读 settled 再 remove（防丢已完成回答） |
| P1 | 融合禁用原因 `fuseDisabledReasonKey` + 网关类 toast |
| 收尾 | 删死 key、补 `--danger` CSS、`__details` class |

**验证**：OpenSpec validate strict；FE SharedSend/MessageQueue/locale；Rust abandon + remove_attempt settled 契约测试。

**未提交残留**：`.trellis` 旧脏文件、`fix-shared-sidebar-hide-set-staleness/tasks.md` 未纳入本 commit。


### Git Commits

| Hash | Message |
|------|---------|
| `c4cb33daf` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1318: docs: 重写新 CLI 接入指南, 补全量注册点核对矩阵 A~H 八层 56 行

**Date**: 2026-08-04
**Task**: docs: 重写新 CLI 接入指南, 补全量注册点核对矩阵 A~H 八层 56 行
**Branch**: `CXN-version-0.7.16`

### Summary

基于全仓库 40+ 真实注册点盘点, 重写 mossx-new-cli-onboarding-guide.md; 补 AGENTS.md Engine Onboarding Gate + guides/index.md 触发信号

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `f6858e821` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1319: 对抗式 review 收口 React #185 canvas store / storm

**Date**: 2026-08-04
**Task**: 对抗式 review 收口 React #185 canvas store / storm
**Branch**: `CXN-version-0.7.16`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|----|------|
| 问题 | 生产持续性 React #185（App-hx3PTjEz），appVersion unknown |
| 对抗式 review | 修正 useActiveCanvasSelector：禁 render 期写 ref，改为 getSnapshot 内 cache |
| 结构修复 | setSnapshot shallow 门闩；跨 epoch storm 熔断；session engineDefault ref；NoticeDock 幂等；报告 __APP_VERSION__ |
| 文档 | playbook C-20260804-01 + AP-07 + §8.1；analysis README 校准 |
| 验证 | vitest 70 通过（activeCanvasStore / useModels / app-shell.startup / session / errorBoundaryReport） |

**Updated Files**:
- `src/features/layout/hooks/activeCanvasStore.ts`
- `src/features/layout/hooks/activeCanvasStore.test.tsx`
- `src/features/models/hooks/useModels.ts`
- `src/app-shell-parts/useSelectedComposerSession.ts`
- `src/features/notifications/components/GlobalRuntimeNoticeDock.tsx`
- `src/components/errorBoundaryReport.ts`
- `docs/analysis/react-185-maximum-update-depth-playbook.md`
- `docs/analysis/README.md`


### Git Commits

| Hash | Message |
|------|---------|
| `2afeadabf` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1320: 修复 activeCanvasStore 测试 tsc 构建失败

**Date**: 2026-08-04
**Task**: 修复 activeCanvasStore 测试 tsc 构建失败
**Branch**: `CXN-version-0.7.16`

### Summary

test 文件被 tsc include，let|null 收窄为 never 导致 build 失败；改为 ref box 修 TS2339

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `9dc47c0b0` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1321: fix Shared 模型选择器 display authority

**Date**: 2026-08-04
**Task**: fix Shared 模型选择器 display authority
**Branch**: `CXN-version-0.7.16`

### Summary

Shared Atomic 闭合态以 selectedNextTarget/executionTarget 快照为展示权威；catalog 仅 enrichment；Shared 禁止回落全局 selectedModelId；Native 保持全局回落。含 OpenSpec change 与 79 项相关单测。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `a3a631a90` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1322: fix Claude backgroundTaskId post-result grace mis-kill (#983)

**Date**: 2026-08-04
**Task**: fix Claude backgroundTaskId post-result grace mis-kill (#983)
**Branch**: `CXN-version-0.7.16`

### Summary

Claude structured backgroundTaskId settlement blocker: suppress post-result 5s process-tree mis-kill; helpers+read-loop+OpenSpec+14 tests. FE waiting label P1.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `3724a114b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1323: fix React #185 Composer extract 自订阅

**Date**: 2026-08-04
**Task**: fix React #185 Composer extract 自订阅
**Branch**: `CXN-version-0.7.16`

### Summary

(Add summary)

### Main Changes

| 项 | 内容 |
|----|------|
| 问题 | 0.7.16 App-DjQ3UnSh 生产仍炸 react-maximum-update-depth；栈钉 Composer + ActiveCanvasComposer |
| 根因 | extract effect deps 自订阅 selectedInlineFileReferences + skills/commands 引用抖动；target 等价 hydrate 换壳 notify |
| 修复 | extract 仅依赖 text；setComposerText 稳定幂等；target isSameExecutionTarget 门闩；stream phase 等价值 setPhase |
| 文档 | playbook C-20260804-02 + analysis README |
| 验证 | vitest Composer.file-reference-token + targetStore 共 54 passed |

**Updated Files**:
- `src/features/composer/components/Composer.tsx`
- `src/features/composer/components/Composer.file-reference-token.test.tsx`
- `src/features/shared-session/target/targetStore.ts`
- `src/features/shared-session/target/targetStore.test.ts`
- `src/features/threads/hooks/useStreamActivityPhase.ts`
- `docs/analysis/react-185-maximum-update-depth-playbook.md`
- `docs/analysis/README.md`


### Git Commits

| Hash | Message |
|------|---------|
| `9c04f381a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1324: fix(threads): live settlement order — 多工具回合 settle 后结论偶发跑到工具前

**Date**: 2026-08-04
**Task**: fix(threads): live settlement order — 多工具回合 settle 后结论偶发跑到工具前
**Branch**: `CXN-version-0.7.16`

### Summary

**修复**：Shared×Claude 多工具回合流式中顺序正常但 settle 后结论偶发跑到工具前，关开历史恢复。

**根因**：resetAgentSegment 后 resolveLiveAssistantMessageId 回到裸 itemId，complete/append 命中工具前首段 → 终稿并进 pre-tool 气泡。

**P0 修复**：
- findAssistantMessageIndexForLiveSettlement（append/complete 双 mode）：有 -seg-* 兄弟时优先最新分段，禁止终稿并回 pre-tool
- 接入 appendAgentDelta + applyCompleteAgentMessageToState

**late tool 防御**：
- upsertItem：新 tool 若尾部是 isFinal assistant 则插入到结论前
- rebalanceTrailingToolsBeforeFinalAssistants：complete/markFinal 后重排

**门禁**：tsc ✅ / OpenSpec validate ✅ / 全量 hooks 测试 1100 ✅ / 聚焦回归 138 ✅

**OpenSpec**：fix-live-settle-assistant-tool-order

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `74654f1d6` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1325: fix assistant duplicate render Native/Shared

**Date**: 2026-08-04
**Task**: fix assistant duplicate render Native/Shared
**Branch**: `CXN-version-0.7.16`

### Summary

OpenSpec + merge early-body 折叠 + 跨 id 收敛；review 收紧 streaming/stop 边界后自检提交

### Main Changes

| 项 | 内容 |
|----|------|
| Change | `fix-assistant-duplicate-render-native-shared` |
| 单气泡 | substantial early-body echo（≥24 且 ≥50% coverage） |
| 双气泡 | Shared/Native complete/upsert 跨 id 收敛 |
| 防误吞 | streaming 仅 exact body 或双方≥80 等价；reasoning/tool stop 对齐 assembler |
| 测试 | merge + completed-duplicate + adapters + fast-path 84/84 |
| 验证 | openspec validate OK；未纳入无关 subagent WIP |

**Updated Files**:
- `src/features/threads/hooks/threadReducerTextMerge.ts`
- `src/features/threads/hooks/useThreadsReducerAssistantDedup.ts`
- `src/features/threads/hooks/useThreadsReducer.ts`
- tests + openspec/changes/fix-assistant-duplicate-render-native-shared/**


### Git Commits

| Hash | Message |
|------|---------|
| `379d9935b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1326: 修复子代理状态卡死与抽屉冻结

**Date**: 2026-08-04
**Task**: 修复子代理状态卡死与抽屉冻结
**Branch**: `CXN-version-0.7.16`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|----|------|
| 问题 | 子代理列表长期「运行中」；点开 inspector 抽屉 status 不刷新；仅侧栏开 session 才对齐 |
| 根因 | inspector 整卡快照冻结；SessionCanvas 旁路 load 不回写 enrich 源；layout snapshot 会冲掉旁路写 store |
| 方案 | 新增 useSubagentSessionProbeStore；SquadGrid/SubagentList merge+enrich；sync inspector；Ring 卡 UI 收口 |
| 验证 | vitest inspector/probe/cardStatus hooks 通过；本地确认开抽屉后 status 可更新 |

**Updated Files**:
- `src/features/subagent-ui/hooks/useSubagentSessionProbeStore.ts` (new)
- `src/features/subagent-ui/hooks/useSubagentInspectorStore.ts`
- `src/features/subagent-ui/components/SubagentSessionCanvas.tsx`
- `src/features/subagent-ui/components/SubagentSquadGrid.tsx`
- `src/features/subagent-ui/components/SubagentRingCard.tsx` (new)
- `src/features/status-panel/components/SubagentList.tsx`
- 多语言 `subagentUi` + `src/styles/subagent-ui.css`


### Git Commits

| Hash | Message |
|------|---------|
| `c33a3f254` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1327: SubAgent S10 卡收口：折叠收纳、去重与宽度自适应

**Date**: 2026-08-04
**Task**: SubAgent S10 卡收口：折叠收纳、去重与宽度自适应
**Branch**: `CXN-version-0.7.16`

### Summary

幕布 SubAgent 改为 S10 分段色条+Ring 卡；参与已处理折叠；合成注入前移防回钉；description 顶 title 识别消双重渲染；Ring 网格 auto-fit 均分宽度

### Main Changes

## 本次交付
- S10 Segment Bar + Ring 卡片 UI（已在 c33a3f254 含部分 UI）
- SubAgent 进入 process-phase「已处理」折叠（取消常驻豁免）
- 合成 spawn 注入移到 collapse 之前，堵住 Shared 折叠后再钉回 chip 外侧
- isSubagentTool 识别 Shared description-as-title 载荷，只走 subagentGroup，去掉下方扳手重复行
- Ring grid：auto-fill → auto-fit，卡均分铺满宽度

## 验证
- vitest：collapseMiddleSteps / isSubagentTool / groupToolItems / syntheticSharedSubagentTools 相关用例通过
- 设计预览 HTML 仅在 output/，未入库

## 未纳入
- output/subagent-card-*.html 设计稿（本地预览）


### Git Commits

| Hash | Message |
|------|---------|
| `2e381d204` | (see git log) |
| `c33a3f254` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1328: 退役 Claude SubAgent 旧 Agent session 卡

**Date**: 2026-08-04
**Task**: 退役 Claude SubAgent 旧 Agent session 卡
**Branch**: `CXN-version-0.7.16`

### Summary

(Add summary)

### Main Changes

| 项 | 说明 |
|----|------|
| OpenSpec | `retire-claude-subagent-agent-session-card`（proposal/design/specs/tasks） |
| 目标 | Shared/Native Claude 幕布 SubAgent 完成态只保留 S10，去掉 legacy `Agent session` 卡 |
| 实现 | 藏 SubAgent 型 task-notification 旧卡；终态/result/output-file enrich 到 S10 与 inspector；安全 toolUseId 匹配；StatusPanel 同源 enrich；Timeline 0 高锚点 |
| 验证 | enrich/notification unit 18 通过；rich-content 退役路径通过；相关 tsc 无 error |

**Updated Files**:
- `src/features/subagent-ui/utils/enrichSubagentCardsFromTaskNotifications.ts`
- `src/features/messages/rows/components/MessageRow.tsx`
- `src/features/messages/timeline/components/TimelineRowRenderer.tsx`
- `src/features/status-panel/components/SubagentList.tsx`
- `src/features/subagent-ui/components/SubagentInspectorDrawer.tsx`
- `openspec/changes/retire-claude-subagent-agent-session-card/**`


### Git Commits

| Hash | Message |
|------|---------|
| `9ac441d8f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1329: fix Shared 用户附图双气泡与历史丢图

**Date**: 2026-08-04
**Task**: fix Shared 用户附图双气泡与历史丢图
**Branch**: `CXN-version-0.7.16`

### Summary

Shared CLI 用户附图：TurnRequested.image_refs + projection/dataSource 透传 images + optimistic/history 保图合并；OpenSpec fix-shared-user-image-bubble-projection；单独提交不含 resume-integrity

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b2a1ef000` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1330: fix Shared 上下文续接 resume-integrity

**Date**: 2026-08-04
**Task**: fix Shared 上下文续接 resume-integrity
**Branch**: `CXN-version-0.7.16`

### Summary

nativeContextTrust dirty/trusted + dirty 时 needs-history rematerialize + empty-context-handoff FE/i18n；OpenSpec fix-shared-context-resume-integrity；用户验收通过后单独提交

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `165f0fda6` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1331: 修复 Composer rewind reset React #185

**Date**: 2026-08-04
**Task**: 修复 Composer rewind reset React #185
**Branch**: `CXN-version-0.7.16`

### Summary

将 production bundle App-C2u7zJPh exact stack 映射到 Composer rewind passive effect；复用 useEventCallback 加 pre-dispatch semantic guard，并以 primitive capability dependency 断开 callback identity churn；补 StrictMode regression、OpenSpec contract、React #185 playbook 与 Trellis state guardrail。验证：clean-base typecheck 通过，scoped ESLint 通过，focused Vitest 62/62，OpenSpec strict 506/506；全仓 lint 保留既有 personaAssign prefer-const baseline error。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `fa84f2dba` | (see git log) |
| `a59985654` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1332: 修复 Shared Atomic 模型与思考强度联动

**Date**: 2026-08-04
**Task**: 修复 Shared Atomic 模型与思考强度联动
**Branch**: `CXN-version-0.7.16`

### Summary

Shared 从 Grok 切到 Codex 后思考档位不再沿用 activeEngine 或遗留 null；按目标模型 capability seed/收敛 options 与 effort，并在 UI hydrate 与 send 边界 reconcile。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `cf7abdbf3` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1333: 阻断 Shared 初始化回落 Native 思考档位

**Date**: 2026-08-04
**Task**: 阻断 Shared 初始化回落 Native 思考档位
**Branch**: `CXN-version-0.7.16`

### Summary

Shared Grok 初始化禁止借用 Native Codex 的 reasoning options/effort；initialTarget 按目标 CLI 播种；target 未就绪 fail-closed。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `385d20e3a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1334: 修复 PR 创建弹窗下拉被遮罩挡住

**Date**: 2026-08-04
**Task**: 修复 PR 创建弹窗下拉被遮罩挡住
**Branch**: `CXN-version-0.7.16`

### Summary

(Add summary)

### Main Changes

| 项 | 内容 |
|----|------|
| 问题 | Create PR 弹窗中 base/compare 等下拉点不开 |
| 根因 | git graph 改造将 picker 改为 Radix Popover portal + 默认 z-50，低于 create-pr backdrop z-68 |
| 修复 | PopoverContent 与 `.git-history-picker-content` 抬到 z-index:80，并补回归测试 |

**Updated Files**:
- `src/features/git-history/components/git-history-panel/components/GitHistoryPanelPickers.tsx`
- `src/features/git-history/components/git-history-panel/components/GitHistoryPanelPickers.test.tsx`
- `src/styles/git-history.part1.overview.css`


### Git Commits

| Hash | Message |
|------|---------|
| `1a6ffab1f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 1335: 校准多 CLI 基石文档并落地 ADR 回写 Gate

**Date**: 2026-08-05
**Task**: 校准多 CLI 基石文档并落地 ADR 回写 Gate
**Branch**: `CXN-version-0.7.16`

### Summary

核对 48h shared/native CLI 变更 vs 基石 ADR：核心契约未过期、实现向文档收敛；刷新文档最近校准与校准表（+4 行事实源）；新增 AGENTS.md 全局 Gate「ADR 校准回写」，finish-work 双入口与 openspec README 同步加把关。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `0fb3cdd10` | (see git log) |
| `aa0e398d6` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
