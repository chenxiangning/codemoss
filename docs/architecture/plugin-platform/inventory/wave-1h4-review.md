# Wave 1H4 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-host-composite-driver`  
> 论文对齐：一个 unit 可含多条独立纤程；每条纤程走自己的获取 / 撤销。  
> 结论：**方向正确。这是实洞。** Host 现在能同时挂 Process + QuickJS。Claude 激活留下 1 child + 1 isolate；Notes 只留 isolate。disable / Ready 再激活两边一起撤。不进 boot，不切产品。
