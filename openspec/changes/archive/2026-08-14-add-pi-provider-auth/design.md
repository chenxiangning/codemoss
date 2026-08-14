# add-pi-provider-auth · Design

## 上下文

- PI CLI 引擎已接入（`add-pi-engine` archived），运行时读写 `~/.pi/**`；设置页 pi tab 现仅渲染 `CliBrandHeader` + `CliLifecycleInstallerPanel` + 「引擎设置」section（`VendorSettingsPanel.tsx` L1637-1672）。
- pi 的认证事实源是 `~/.pi/agent/auth.json`（`0600`）：`{ "<provider>": { "type": "api_key", "key": "..." } }`，OAuth 登录后为 `{ "type": "oauth", ... }`。解析优先级：`--api-key` → auth.json → 环境变量 → models.json（pi 官方 providers.md）。
- 设计稿（用户已验收）：`docs/prototypes/pi-provider-auth/pi-provider-auth.html`。

## 架构决策

### D1 · auth.json 读写 contract（后端唯一事实源）

新模块 `src-tauri/src/engine/pi_auth.rs`，三个 command：

| Command | 入参 | 返回 |
|---|---|---|
| `pi_auth_list_providers` | — | `PiAuthProviderSnapshot[]` + `auth_file: { path, exists }` |
| `pi_auth_set_api_key` | `provider_id: String, key: String` | `()` |
| `pi_auth_delete_credential` | `provider_id: String` | `()` |

Contract：

1. **读**：auth.json 不存在 → 全部 provider `none`，`auth_file.exists=false`，不报错。
2. **mask 规则**（唯一出口在后端，前端永远拿不到完整 key）：
   - `len > 10` → `head(6) + "········" + tail(4)`
   - `len ≤ 10` → `"········"`（短 key 不暴露任何字符）
   - key 以 `!` 开头（command 执行）→ 原样返回（本身不是秘密，如 `!op read 'op://vault/item'`）
   - key 以 `$` 开头（env 插值）→ 原样返回（只是变量名）
3. **写**：read → merge → 写 tmp（同目录）→ rename 覆盖；Unix 显式 `chmod 0600`。未知 provider 条目、OAuth 条目、credential 的 `env` 子对象 MUST 原样保留。
4. **删**：仅删除 `type == "api_key"` 的目标条目；`type == "oauth"` 条目拒绝删除（OAuth 凭证由 pi 自管，mossx 不代管），返回业务错误。
5. **env 检测**：`std::env::var(catalog.env_var)` 非空 → `env` 态。语义 = mossx spawn pi 时 pi 实际继承的环境，如实展示。
6. **catalog 对齐**：静态表对齐 pi v0.84.1 `packages/ai/src/env-api-keys.ts` 的 envMap（35 项，见附录 A）；pi 新增 provider 时人工跟进（与 `engine-capability-matrix` fixture 同模式）。
7. **状态优先级**：auth.json 有 `api_key` 条目 → `configured`（即使 env 也存在，与 pi 解析顺序一致：auth.json > env）；否则 env 非空 → `env`；否则 `none`。OAuth 订阅组独立判定：`type == "oauth"` → `subscribed`。

### D2 · 前端区块结构

`PiProviderAuthSection.tsx` 挂载在 pi tab「引擎设置」`VendorSettingsSection` 之后：

```
供应商认证（VendorSettingsSection label）
├─ Card 1 · 订阅授权（只读状态 + 终端拉起）
│   6 行固定 catalog：claude-sub / codex-sub / copilot / xai / openrouter / radius
│   状态：已授权（oauth 条目存在）/ 未授权
│   动作：「登录」→ requestTerminalCommand 事件 → AppShell 内嵌终端
│   先写 `pi`（或自定义 piBin）启动 TUI，1500ms 后写 `/login <provider>`
│   （slash 命令走 argv 会被当作 prompt 发给模型，必须两段式 PTY 输入）
│   状态同步：window focus 事件驱动 refresh（OAuth 完成后 auth.json 变更）
├─ Card 2 · API Key
│   行：brand icon + 名称 + env var chip + 状态 + 操作
│   状态：已配置（mask chip）/ 环境变量生效中（蓝点）/ 未配置
│   操作：设置 Key / 编辑（行内展开编辑器）/ 删除（configured 时）
│   编辑器：password input + eye 显隐 + 高级用法提示 + 保存/取消
│   搜索框：按 name / env var / id 过滤
│   footer：~/.pi/agent/auth.json · 0600 · 解析顺序说明
```

