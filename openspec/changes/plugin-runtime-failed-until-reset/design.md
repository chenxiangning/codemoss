# Design

`Host::activate` 在 `Fused` / `Disabled` 之后增加 `Failed` 闸门，错误码 `failed`。组合面回归：timeout 后直接 activate 失败。
