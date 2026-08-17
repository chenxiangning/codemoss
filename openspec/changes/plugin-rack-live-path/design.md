# Design

```text
PluginRackSnapshot
  hostAvailable / hostEnabled     ← Host 闸刀（仍关）
  supervisorLive / pid / path     ← 门卫进程
  plugs[].state / live            ← Host slot（boot 仍 idle）
  plugs[].productPath / circuit   ← 产品电路

Claude 未设旗 → productPath=process-entry  circuit=live
Claude 显式 0 → productPath=core-spawn     circuit=fallback
Notes 未设旗  → productPath=isolated-sqlite circuit=live
Notes 显式 0  → productPath=core-files     circuit=fallback
later-plugin  → productPath=undeclared     circuit=idle
```

`state` 继续只反映 Host slot。通电灯走 `circuit`，避免把产品切流伪装成 Host 激活。
