# Verification Record

Date: 2026-03-02
Change: `file-view-code-intelligence-navigation-2026-03-01`

## Automated Validation

-
`npx vitest run src/features/files/utils/lspPosition.test.ts src/features/files/components/FileViewPanel.test.tsx src/services/tauri.test.ts`
    - Result: passed
    - Summary: 55 passed / 55
- `npm run typecheck`
    - Result: passed
- `cargo check --manifest-path src-tauri/Cargo.toml`
    - Result: passed

## Test Coverage Added in This Iteration

- Position conversion utility:
    - offset -> LSP position
    - LSP position -> offset
    - 1-based editor location conversion
    - boundary clamping
- Service wrapper regression:
    - `getCodeIntelDefinition` success + error propagation
    - `getCodeIntelReferences` success + error propagation
- FileViewPanel component behavior:
    - definition single target direct navigation
    - definition multi-target candidate rendering and selection
    - references list rendering and click-through navigation

## Manual Acceptance Checklist (Java baseline)

- [x] 类名/方法跳转可跨文件打开（工程内）
- [x] 引用列表可展开并点击跳转
- [x] 已打开文件跳转后可定位到目标而非固定首行
- [x] 导航链路与 AI 对话链路已解耦（本地 code_intel）
- [x] 支持 Spring Boot YAML/YML 到 Java 配置关联

## Notes

- 本轮增加请求并发治理（陈旧请求抑制）与轻量缓存（短 TTL）以及重复触发防抖，目标是降低高频点击下的请求抖动和结果串线风险。
