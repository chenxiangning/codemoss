# Design: engine-claude-pilot-manifest

## Decisions

### D1. Worker 拥有 Engine contribution

`claude-worker` 声明 `mossx.engine.provider`。`claude-cli` 是 required Process，Worker `dependsOn` 它。Core 不按文件名推断。

### D2. 激活只用 onEngine

```text
events: [{ type: onEngine, engineId: claude }]
```

默认 Engine 预热是 system policy，不能写进插件 Manifest 的 `onStartup`。

### D3. Process 平台键齐全

required process 必须带齐 6 个 PlatformId，避免 parser `missing-platform`。路径是占位字符串，本刀不读 bin。

### D4. 不进 Host

只当 fixture。3C 才用 `ActivationRequest` 跑假 driver。
