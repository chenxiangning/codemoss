# Design

产品 / daemon 的 workspace interrupt 改调 `interrupt_claude_sessions`。flag off 时该函数仍直打 Core manager，行为不变。本刀不碰 turn 级 interrupt。
