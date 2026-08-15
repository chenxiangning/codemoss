# Design

`RestrictedProcessDriver` 实现 `EntryDriver`：

- `start`：`Command::new(allowlisted)` + `Stdio::null()`，记录 `Child`。
- `stop`：`child.kill()` + `wait()`，从 map 删除。
- 测试用当前 rustc/`true` 同类本机可执行文件，不拉网络、不读产品路径。

Host 现有 LIFO stop 已满足论文扭曲复合。本刀不握手 MXPC，只证明进程生命周期可逆。
