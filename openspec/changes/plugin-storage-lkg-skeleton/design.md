# Design

组合面补 `04` §7 的最小闭环，不接 Host boot。

```text
ready + checkpoint
  → stage_own_update(candidateVersion, plan)   // migrate candidate，不写 pin
  → complete_own_update(Pass|Fail)
       Pass → 原子写 {storage_root}/plugin-lock.json，protect checkpoint
       Fail → restore_to(stage checkpoint)
              有旧 pin → 保留
              无旧 pin → quarantine
```

两个 lock 文件必须分开：

| 文件 | Owner | 含义 |
|---|---|---|
| `~/.ccgui/plugin-lockfile.json` | 产品插排 | desired-state（装/卸） |
| `{storage_root}/plugin-lock.json` | 本刀 LKG | artifact + checkpoint pin |

`staged` 只活在进程内。崩溃恢复与磁盘 retention cleanup 留给 P2.6 / P2.7。
