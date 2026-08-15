# Wave 3 Checkpoint Review

> 日期：2026-08-16  
> 范围：3A inventory + 3B Manifest + 3C Host 假激活  
> 结论：**插头协议的 Inventory → Contract → 假激活 已走完。Wave 3 未完成。** 生产 Claude 仍是唯一 runtime owner。下一刀才是 compatibility adapter 草稿，禁止从此处 disable-not-delete。

## 已交付

| 刀 | change | 证明 |
|---|---|---|
| 3A | `engine-claude-pilot-inventory` | 61 个 claude 文件名、23 条 command、stay-in-Core / 6 CLI 不跟随 |
| 3B | `engine-claude-pilot-manifest` | `claude-engine.json` 被 `parseManifestV1` 接受；禁止 template / onStartup |
| 3C | `engine-claude-pilot-host-activate` | FakeDriver 激活 fixture unit → `ready`；`engine/claude*` 无 diff |

## 方向

| 检查 | 结果 |
|---|---|
| 单插头 | 通过。未写其他 CLI Manifest |
| 不删 Core | 通过 |
| 不双写 | 通过。产品路径未接 Host |
| Engine Contract 留 Core | 通过 |
| 产品行为 | 零变化 |

## 颗粒度

把 Wave 3 拆成盘点 / 合同 / 假激活是对的。没有把 dual-run 和删代码塞进来。

## 明确未做（3D+）

1. compatibility adapter（Core 内单 owner 门面，仍调现有 `engine::claude`）
2. feature flag dual-run
3. 独立仓库 / `.mossx-plugin`
4. disable-not-delete / 删 `engine/claude*`
5. Notes 插头

## 下一阶段边界（锁定）

**3D：`engine-claude-compat-adapter` 门面。**  
只增加一层 `ClaudeCompatAdapter`，内部仍调用现有 Core Claude。Host 不接 App 启动链。禁止搬 history 实现、禁止改 session store。
