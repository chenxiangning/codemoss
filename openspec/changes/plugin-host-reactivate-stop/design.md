# Design

`Host::activate` 在进入 Activating 前记下 `(old_generation, started)`，换 generation 后立刻 LIFO stop。失败路径仍会 stop 新 started；旧的已经撤掉，符合 1Y「旧 generation 已死」。
