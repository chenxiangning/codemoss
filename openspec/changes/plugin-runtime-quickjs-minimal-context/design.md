# Design

`Context::full` 换成 `Context::custom::<intrinsic::Eval>`。`Eval` 是 `ctx.eval` 所需；Date / JSON / Promise 不得注册。测试用 `eval_raw` 证明这些全局对象不可达。
