# Wave 1NP2 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-named-pipe-acl`  
> 结论：**方向正确。Named Pipe ACL 只允许当前用户。** 空 DACL / Everyone / Authenticated Users 一律 permission-denied。Windows 挂 SD 留给 1NP3。不切产品。
