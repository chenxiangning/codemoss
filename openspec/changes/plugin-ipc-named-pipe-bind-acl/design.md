# Design

`bind_named_pipe_secured(name, owner, allow)`：名字闸门 + `pipe_acl_ok`，再进平台 bind。默认 `bind_named_pipe` 走当前用户 fixture SID，禁止无 ACL 的公开入口。
