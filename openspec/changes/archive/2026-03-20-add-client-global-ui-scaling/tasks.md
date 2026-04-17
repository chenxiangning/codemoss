## 1. Runtime scaling foundation (P0)

- [x] 1.1 Add `uiScale` config model and default (`1.0`) in existing settings storage flow.  
输入: current settings schema and persistence module.  
输出: `uiScale` readable/writable with backward compatibility for old config files.  
验证: load old config without error; new config persists `uiScale`.
- [x] 1.2 Implement Tauri command/bridge to apply window/webview zoom factor with range guard (`0.8`~`2.6`).  
输入: scale value from frontend settings.  
输出: runtime API that applies valid scale and rejects invalid values.  
验证: command unit test for valid/invalid scale paths.

## 2. Settings integration and UX controls (P0)

- [x] 2.1 Add "Global UI Scale" control in settings with slider range (`80%`~`260%`, step `1%`).  
输入: settings page UI structure.  
输出: range control + percent label bound to `uiScale` draft.
验证: UI test confirms slider value change and save action.
- [x] 2.2 Wire save-based apply flow and "Reset to 100%" action.  
输入: slider draft value and reset trigger.  
输出: click save applies zoom + persistence update; reset button restores 100% draft.  
验证: settings tests cover save + reset flows.

## 3. Layout compatibility hardening (P1)

- [x] 3.1 Run regression on key regions (sidebar, conversation/canvas, right panel, settings) at 80/100/125/150/260.  
输入: target page list and scale matrix.  
输出: issue list of overflow/clipping/hit-area defects.  
验证: checklist completed with pass/fail evidence.
- [x] 3.2 Fix high-impact layout issues from regression (min-width, overflow, scroll behavior).  
输入: defects from 3.1.  
输出: style/layout patches that keep critical controls visible and clickable.  
验证: rerun matrix and confirm all P0 defects closed.

## 4. Quality gates and rollout (P0)

- [x] 4.1 Add automated tests for persistence and fallback behavior (invalid value -> 100%).  
输入: settings persistence and startup restore logic.  
输出: unit/integration tests covering normal + fallback paths.  
验证: tests pass in CI.
- [x] 4.2 Add rollback guard without feature flag: keep reset-to-100 entry + strict frontend/backend validation.  
输入: existing settings UX and runtime validation mechanism.  
输出: user can always recover to 100%; invalid values are rejected/sanitized.  
验证: reset/save tests and settings_core validation tests pass.
