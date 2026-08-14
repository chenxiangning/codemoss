# add-pi-provider-auth · Tasks

## 1. 后端 · pi_auth 模块与 command

- [x] 1.1 新增 `src-tauri/src/engine/pi_auth.rs`：provider catalog 静态表（35 API Key + 6 OAuth，对齐 pi v0.84.1 envMap）、`PiAuthProviderSnapshot` 类型（serde camelCase）
- [x] 1.2 实现 auth.json 读 + 状态推导（configured / env / none / subscribed；oauth 条目识别）
- [x] 1.3 实现 mask 规则（>10 → head6+tail4；≤10 → 全 mask；`!` / `$` 前缀原样）
- [x] 1.4 实现 `pi_auth_set_api_key`：原子写（tmp+rename）、0600、保留未知条目与 oauth 条目
- [x] 1.5 实现 `pi_auth_delete_credential`：仅删 `api_key` 条目，oauth 拒删返回业务错误
- [x] 1.6 Rust 单测：mask 边界、原子写保留、0600、oauth 拒删、auth.json 缺失 / 损坏 fail-closed
- [x] 1.7 注册 command（`command_registry` + `lib.rs` invoke_handler 链路）

## 2. 前端 · service 与 catalog

- [x] 2.1 `src/services/tauri/` 新增 `piAuthSetApiKey` / `piAuthDeleteCredential` / `piAuthListProviders` wrapper + TS 类型
- [x] 2.2 `src/features/vendors/piAuthProviderCatalog.ts`：UI catalog（id / name / envVar / brand icon import），品牌图标走 `@lobehub/icons-static-svg` npm 包 + `ProviderBrandIconImg`；Radius 用 PI mono 黑标

## 3. 前端 · PiProviderAuthSection 组件

- [x] 3.1 区块骨架：订阅授权 Card（只读 + `pi /login` copy 引导）+ API Key Card（搜索 / 列表 / footer 状态条）
- [x] 3.2 三态行渲染（configured mask chip / env 蓝点 / none）+ 操作按钮
- [x] 3.3 行内编辑器：password + eye 显隐 + 高级用法提示 + 保存 / 取消；同时仅一个展开；空值 = 取消
- [x] 3.4 删除二次确认（复用 DeleteConfirmDialog 模式）
- [x] 3.5 挂载 `VendorSettingsPanel.tsx` pi tab「引擎设置」之后；局部 state，禁挂根 hook 链、禁轮询
- [x] 3.6 vitest：三态渲染、编辑器交互、env 态提示、删除确认
- [x] 3.7 OAuth 登录拉起内嵌终端：`terminalCommandRequestEvent` + AppShell 监听（两段式 PTY 写入）+ window focus 刷新；组件事件测试 + app-shell 链路钉测试
- [x] 3.8 终端遮挡修复：事件消费端先 `closeSettings()` 再呈现终端（外部终端方案已否决：TUI 需 TTY stdin，无法跨平台注入 /login）

## 4. i18n 与样式

- [x] 4.1 `settings.vendor.piAuth.*` key 组，10 locale 全量
- [x] 4.2 样式沿用 vendor 既有 token（vendor-group-card / settings-help / brand icon tile），不引入新色板；必要时补少量 CSS

## 5. 验证与收口

- [x] 5.1 `cargo test pi_auth` 绿
- [x] 5.2 `npx vitest run src/features/vendors` 绿
- [x] 5.3 `npm run typecheck && npm run lint` 绿
- [x] 5.4 手测：设置 key → 核对 `~/.pi/agent/auth.json`（0600、其他条目保留）→ 终端 pi `/model` 可用；删除后还原；订阅组「登录」拉起内嵌终端自动进入 `/login <provider>` 流程
- [x] 5.5 `openspec validate add-pi-provider-auth --strict --no-interactive` 绿；复核 ADR 校准回写 Gate 判断（proposal「风险」节已记录：不命中）