- 品牌图标：新模块 `src/features/vendors/piAuthProviderCatalog.ts`，从 `@lobehub/icons-static-svg/icons/*.svg` import（沿用 `providerBrandIcon.ts` 既有模式，含 `ProviderBrandIconImg` 深底衬规则）；Radius 无公开 logo，用 PI mono 黑标 div（与 `CliBrandHeader` 的 pi 标同款），不用字母占位冒充品牌。
- 状态管理：section 内局部 `useState` + 挂载时一次 `pi_auth_list_providers`；set/delete 后整体 refresh。**禁挂根 hook 链**（Render Perf Baseline 红线①），不新增轮询。
- 交互细节：同一时间只允许一个行内编辑器展开；保存空值 = 取消；删除需二次确认（复用 `DeleteConfirmDialog` 模式）。

### D2.5 · 跨 surface 终端命令请求（terminalCommandRequestEvent）

设置页与 AppShell 终端面板不在同一 prop 链上，新增 `mossx:terminal-command-request` document CustomEvent（沿用 `messageJumpEvent` 模式，事件驱动、不新增 shell state，AppShell Structure Gate 安全）：

- 生产端：任意 surface 调 `requestTerminalCommand({ terminalId, title, command, followUpCommand?, followUpDelayMs? })`。
- 消费端：`useAppShellWorkspaceFlowsSection` 监听事件，复用 Claude TUI resume 同款 `ensureTerminalWithTitle → openTerminal → restartTerminalSession → readyKey 监听 → writeTerminalSession` 链路；followUpCommand 在首条写入后延迟写入（TUI 就绪缓冲）。
- 遮挡处理：终端面板在主 App shell 内，事件处理时先 `closeSettings()` 退出设置页等全屏覆盖层，保证终端可见。（外部终端方案已否决：pi TUI 需 TTY stdin，无法跨平台注入 `/login`，会退化为手动输入。）
- 无 active workspace：记 debug entry，不中断设置页。

### D3 · i18n

新增 `settings.vendor.piAuth.*` key 组（约 30 条），10 locale 全量（en/es/fr/hi/ja/ko/pt-BR/ru/zh/zh-TW）。zh 为源语言文案，其余 locale 给对应翻译；key 缺失检测有既有 parity test 兜底。

### D4 · 安全边界

- 前端任何路径都拿不到完整 key：list 只给 mask；编辑器不回填已有 key（placeholder 显示 mask，留空保持不变）。
- Rust 单测覆盖：mask 边界（短 key / `!` / `$`）、原子写保留未知条目、0600、oauth 拒删、auth.json 缺失/损坏 JSON（损坏 → 报错且不覆写，fail-closed）。
- 前端 vitest：三态渲染、编辑器展开/保存/取消、env 态行禁用编辑冲突提示。

## 附录 A · Provider catalog（对齐 pi v0.84.1 envMap）

订阅 OAuth 组（6）：`anthropic`(Claude Pro/Max)、`openai`(ChatGPT Codex)、`github-copilot`、`xai`、`openrouter`、`radius`。
API Key 组（35）：anthropic / ant-ling / azure-openai-responses / openai / deepseek / nvidia / google / amazon-bedrock / mistral / groq / cerebras / cloudflare-ai-gateway / cloudflare-workers-ai / xai / openrouter / vercel-ai-gateway / zai / zai-coding-cn / opencode / opencode-go / radius / huggingface / fireworks / together / baseten / kimi-coding / minimax / minimax-cn / qwen-token-plan / qwen-token-plan-individual / qwen-token-plan-cn / xiaomi / xiaomi-token-plan-cn / -ams / -sgp。

UI 默认展示常用 16 项（与设计稿一致），其余折叠进「显示全部」；catalog 数据全量。

## 验证

- `cargo test pi_auth`（Rust 单测）
- `npx vitest run src/features/vendors`（前端）
- `npm run typecheck && npm run lint`
- 手测：设置页 PI CLI → 供应商认证，设置/编辑/删除 key 后 `cat ~/.pi/agent/auth.json` 核对；终端 `pi` 内 `/model` 确认可用。
