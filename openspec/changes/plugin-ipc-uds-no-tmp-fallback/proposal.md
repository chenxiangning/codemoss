# Proposal: plugin-ipc-uds-no-tmp-fallback

> Wave：1UDS5（插座本体 · 私有 UDS 失败不得回落到 /tmp）  
> 依赖：1UDS3 0700 私有目录  
> 论文对齐：config 是真值；未授权目录不得成为 transport。

## Why

1UDS3 禁止 `/tmp` 直绑。`uds_driver` / Worker / MXPD 在 `private_uds_path` 失败时仍 `unwrap_or_else("/tmp/mx-open.s")`。`bind_uds` 会拒这条路径，但失败语义被伪装成“有路径可绑”。私有目录失败必须 fail closed。

## 边界

1. `private_uds_path` 失败 MUST 向上返回，不得替换成 `/tmp/mx-open.s`。
2. Worker / UDS driver / MXPD MUST 在没有私有路径时不得 handshake / 写帧。
3. 源码 MUST NOT 再出现 `/tmp/mx-open.s` 作为回落。
4. 不切产品。

## Capabilities

- `plugin-ipc-uds-no-tmp-fallback-v1`
