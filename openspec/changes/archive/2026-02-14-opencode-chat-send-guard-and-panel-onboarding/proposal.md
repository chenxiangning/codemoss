# Proposal: OpenCode Chat Send Guard and Panel Onboarding

## Why

当前 OpenCode chat 体验存在 4 个关键断点:

1. 连接状态为红色（不可用）时仍可发送消息，导致失败重试和误操作。
2. OpenCode 管理面板弹出位置在右上方，与触发按钮断裂，交互心智不一致。
3. OpenCode chat 输入框下方承载了模型选择，造成聊天主路径噪音过高。
4. OpenCode 管理面板首页缺少连接引导，且默认连接选择掩盖了真实连接状态。

这些问题共同影响发送成功率、操作一致性与新用户上手效率。

## What Changes

- 增加 OpenCode 发送护栏：连接状态红色时禁止发送消息（含 Enter 发送与按钮发送）。
- 调整 OpenCode 管理面板弹层锚点：弹出位置改为触发按钮上方。
- 重构模型选择入口：从 chat 输入区下方迁移到 OpenCode 管理面板。
- 改造 OpenCode 管理面板首页：
    - 不预设默认连接选择。
    - 提供连接引导文案。
    - 显示当前连接状态。
    - 显示已完成认证类型。
    - 显示当前支持模型数量。

## Capabilities

### Modified Capabilities

- `opencode-engine`: 增补 OpenCode UI 交互护栏与连接引导相关规范，确保发送、配置入口与状态感知一致。

## Impact

### Frontend

- `src/features/composer/components/Composer.tsx`
- `src/features/composer/components/ComposerInput.tsx`
- `src/features/opencode/components/OpenCodeControlPanel.tsx`
- 相关 OpenCode store / hooks（连接状态、认证状态、模型 catalog 统计）

### UX / Behavior

- OpenCode 断连时用户无法误发消息。
- OpenCode 配置入口收敛到管理面板，chat 主路径更聚焦。
- 面板首页具备 onboarding 能力，状态可见性更强。

### Testing

- 发送护栏单测：红色状态发送被拦截。
- 面板定位单测：弹层锚定到按钮上方。
- 布局回归测试：chat 不再展示 OpenCode 模型选择区。
- onboarding 显示测试：状态/认证/模型数可见且无默认连接。
