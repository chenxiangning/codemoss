# Wave 1QJ3 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-runtime-quickjs-worker-only`  
> 论文对齐：隔离粒度必须等于组件粒度；UI / CLI 不是 QuickJS 纤程。  
> 结论：**方向正确。这是实洞。** 只有 `*-worker` 才建 isolate。Notes + Claude 激活后 live_count=2；`notes-ui` eval 为 `plugin-unavailable`。未嵌 C 引擎，不切产品。
