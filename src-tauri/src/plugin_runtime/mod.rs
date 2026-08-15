//! Plugin runtime contract surface. Not registered in command_registry.
#![allow(dead_code)]

pub mod boot;
pub mod broker;
pub mod claude_compat;
pub mod claude_pilot;
pub mod composite;
pub mod disk_storage;
pub mod host;
pub mod host_data;
pub mod ipc;
pub mod loopback;
pub mod manifest;
pub mod mxpd;
pub mod mxpd_uds;
pub mod named_pipe;
pub mod named_pipe_driver;
pub mod notes_compat;
pub mod notes_pilot;
pub mod notes_storage;
pub mod quickjs;
pub mod runtime;
pub mod spawn;
pub mod stdio;
pub mod storage;
pub mod uds;
pub mod uds_driver;
