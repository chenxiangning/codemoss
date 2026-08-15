# Proposal: plugin-host-reactivate-stop

> Wave：1H3（插座本体 · Ready 再激活必须 stop 旧 generation）  
> 依赖：1Y generation swap、1QJ1 isolate、1F1 spawn  
> 论文对齐：替换 = 先撤销旧效应再安装新效应；旧纤程不得残留。

## Why

Host `activate` 在 Ready 再激活时只 `started.clear()` + `generation += 1`，不调用 `driver.stop`。QuickJS isolate 与 Restricted Process child 会泄漏在旧 generation 上。

## 边界

1. Ready 再激活 MUST 先按 LIFO `stop` 旧 generation 的 entries。
2. 旧 generation 的 QuickJS isolate MUST 不可 `eval`。
3. Restricted Process live_count MUST 不超过新 generation 的 entries。
4. 不切产品。

## Capabilities

- `plugin-host-reactivate-stop-v1`
