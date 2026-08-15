# Design

`pipe_acl_ok(owner_sid, entries)` 是纯函数闸门。Windows bind 之后再消费同一函数。测试覆盖空 DACL、Everyone、缺当前用户。
