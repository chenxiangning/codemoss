# add-pi-provider-auth · Verification

日期：2026-08-14 · 状态：implemented / user accepted

## 自动化验证

| 项 | 命令 | 结果 |
|---|---|---|
| Rust 单测 | `cargo test --lib pi_auth` | 8/8 绿（mask 边界、原子写保留、0600、oauth 拒删、损坏 fail-closed、缺失不建文件、未知 provider/空 key/换行 key 拒绝） |
| daemon dispatch | `cargo test --bin cc_gui_daemon ccgui_repair_regression_tests` | 2/2 绿（含新增 `daemon_dispatch_exposes_pi_auth_commands` pin） |
| 编译 | `cargo check --bins` | 0 error，pi_auth 相关 0 warning |
| 组件测试 | `vitest PiProviderAuthSection.test.tsx` | 11/11 绿（三态、编辑器、删除确认、搜索、终端事件 payload、自定义 bin 引号） |
| AppShell 链路 | `vitest useAppShellWorkspaceFlowsSection.test.tsx` | 12/12 绿（事件→ensure/open/restart/两段写入/closeSettings） |
| i18n parity | `vitest src/i18n` | 57/57 绿（10 locale） |
| vendor 全量 | `vitest src/features/vendors` | 177/178（唯一失败 `renders only supported CLI engines…` 经 stash 验证为存量，PI CLI 早已启用但断言未更新） |
| typecheck | `npm run typecheck` | 绿 |
| lint | `npm run lint` | 存量错误（干净树同 exit 1）；本 change 文件 0 命中 |
| AppShell Gate | `npm run check:app-shell:governance` | 存量失败 `[renderAppShell] missing piDoctor`（干净树同失败，与本 change 无关）；本 change 未新增 shell state / domain key |
| OpenSpec | `openspec validate add-pi-provider-auth --strict --no-interactive` | 绿 |

## 人工验收（用户 2026-08-14 确认「测试通过了」）

- 设置页 → CLI配置管理 → PI CLI → 供应商认证：订阅授权组 / API Key 组渲染与状态正确。
- API Key set / 编辑器交互：手测通过。
- 订阅组「登录」：初版被设置页遮挡 → 修复为事件消费端先 `closeSettings()` 再呈现内嵌终端；手测通过。
- 外部终端方案评估后否决：pi TUI 需 TTY stdin，无法跨平台注入 `/login`，会退化为手动输入。

## 存量失败清单（与本 change 无关，均已 stash 双向验证）

1. `VendorSettingsPanel.test.tsx › renders only supported CLI engines as enabled tabs`（PI CLI 启用后断言未跟进）
2. `src/services/tauri.test.ts › maps workspace session batch mutations`
3. `check-app-shell-runtime-contract: [renderAppShell] missing piDoctor`
4. `tests/assemble_canonical_facts.rs` 引用已归档 change 的 schema 示例文件（无法编译该 integration test target）
5. `src/styles/` 3 个 visual-contract 测试（file-view / sidebar / vendor-dialog）

## ADR 校准回写 Gate 复核

本 change 不动 engine registry（pi 已注册）、Shared 支持集合、provider binding（mossx provider profile）、canonical fact schema、context compiler、terminal/ACK contract、recovery exit/abandon——**不命中基石文档更新触发器**，无需回写 `docs/research/mossx-multi-cli-provider-session-foundation-design.md`。
