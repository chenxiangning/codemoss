//! Plugin runtime contract surface. Not registered in command_registry.
#![allow(dead_code)]

pub mod broker;
pub mod claude_compat;
pub mod claude_pilot;
pub mod disk_storage;
pub mod host;
pub mod ipc;
pub mod loopback;
pub mod manifest;
pub mod notes_pilot;
pub mod notes_storage;
pub mod storage;
pub mod uds;
pub mod uds_driver;
