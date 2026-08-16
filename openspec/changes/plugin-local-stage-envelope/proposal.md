# Proposal: plugin-local-stage-envelope

> OpenSpec change id: `plugin-local-stage-envelope`

## Why

P0.7 注册信封已落地，但市场本地 stage 还没走它。安装标记不得把未声明 capability 写进 lockfile。

## 目标与边界

1. stage MUST 调用 `validateRegistration`。
2. 未声明 contribution / capability MUST fail closed，lockfile MUST 不变。
3. MUST NOT 激活 Host。

## Capabilities

- `plugin-local-stage-envelope-v1`
