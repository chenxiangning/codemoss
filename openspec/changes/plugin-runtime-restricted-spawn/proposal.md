# Proposal: plugin-runtime-restricted-spawn

> Wave：1F1（插座本体 · Restricted Process 可逆 spawn）  
> 依赖：1E3 framed stdio、Host `EntryDriver`  
> 论文对齐：时空可组合性「获取 / 排放」——`spawn` 是获取，逆是 `kill`；失败必须走卸载，不留孤儿。

## Why

插座本体还缺真实进程边界。当前 `UdsHandshakeDriver` / framed stdio 都是 thread peer。1F 第一刀只把 **Host-owned child** 做成可逆效应：`start` 拉起 allowlisted 可执行文件，`stop` 杀掉该 generation 的子进程。

## 边界

1. 只允许当前进程可解析的 allowlist 可执行文件；未知路径 MUST `Crash`。
2. `stop` MUST 终止对应 `(pluginId, entryId, generation)` 的 child，不得留孤儿。
3. 第二个 entry 握手失败时，Host 反向 stop 已启动 child。
4. **禁止**进 `lib.rs::run`，禁止 Named Pipe，禁止 QuickJS，禁止产品切流。

## Capabilities

- `plugin-runtime-restricted-spawn-v1`
