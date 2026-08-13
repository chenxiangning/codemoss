## 1. Frontend Presentation

- [x] 1.1 [P0][无依赖] 输入既有 projected continuation Family rows，输出默认仅保留 start representative 的 visible rows；在 `ThreadList.tsx` 使用 local expanded Family set 实现，并用 focused Vitest 验证。
- [x] 1.2 [P0][依赖 1.1] 输入 Family label click/keyboard activation，输出展开全部成员或恢复折叠且不触发 Session selection；实现 `aria-expanded` disclosure button 并用 `ThreadList.test.tsx` 验证。
- [x] 1.3 [P1][依赖 1.2] 输入 collapsed/expanded Family state，输出闭合边框、方向 icon 与低强调标题视觉；更新 `sidebar.css` 并通过 DOM/class assertions 与 lint 验证。

## 2. Cross-Surface Regression

- [x] 2.1 [P0][依赖 1.1、1.2] 输入 pinned continuation Family，输出与普通 workspace list 相同的默认折叠和展开交互；更新 `PinnedThreadList.test.tsx`。
- [x] 2.2 [P0][依赖全部实现] 同步 `dev-guidelines/backend/native-provider-continuation-contract.md`，执行 focused Vitest、`npm run typecheck`、lint、runtime contracts 与 OpenSpec strict validation。
