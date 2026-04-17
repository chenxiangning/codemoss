## 1. OpenCode 专属 UI 子域搭建（P0）

- [x] 1.1 [P0][depends: none] 新建 `src/features/opencode/` 目录结构（components/hooks/store/types），不改现有 Claude/Codex
  目录。
- [x] 1.2 [P0][depends: 1.1] 在 `App.tsx` 增加 `activeEngine === "opencode"` 条件挂载入口。
- [x] 1.3 [P0][depends: 1.2] 增加回归断言：非 OpenCode 引擎下不渲染 OpenCode 面板。

## 2. 统一状态面板与模型标签（P0）

- [x] 2.1 [P0][depends: 1.2] 实现 OpenCode Status 面板（Session/Agent/Model/Provider/MCP/Token/Context）。
- [x] 2.2 [P0][depends: 2.1] 对接 OpenCode 状态聚合接口（status snapshot）。
- [x] 2.3 [P0][depends: 1.2] 在 OpenCode 模型下拉增加 speed/cost/context 标签渲染。
- [x] 2.4 [P0][depends: 2.3] 增加 metadata 缺失降级策略（静态标签 fallback）。

## 3. Provider 健康检查与 MCP 精细控制（P0）

- [x] 3.1 [P0][depends: 1.1] 新增 OpenCode Provider health Tauri command（test + status）。
- [x] 3.2 [P0][depends: 3.1] 新增 OpenCode Provider UI：连接状态显示 + 一键测试。
- [x] 3.3 [P0][depends: 1.1] 新增 OpenCode MCP server 级 toggle command（总开关 + 单项开关）。
- [x] 3.4 [P0][depends: 3.3] 新增 OpenCode MCP UI：列表开关 + 权限提示。

## 4. 会话发现增强与 Advanced 下沉（P1）

- [x] 4.1 [P1][depends: 1.2] 增加 OpenCode 会话搜索与最近/收藏筛选。
- [x] 4.2 [P1][depends: 1.2] 将 OpenCode debug/console/heap 入口下沉到 Advanced 区域。
- [x] 4.3 [P1][depends: 4.2] 验证主流程无调试入口噪音（仅 Advanced 可见）。

## 5. 隔离回归与验收（P0）

- [x] 5.1 [P0][depends: 1.x,2.x,3.x] 前端测试：OpenCode 面板渲染、模型标签、provider health、mcp toggle。
- [x] 5.2 [P0][depends: 5.1] 隔离测试：Claude/Codex 模式快照与交互行为不变。
- [x] 5.3 [P0][depends: 3.x] 后端测试：OpenCode 新 commands 并发与错误路径。
- [x] 5.4 [P0][depends: 5.1,5.2,5.3] 执行 `npm run typecheck && npm run lint && npm run test` 并记录。
- [x] 5.5 [P0][depends: 5.3] 执行 `cargo test --manifest-path src-tauri/Cargo.toml` 并记录。
