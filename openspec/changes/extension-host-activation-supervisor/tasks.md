# Tasks: extension-host-activation-supervisor

优先级：P0。依赖 1A codec。不接产品。

## 1. 状态机

- [x] 1.1 `HostConfig { enabled, maxConcurrent=2, activationDeadlineMs=10000 }`  
      验证：deadline 不能 > 30000
- [x] 1.2 `activate(pluginId, validatedManifest, unitId)` 走 required closure  
      验证：假 driver 全 ready → `ready` / generation=1
- [x] 1.3 required 失败反向 stop  
      验证：先 start 的 entry 被 stop，state=`failed`

## 2. Generation 与 fuse

- [x] 2.1 stale generation 调用返回 `stale-generation`
- [x] 2.2 `fuse(pluginId)` 后 activate 返回 `fused`，直到 `reset`
- [x] 2.3 `enabled=false` 返回 `host-disabled`

## 3. 隔离

- [x] 3.1 Host 源码不含 `std::net` / `Command::new` / `quick_js` / `UnixListener`
- [x] 3.2 不改 `command_registry.rs` / `src/app-shell/**`

## 4. 验收

- [x] 4.1 `cargo test --lib plugin_runtime::host`
- [x] 4.2 `openspec validate extension-host-activation-supervisor --strict --no-interactive`
- [x] 4.3 产品启动路径无 Host 构造
