# Wave 1QJ4 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-runtime-quickjs-manifest-kind`  
> 论文对齐：名字不是身份；隔离粒度必须等于 Manifest 声明。  
> 结论：**方向正确。这是实洞。** isolate 只给 `kind=worker` + `runtime=quickjs`。`evil-worker` 不得建 isolate；声明过的 `notes-core` 可以。未嵌 C 引擎，不切产品。
