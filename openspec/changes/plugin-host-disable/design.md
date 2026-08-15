# Design

`disable` 对齐 `fuse`：stop 已启动 entry，clear started，state=`Disabled`。`activate` 对 Disabled 返回 `disabled`。`disable_and_revoke` 组合 DataPlane.revoke。reset 可回到 Idle。
