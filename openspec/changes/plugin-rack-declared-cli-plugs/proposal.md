# Proposal: plugin-rack-declared-cli-plugs

> OpenSpec change id: `plugin-rack-declared-cli-plugs`  
> 依赖：`plugin-rack-declared-later-plugs`

## Why

路线图下一组 Feature 插头已上只读清单。其余 CLI 也已有 inventory 身份，但市场看不见。本刀只把它们写进只读清单。

## 目标与边界

1. 只读清单补上 `com.mossx.engine.codex` / `gemini` / `grok` / `kimi` / `opencode` / `pi`。
2. 身份必须来自现有 ownership inventory。
3. MUST NOT 激活、disable、安装，MUST NOT 把已删 CLI 拷回 Core。
4. MUST NOT 默认开 flag、删 `engine/claude*`、迁 `note_cards`。

## Capabilities

- `plugin-rack-declared-cli-plugs-v1`
