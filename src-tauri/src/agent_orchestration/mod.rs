//! Multi-Agent V1 control plane.
//!
//! 线性协作：Plan → user confirm → Execute（可选 Review）→ settle。
//! 复用 Shared Session ordinary turns + scoped binding；不做 DAG scheduler。

mod commands;
mod projection;
mod support;
mod types;

pub use commands::*;
pub use projection::project_agent_runs;
pub use support::require_agent_enabled;
pub use types::*;
