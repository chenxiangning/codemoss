//! Plugin runtime contract surface. Not registered in command_registry.
#![allow(dead_code)]

pub mod broker;
pub mod claude_compat;
pub mod claude_pilot;
pub mod disk_storage;
pub mod host;
pub mod host_data;
pub mod ipc;
pub mod loopback;
pub mod manifest;
pub mod mxpd;
pub mod notes_compat;
pub mod notes_pilot;
pub mod notes_storage;
pub mod stdio;
pub mod storage;
pub mod uds;
pub mod uds_driver;
