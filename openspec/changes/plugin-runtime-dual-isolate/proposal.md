# Proposal: plugin-runtime-dual-isolate

> Wave：1I（插座组装 · 双插头隔离）  
> 依赖：1G PluginRuntime、2C namespace 闸门、3C/4C fixtures

## Why

零件级隔离已证。组合面必须再证：同一 runtime 同时激活 Claude 与 Notes 后，Claude 不得打开 Notes store，各自 stream 互不影响。

## 边界

1. 同一 PluginRuntime 激活两根插头。
2. Claude `access_file` Notes MUST `permission-denied`。
3. disable Notes 不得撤销 Claude stream。
4. 不进 boot，不删产品代码。

## Capabilities

- `plugin-runtime-dual-isolate-v1`
