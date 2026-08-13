//! Sidebar session index: list-level SQLite cache for multi-engine histories.
//!
//! Design goals:
//! - Sidebar cold path reads SQL only (O(limit)), never full JSONL inventory.
//! - Writers prefer native light indexes (Claude history.jsonl, Codex session_index)
//!   and bounded recent-first file walks.
//! - Full multi-engine catalog projection remains Session Management / explicit refresh.

pub(crate) mod commands;
mod store;
mod writers;

pub(crate) use commands::{list_session_index_for_workspace, sync_session_index_for_workspace};
pub(crate) use store::{SessionIndexListPage, SessionIndexRow, SessionIndexSyncReport};
