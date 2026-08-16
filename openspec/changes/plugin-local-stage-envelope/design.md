# Design

`stageLocalPlugin` 在 `previewInstall` 之后用声明 capability 调 `validateRegistration`。额外传入未声明 id 时拒绝。
