# Design

从 Notes / Claude fixture 抽出 `(pluginId, entryId)`，条件是 `kind=worker` 且 `runtime=quickjs`。`start` 只对这些 key 建 isolate。测试可注入额外声明，证明后缀不是闸门。
