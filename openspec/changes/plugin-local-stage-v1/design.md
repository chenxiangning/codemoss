# Design

`stageLocalPlugin` 只把 pluginId 写入 localStorage。先 `previewInstall`。Host 快照仍只读。卸载是从 staged 集合删除。
