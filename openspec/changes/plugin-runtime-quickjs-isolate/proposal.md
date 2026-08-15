# Proposal: plugin-runtime-quickjs-isolate

> Wave：1QJ1（插座本体 · per-plugin QuickJS Worker 隔离闸门）  
> 依赖：1H1 Host boot 默认 off、1F2 Restricted Process  
> 论文对齐：隔离 = 独立上下文；未声明依赖直接抛错；卸载丢弃子上下文。

## Why

合同要求普通 Worker 跑在 Host 内 per-plugin QuickJS，默认没有 filesystem / network / process / environment / Node builtin。当前只有 Restricted Process，Worker 面仍是空的。本刀先锁隔离与默认拒绝，不嵌 C 引擎、不进产品切流。

## 边界

1. 每个 `(pluginId, entryId, generation)` MUST 有独立 isolate。
2. `require('fs')` / `process` / `fetch` / `import()` / Node builtin MUST `permission-denied`。
3. `stop` MUST 丢弃该 isolate。
4. Claude isolate 不得看见 Notes isolate。
5. **禁止**加 rquickjs / V8 依赖，禁止进产品 flag，禁止 Marketplace。

## Capabilities

- `plugin-runtime-quickjs-isolate-v1`
