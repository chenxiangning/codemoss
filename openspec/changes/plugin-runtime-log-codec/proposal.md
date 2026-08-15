# Proposal: plugin-runtime-log-codec

> Wave：1AX（插座组装 · log-v1 是合法 V1 codec）  
> 依赖：1AB 未知 codec

## Why

1AB 已拒 `custom-pack`。组合面尚未独立验收合同白名单里的 `log-v1`。1F 后不得把合法 codec 一并误杀。

## 边界

1. Ready Notes 打开 `log-v1` stream MUST 成功。
2. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-log-codec-v1`
