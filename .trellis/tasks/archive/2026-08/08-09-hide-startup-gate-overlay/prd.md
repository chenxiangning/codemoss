# 默认隐藏并按需恢复启动门控遮罩

## OpenSpec

- Change: `hide-startup-gate-overlay`
- Source of truth: `openspec/changes/hide-startup-gate-overlay/`

## Goal

主窗口默认不挂载冷启动全屏 `StartupGateOverlay`，同时完整保留组件实现，并在“其他设置”底部提供默认关闭、下次启动生效的本机测试开关。

## Requirements

- `AppRouter` 仅在启动时读取到显式 test flag 后 conditional mount overlay。
- test flag 使用 feature-local localStorage helper，缺失、异常或 storage failure 均回退关闭。
- 在“其他设置”底部增加 Switch，并补齐 zh/en i18n。
- startup orchestration、first-paint hydration、milestone 与后台任务逻辑保持不变。
- detached window routing 保持不变，即使 flag 开启也不挂载 overlay。
- Router 与 settings regression tests 覆盖 default-off、opt-in、next-start-only 与 persistence。
- 提交前修复 `handleRevertRepositoryFiles` 的 AppShell domain ownership catalog 漂移，不改变 runtime context wiring。

## Acceptance Criteria

- [x] default-off 时 main window 渲染 `AppShell`，不渲染 startup gate sentinel。
- [x] test flag 开启后，下次 main window mount 渲染 startup gate sentinel。
- [x] “其他设置”底部 Switch 默认关闭并可持久化 on/off。
- [x] detached window 在 flag 开启时仍不挂载 overlay。
- [x] `StartupGateOverlay.tsx` 与 `StartupGateOverlay.test.tsx` 仍存在。
- [x] Router、OtherSection 与 Overlay focused tests 通过。
- [x] TypeScript、target ESLint 与 OpenSpec strict validation 通过。
- [x] `appShellDomainContexts.test.ts` ownership drift regression 通过。
- [ ] full batched tests 在 ownership 修复后通过。

## Technical Notes

- 采用 localStorage test flag + Router mount snapshot，不扩展 Rust / `AppSettings`。
- Switch 只持久化，不即时 reload 或挂载 overlay，避免设置页被突然阻断。
- Overlay 自带 10 秒 force-enter 与 20 秒 absolute ceiling，因此错误开启仍可自救。
- 回滚时删除 settings row、helper 与 Router conditional branch；残留 key 会被忽略。
- ownership 修复只移动 catalog entry；禁止移动 production property 或弱化 drift test。
