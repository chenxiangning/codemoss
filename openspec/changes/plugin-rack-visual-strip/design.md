# Design

## Context

当前产品：

- D-052 已让 Notes / Claude / Project Map 走真实 `install_plugin` / `uninstall_plugin`。
- `PluginRackSection` 按 `kind`（engine / feature）分组渲染卡片。`installable` 为真时出按钮。
- 用户目标把这页读成「插排」：3 个可插拔，9 个封口。卡片列表达不到这个验收。
- Host 仍 default-off。本刀不碰 Rust allowlist / lockfile / restore。

约束：

- 颜色 / 字号 / 圆角只能用 `design-tokens.md` 与 `docs/previews/intent-canvas-ui-2026-08-13/tokens.css`。
- 禁止给 later-plugin 装按钮，即使按钮 disabled。
- 现有 vitest 断言 3 个 Uninstall；本刀改结构后必须改断言，不能丢「只有 3 个按钮」这条红线。

## Goals / Non-Goals

**Goals:**

- 插排页一眼可读：Host 条、可插拔仓 3 座、只读仓 9 座。
- 可插拔座的插入/拔出就是现有 install/uninstall，无第二条实现。
- 原型与实现同一套视觉语法，token 不漂移。

**Non-Goals:**

- Marketplace、Slim、Host 真 boot、其余 9 根协议。
- 拖拽插拔、动画作为验收条件（允许极短状态反馈，不作为合同）。
- 改 `pluginRack.ts` 的 snapshot 形状（已够用：`installable` + `desiredState` + `circuit`）。

## Decisions

### D1. 分组从 kind 改为 writable / sealed

卡片按 Engines / Features 分组，把 Claude 和 Codex 放在一起，削弱「3 真 / 9 只读」。

改成两个 bank：

- live bank：`plug.installable === true`（当前恰好 3 个）
- later bank：其余

kind 降为插座上的弱标签，不再当一级分区。

备选：保留 kind 分组再在卡上画插座。拒绝，主结构仍是设置列表。

### D2. 插座状态只读 `desiredState` + `circuit`

- `desiredState !== "uninstalled"` → 插头插入井内，按钮文案 Uninstall
- `desiredState === "uninstalled"` → 空井，按钮文案 Install
- later → 封口盖，无 button
- `circuit` 只染色井沿（live / fallback / idle），用 `--status-success` / `--status-warning` / `--text-dim`，不发明新色

备选：用 Host `state === ready` 当插入。拒绝。Host default-off 时 slot 常是 idle，用户会以为三根都没插上。产品语义是 lockfile desired state。

### D3. 先独立 HTML 原型，再改 React

路径：`docs/prototypes/plugin-rack-visual/index.html`。内联 tokens fallback（从 `tokens.css` 抄，不自造）。原型可点 3 座、9 座不可点。实现抄同一 DOM 分层：`strip` / `bank` / `socket` / `well` / `plug`。

备选：直接改 React。拒绝。UI 闸门要求独立原型；也避免在 App 壳里试色。

### D4. 不改 snapshot API

`PluginRackPlug.installable` 已是前端唯一可写闸门。视觉层只消费，不新增字段。

备选：加 `socketKind: live | sealed`。拒绝。YAGNI，且会让后端为 UI 长字段。

### D5. 旧卡片 CSS 保留，新增 strip 选择器

`.extensions-plugin-rack-card` 等仍在 `extensions.css`（catalog / 旧测试）。本刀加 `.extensions-plugin-rack-strip` 一族。layout 测试同时锁 strip 与「无 Browse Marketplace」。

## Risks / Trade-offs

- [Risk] 用户把封口座当成坏掉的按钮 → Mitigation：封口盖 + 「后续 / 只读」文案，无 pointer、无 button。
- [Risk] 视觉被读成 Marketplace 已开 → Mitigation：footnote 仍写远程市场关闭；D-053 写死 3/9。
- [Risk] 窄窗 12 座挤爆 → Mitigation：live 3 座单行可换行；later 9 座 auto-fit 网格，最小宽度用 token 间距，不横向强制一屏。
- [Trade-off] 插排是隐喻，不是硬件仿真。井/销用 CSS 几何，不用照片或手绘 SVG 人像。

## Migration Plan

1. 落盘原型，结构与 token 固定。
2. 改 `PluginRackSection` + i18n + CSS + 测试。
3. 回滚：还原该组件到卡片列表即可；后端行为不变。

## Open Questions

无。用户口径已锁：插排 100%，插头 3 个可插拔。
