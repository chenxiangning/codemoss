# Design

第一次用 timeout driver 激活失败。reset 后换成功 driver 再 activate。FakeDriver 绑在 runtime 里，reset 后同一 driver 仍会 timeout。因此本刀用「第一次 fail_on，reset 后清 fail_on」不可行——driver 被 runtime 持有。

做法：第一次 timeout 后 reset。第二次 activate 仍会失败，除非能改 driver。改成 `runtime.host` 的 driver 是 pub？当前 `Host.driver` 在测试模块可访问。测试里直接 `runtime.host` 清 `fail_on`。
