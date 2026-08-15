# Proposal: plugin-runtime-quickjs-single-call

> Wave：1QJ9（插座本体 · Worker eval 只能是单次 mossx bridge 调用）  
> 依赖：1QJ2 allowlist、1QJ5 真实引擎、1QJ8 eval deadline  
> 论文对齐：隔离 = 独立上下文；未声明语句是未声明依赖，必须 fail closed。

## Why

1QJ2 只看前缀。`mossx.handshake.hello();1+1` 能过闸门并在 QuickJS 里执行第二条语句。deadline 挡死循环，挡不住夹带算术 / 副作用。

## 边界

1. 合法源码 MUST 整段匹配 `mossx.handshake.<ident>()` 或 `mossx.sdk.<ident>()`。
2. 尾随语句、分号链、空调用以外的参数 MUST `permission-denied`，不得进引擎。
3. `require` / `1 + 1` / 裸 `eval` 仍 MUST `permission-denied`。
4. 不切产品。

## Capabilities

- `plugin-runtime-quickjs-single-call-v1`
