# Directory Structure（前端目录规范）

## Canonical Layout

```text
src/
  features/
    <feature>/
      components/
      hooks/
      utils/
      constants/ (optional)
      types/ (optional)
      services/ (optional)
      adapters/ (optional)
      contracts/ (optional)
  services/
    tauri.ts
    events.ts
    clientStorage.ts
  components/
    ui/
    common/
  styles/
  test/
```

## 落位规则（Placement Rules）

- 新功能优先放到 `src/features/<feature>/...`。
- 可复用基础 UI 放到 `src/components/ui`。
- 全局 bridge/service 放到 `src/services`，不要散落在 feature 里。
- 不要把 feature business logic 塞进 `src/components/ui`。
- 不要新建“万能 utils 目录”；先做 feature-local utility。

## Feature Slice 责任划分

- `components`: UI rendering + interaction wiring
- `hooks`: state orchestration + side effects
- `utils`: pure function（无 React 依赖）
- `contracts`: 前后端/运行时 contract 定义
- `adapters`: payload mapping（snake_case/camelCase 等）

## 命名规范（Naming）

- 文件/目录使用项目既有风格（kebab-case 为主，局部遵循 existing style）。
- React component export 使用 `PascalCase`。
- hook 必须 `useXxx`。
- 测试与源码同目录，文件名 `*.test.ts` / `*.test.tsx`。

## 禁止项

- 未评审前禁止引入平行顶级目录（如 `src/modules`）。
- 大范围迁移目录时，必须同 PR 完成 import/test 全量修复。
