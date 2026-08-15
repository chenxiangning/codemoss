# Design

从 Notes / Claude fixture 抽出 `(pluginId, entryId)`，条件是 `kind=process`。`start` 只对这些 key spawn。Host 仍对全部 required entries 调 start/stop；非 process 为 no-op。测试可 `declare` 额外 process，证明后缀 / 名字不是闸门。
