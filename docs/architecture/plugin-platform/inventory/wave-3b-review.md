# Wave 3B Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-pilot-manifest`  
> 结论：**方向正确。停在 Contract 草稿。** 下一刀才是 Host 按该 fixture 做假激活（3C），不是 dual-run，更不是删 Core Claude。

## 方向

| 检查 | 结果 |
|---|---|
| exact `mossx.engine.provider` | 通过。`engineId=claude`，无 template |
| Worker dependsOn Process | 通过。`claude-worker` → `claude-cli` |
| 无 onStartup / trusted-react | 通过 |
| 不改 `engine/claude*` | 通过 |
| parser 接受 | 通过。vitest 15 |

## 颗粒度

3B 只多了一份 fixture + 两则单测。没有 adapter，没有独立仓库。这是插头协议第 2 步（Contract）。

## 下一阶段边界（锁定）

**3C：用现有 Host + Fake/Loopback 激活 `claude-engine` unit。**  
仍禁止改 Claude 生产实现、禁止 dual-run、禁止其他 CLI Manifest。
