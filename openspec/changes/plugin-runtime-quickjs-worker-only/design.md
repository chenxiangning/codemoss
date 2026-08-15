# Design

`start` 若 `entry_id` 以 `-worker` 结尾则建 isolate，否则 no-op。`stop` 同样只删 worker isolate。Host 仍对全部 required entries 调 start/stop。
