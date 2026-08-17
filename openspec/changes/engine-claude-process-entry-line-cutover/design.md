# Design

```text
flag off → Tokio BufReader::lines() + active_processes Child
flag on  → spawn ProcessEntryTurn
           stdin 走 MXPC
           行读走 cursor.poll_line（非阻塞，循环里 sleep）
           stderr 随 poll 抽到 diagnostic
           interrupt/drop 走 Host.interrupt
```

`poll_line` 一次非阻塞读，避免 `next_line_until` 持锁睡眠堵死 interrupt。产品 5 处 stdout 读经 `next_claude_line`；timeout / grace 分支保留。本刀不解析 CLI exit status（Process Entry 收割走 interrupt）。
