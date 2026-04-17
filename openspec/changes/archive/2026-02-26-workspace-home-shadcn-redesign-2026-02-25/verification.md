# Verification: workspace-home-shadcn-redesign-2026-02-25

## Scope

Workspace Home 首页 shadcn/ui 重构，覆盖三段式布局（Hero/Guide/Recent）、浅/深色主题语义一致性、最近会话批量管理状态可见性，以及
OpenCode 入口语义保真。

涉及文件：

| 文件                                                               | 变更类型 | 行数  |
|------------------------------------------------------------------|------|-----|
| `src/features/workspaces/components/WorkspaceHome.tsx`           | 重构   | 577 |
| `src/features/workspaces/components/WorkspaceHomeSpecModule.tsx` | 重构   | 160 |
| `src/styles/workspace-home.css`                                  | 重写   | 754 |
| `src/features/workspaces/components/WorkspaceHome.test.tsx`      | 更新   | 352 |

## Checks Run

### 1. Unit Tests

**Command:** `pnpm vitest run src/features/workspaces/components/WorkspaceHome.test.tsx`

**Result:** 11 passed, 0 failed (714ms)

| #  | Test Case                                                                  | Status |
|----|----------------------------------------------------------------------------|--------|
| 1  | renders hero, guide, and recent sections with reachable primary CTAs       | PASS   |
| 2  | opens conversation on click in default mode                                | PASS   |
| 3  | selects thread instead of opening when in manage mode                      | PASS   |
| 4  | announces manage-mode state and exposes pressed state for selected threads | PASS   |
| 5  | deletes selected conversations only on second confirmation click           | PASS   |
| 6  | cancels armed delete state without deleting                                | PASS   |
| 7  | keeps failed threads selected after partial delete                         | PASS   |
| 8  | falls back to opencode when it is the only installed engine                | PASS   |
| 9  | continues the latest conversation from hero CTA                            | PASS   |
| 10 | opens spec hub when clicking Open Spec Hub guide                           | PASS   |
| 11 | keeps Open Spec Hub guide enabled even when no engine is selectable        | PASS   |

### 2. TypeScript Type Check

**Command:** `pnpm tsc --noEmit`

**Result:** 0 errors

### 3. Capability-to-Implementation Alignment

#### workspace-home-shadcn-ux

| Requirement    | Implementation Evidence                                                                                                                                              | Test Evidence           |
|----------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------|
| 三段式信息架构与首屏可达   | Hero(L280-398)/Guide(L400-420)/Recent(L422-574) sections in WorkspaceHome.tsx                                                                                        | Test #1                 |
| 主题语义一致性        | CSS uses semantic tokens (`--accent-soft`, `--surface-card`, `color-mix()`); status classes `.is-idle`/`.is-processing`/`.is-reviewing` + danger classes `.is-armed` | Structural (CSS review) |
| shadcn/ui 语义构件 | Imports: Badge, Button, Card, CardContent, CardHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue                                                 | Test #1, #8             |

#### workspace-home-opencode-entry

| Requirement     | Implementation Evidence                                                            | Test Evidence |
|-----------------|------------------------------------------------------------------------------------|---------------|
| 引擎下拉开放 OpenCode | Engine select in Hero区 with `isEngineSelectable` check                             | Test #8       |
| OpenCode 新建会话连通 | `onStartConversation(startConversationEngine)` preserves existing handler contract | Test #9       |
| 调用参数语义不变        | Handler reuse — no parameter or contract changes in TSX                            | Test #8, #9   |

#### workspace-recent-conversations-bulk-management

| Requirement     | Implementation Evidence                                                           | Test Evidence                      |
|-----------------|-----------------------------------------------------------------------------------|------------------------------------|
| 二步确认批量删除        | `isDeleteConfirmArmed` state + armed/confirm flow                                 | Test #5                            |
| 取消 armed 不删除    | Cancel handler resets `isDeleteConfirmArmed` without calling delete               | Test #6                            |
| 部分失败保留选中        | `handleDeleteSelectedThreads` retains failed IDs in `selectedThreadIds`           | Test #7                            |
| 删除中防重入          | `isDeletingSelected` state disables delete button                                 | Test #5 (implicit via state guard) |
| 管理态/确认态/删除中态可辨识 | CSS: `.is-manage-mode` red border, `.is-armed` red gradient, `[disabled]` styling | Structural (CSS review)            |

### 4. Structural Verification

- **shadcn/ui primitives** confirmed via import analysis: Badge, Button, Card (CardContent, CardHeader), Select (
  SelectContent, SelectItem, SelectTrigger, SelectValue)
- **Accessibility:** `aria-live="polite"` for manage-mode announcements, `aria-pressed` on thread items, `aria-label` on
  interactive controls (verified in Test #4)
- **Responsive design:** Media queries at 980px and 760px breakpoints in CSS
- **CSS namespace isolation:** All styles scoped under `.workspace-home-*` prefix — no global style pollution

## Results

| Check                                                    | Status          |
|----------------------------------------------------------|-----------------|
| Vitest (11 tests)                                        | PASS            |
| TypeScript `--noEmit`                                    | PASS (0 errors) |
| workspace-home-shadcn-ux alignment                       | PASS            |
| workspace-home-opencode-entry alignment                  | PASS            |
| workspace-recent-conversations-bulk-management alignment | PASS            |
| Delta specs completeness (3/3)                           | PASS            |
| Tasks completeness (all checked)                         | PASS            |

## Risks / Follow-ups

1. **Visual regression (Low):** No automated visual screenshot tests; theme-level contrast adequacy relies on manual
   review or future Playwright visual comparison. Consider adding Playwright visual snapshots in a follow-up.
2. **CSS hardcoded colors:** Some status colors (`#0ea5e9`, `#f59e0b`, `#dc2626`) are inline rather than via CSS custom
   properties. Not blocking, but could drift from design token evolution.
3. **Open question (from design.md):** Hero 区是否增加"最近一次会话来源引擎"辅助信息 — deferred, not in scope of this
   change.
4. **Open question (from design.md):** 通用引导动作按使用频率排序 — deferred, not in scope.
