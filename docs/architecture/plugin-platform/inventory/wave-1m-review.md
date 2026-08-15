# Wave 1M Self-Review

> 日期：2026-08-16  
> 范围：`plugin-runtime-stale-generation`  
> 结论：**方向正确。reset 后旧 generation 不得再拿 handle。**

## 证明

- 旧 generation query / open_stream → `stale-generation`
- 新 generation 成功
- 未进 boot，未迁产品数据
