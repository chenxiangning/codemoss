//! Phase 5 Agent Squad：Shared Session 内的 canonical control plane。
//!
//! V1 只编排 ordinary CLI Worker Session。Rust 负责事实、校验、调度与权限边界；
//! 现有 `shared_session_v2` 继续拥有每个 Worker attempt 的 runtime lifecycle。

pub mod commands;
pub mod plan_commands;
pub mod projection;
pub mod scheduler;
pub mod scope;
pub mod stop_commands;
mod support;
pub mod types;
pub mod validator;

pub use types::*;

#[cfg(test)]
mod tests;
