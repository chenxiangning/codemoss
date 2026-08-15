//! Windows Named Pipe MXPC transport. No TCP, not in boot.

use super::ipc::IpcError;

fn err(code: &'static str, message: impl Into<String>) -> IpcError {
    IpcError {
        code,
        message: message.into(),
    }
}

pub fn private_pipe_name(plugin_id: &str) -> Result<String, IpcError> {
    let token = super::uds::plugin_dir_token(plugin_id)?;
    let name = format!(r"\\.\pipe\mossx-{token}");
    if !pipe_name_ok(&name) {
        return Err(err("schema", "derived named pipe is not mossx-*"));
    }
    Ok(name)
}

pub fn pipe_name_ok(name: &str) -> bool {
    let Some(rest) = name.strip_prefix(r"\\.\pipe\mossx-") else {
        return false;
    };
    !rest.is_empty()
        && rest
            .chars()
            .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
}

const EVERYONE: &str = "S-1-1-0";
const AUTHENTICATED_USERS: &str = "S-1-5-11";
const WORLD: &str = "S-1-1-0";
const DEFAULT_OWNER: &str = "S-1-5-21-1-2-3-1001";

pub fn pipe_acl_ok(owner_sid: &str, allow_sids: &[&str]) -> Result<(), IpcError> {
    if owner_sid.trim().is_empty() || owner_sid != owner_sid.trim() {
        return Err(err("schema", "owner SID is required"));
    }
    if allow_sids.is_empty() {
        return Err(err("permission-denied", "named pipe ACL must not be empty"));
    }
    if allow_sids.iter().any(|sid| {
        *sid == EVERYONE || *sid == AUTHENTICATED_USERS || *sid == WORLD || sid.trim().is_empty()
    }) {
        return Err(err(
            "permission-denied",
            "named pipe ACL cannot include Everyone or Authenticated Users",
        ));
    }
    if !allow_sids.contains(&owner_sid) {
        return Err(err(
            "permission-denied",
            "named pipe ACL must include the current user",
        ));
    }
    Ok(())
}

fn sid_ok(sid: &str) -> bool {
    let mut parts = sid.split('-');
    if parts.next() != Some("S") {
        return false;
    }
    let rest: Vec<&str> = parts.collect();
    rest.len() >= 3
        && rest
            .iter()
            .all(|part| !part.is_empty() && part.chars().all(|ch| ch.is_ascii_digit()))
}

pub fn sddl_ok(sddl: &str, owner_sid: &str) -> bool {
    !sddl.is_empty()
        && sddl.contains(owner_sid)
        && !sddl.contains("WD")
        && !sddl.contains(EVERYONE)
        && !sddl.contains(AUTHENTICATED_USERS)
        && !sddl.contains(";AU)")
}

pub fn compile_pipe_sddl(owner_sid: &str, allow_sids: &[&str]) -> Result<String, IpcError> {
    pipe_acl_ok(owner_sid, allow_sids)?;
    if !sid_ok(owner_sid) {
        return Err(err("schema", "owner SID is malformed"));
    }
    if allow_sids != [owner_sid] {
        return Err(err(
            "permission-denied",
            "named pipe SDDL must be current-user only",
        ));
    }
    let sddl = format!("O:{owner_sid}G:{owner_sid}D:P(A;;GA;;;{owner_sid})");
    if !sddl_ok(&sddl, owner_sid) {
        return Err(err("permission-denied", "compiled SDDL is not owner-only"));
    }
    Ok(sddl)
}

fn gate_named_pipe(name: &str, owner_sid: &str, allow_sids: &[&str]) -> Result<String, IpcError> {
    if !pipe_name_ok(name) {
        return Err(err("schema", "named pipe must be \\\\.\\pipe\\mossx-*"));
    }
    compile_pipe_sddl(owner_sid, allow_sids)
}

#[cfg(windows)]
pub fn bind_named_pipe_secured(
    name: &str,
    owner_sid: &str,
    allow_sids: &[&str],
) -> Result<windows_pipe::NamedPipeServer, IpcError> {
    let sddl = gate_named_pipe(name, owner_sid, allow_sids)?;
    windows_pipe::bind(name, &sddl)
}

#[cfg(not(windows))]
pub fn bind_named_pipe_secured(
    name: &str,
    owner_sid: &str,
    allow_sids: &[&str],
) -> Result<(), IpcError> {
    let _sddl = gate_named_pipe(name, owner_sid, allow_sids)?;
    Err(err(
        "unsupported-platform",
        "Named Pipe transport is windows-only in V1",
    ))
}

#[cfg(windows)]
pub fn bind_named_pipe(name: &str) -> Result<windows_pipe::NamedPipeServer, IpcError> {
    bind_named_pipe_secured(name, DEFAULT_OWNER, &[DEFAULT_OWNER])
}

#[cfg(windows)]
pub fn connect_named_pipe(name: &str) -> Result<std::fs::File, IpcError> {
    if !pipe_name_ok(name) {
        return Err(err("schema", "named pipe must be \\\\.\\pipe\\mossx-*"));
    }
    windows_pipe::connect(name)
}

#[cfg(not(windows))]
pub fn bind_named_pipe(name: &str) -> Result<(), IpcError> {
    bind_named_pipe_secured(name, DEFAULT_OWNER, &[DEFAULT_OWNER])
}

#[cfg(windows)]
mod windows_pipe {
    use super::{err, IpcError};
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle, RawHandle};
    use std::ptr::null_mut;

    use windows_sys::Win32::Foundation::{GENERIC_READ, GENERIC_WRITE, HANDLE, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::Storage::FileSystem::{
        CreateFileW, FILE_ATTRIBUTE_NORMAL, FILE_FLAG_FIRST_PIPE_INSTANCE, FILE_SHARE_READ,
        FILE_SHARE_WRITE, OPEN_EXISTING, PIPE_ACCESS_DUPLEX,
    };
    use windows_sys::Win32::System::Pipes::{
        ConnectNamedPipe, CreateNamedPipeW, PIPE_READMODE_BYTE, PIPE_TYPE_BYTE, PIPE_WAIT,
    };

    pub struct NamedPipeServer {
        handle: OwnedHandle,
    }

    impl NamedPipeServer {
        pub fn accept(self) -> Result<std::fs::File, IpcError> {
            let raw = self.handle.as_raw_handle() as HANDLE;
            let ok = unsafe { ConnectNamedPipe(raw, null_mut()) };
            if ok == 0 {
                return Err(err("transport", "ConnectNamedPipe failed"));
            }
            Ok(std::fs::File::from(self.handle))
        }
    }

    fn wide(name: &str) -> Vec<u16> {
        OsStr::new(name).encode_wide().chain(Some(0)).collect()
    }

    pub fn bind(name: &str, sddl: &str) -> Result<NamedPipeServer, IpcError> {
        use windows_sys::Win32::Security::Authorization::{
            ConvertStringSecurityDescriptorToSecurityDescriptorW, SDDL_REVISION_1,
        };
        use windows_sys::Win32::Security::SECURITY_ATTRIBUTES;
        use windows_sys::Win32::System::Memory::LocalFree;

        let wide_name = wide(name);
        let wide_sddl = wide(sddl);
        let mut sd: *mut core::ffi::c_void = null_mut();
        let ok = unsafe {
            ConvertStringSecurityDescriptorToSecurityDescriptorW(
                wide_sddl.as_ptr(),
                SDDL_REVISION_1,
                &mut sd,
                null_mut(),
            )
        };
        if ok == 0 || sd.is_null() {
            return Err(err("permission-denied", "SDDL could not become a descriptor"));
        }
        let mut attrs = SECURITY_ATTRIBUTES {
            nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: sd,
            bInheritHandle: 0,
        };
        let handle = unsafe {
            CreateNamedPipeW(
                wide_name.as_ptr(),
                PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE,
                PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
                1,
                65_536,
                65_536,
                0,
                &mut attrs,
            )
        };
        unsafe {
            LocalFree(sd);
        }
        if handle == INVALID_HANDLE_VALUE {
            return Err(err("transport", "CreateNamedPipeW failed"));
        }
        Ok(NamedPipeServer {
            handle: unsafe { OwnedHandle::from_raw_handle(handle as RawHandle) },
        })
    }

    pub fn connect(name: &str) -> Result<std::fs::File, IpcError> {
        let wide_name = wide(name);
        let handle = unsafe {
            CreateFileW(
                wide_name.as_ptr(),
                GENERIC_READ | GENERIC_WRITE,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                null_mut(),
                OPEN_EXISTING,
                FILE_ATTRIBUTE_NORMAL,
                0,
            )
        };
        if handle == INVALID_HANDLE_VALUE {
            return Err(err("transport", "CreateFileW named pipe failed"));
        }
        Ok(unsafe { std::fs::File::from_raw_handle(handle as RawHandle) })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_invalid_plugin_id_cannot_create_a_pipe_name() {
        assert_eq!(
            private_pipe_name("not-a-plugin").unwrap_err().code,
            "schema"
        );
    }

    #[test]
    fn notes_and_claude_do_not_share_a_named_pipe() {
        let notes = private_pipe_name("com.mossx.notes").expect("notes");
        let claude = private_pipe_name("com.mossx.engine.claude").expect("claude");
        assert_ne!(notes, claude);
        assert!(pipe_name_ok(&notes));
        assert!(pipe_name_ok(&claude));
    }

    #[test]
    fn same_suffix_plugins_do_not_share_a_named_pipe() {
        let notes = private_pipe_name("com.mossx.notes").expect("notes");
        let evil = private_pipe_name("com.evil.notes").expect("evil");
        assert_ne!(notes, evil);
        assert!(pipe_name_ok(&notes));
        assert!(pipe_name_ok(&evil));
    }

    #[test]
    fn illegal_pipe_name_is_schema() {
        for name in [r"\\.\pipe\other", "tcp:127.0.0.1:9", r"\\.\pipe\mossx-", ""] {
            assert_eq!(
                bind_named_pipe(name).unwrap_err().code,
                "schema",
                "{name}"
            );
        }
    }

    #[cfg(not(windows))]
    #[test]
    fn non_windows_cannot_bind_a_named_pipe() {
        assert_eq!(
            bind_named_pipe(r"\\.\pipe\mossx-notes").unwrap_err().code,
            "unsupported-platform"
        );
    }

    #[test]
    fn empty_allow_list_is_denied() {
        assert_eq!(
            pipe_acl_ok("S-1-5-21-1-2-3-1001", &[]).unwrap_err().code,
            "permission-denied"
        );
    }

    #[test]
    fn everyone_or_authenticated_users_are_denied() {
        for sid in ["S-1-1-0", "S-1-5-11"] {
            assert_eq!(
                pipe_acl_ok("S-1-5-21-1-2-3-1001", &[sid]).unwrap_err().code,
                "permission-denied",
                "{sid}"
            );
        }
    }

    #[test]
    fn current_user_only_is_accepted() {
        pipe_acl_ok("S-1-5-21-1-2-3-1001", &["S-1-5-21-1-2-3-1001"]).expect("acl");
    }

    #[test]
    fn current_user_sddl_is_compiled() {
        let sddl = compile_pipe_sddl("S-1-5-21-1-2-3-1001", &["S-1-5-21-1-2-3-1001"]).expect("sddl");
        assert!(sddl.contains("S-1-5-21-1-2-3-1001"));
        assert!(!sddl.contains("WD"));
        assert!(!sddl.contains("S-1-1-0"));
        assert!(sddl_ok(&sddl, "S-1-5-21-1-2-3-1001"));
    }

    #[test]
    fn everyone_cannot_compile_a_descriptor() {
        assert_eq!(
            compile_pipe_sddl("S-1-5-21-1-2-3-1001", &["S-1-1-0"])
                .unwrap_err()
                .code,
            "permission-denied"
        );
        assert_eq!(
            compile_pipe_sddl(
                "S-1-5-21-1-2-3-1001",
                &["S-1-5-21-1-2-3-1001", "S-1-5-21-9-9-9-9"]
            )
            .unwrap_err()
            .code,
            "permission-denied"
        );
    }

    #[test]
    fn bind_with_everyone_is_denied_before_listen() {
        assert_eq!(
            bind_named_pipe_secured(
                r"\\.\pipe\mossx-notes",
                "S-1-5-21-1-2-3-1001",
                &["S-1-1-0"]
            )
            .unwrap_err()
            .code,
            "permission-denied"
        );
    }

    #[cfg(windows)]
    #[test]
    fn hello_and_ack_round_trip_on_named_pipe() {
        use crate::plugin_runtime::ipc::{validate_handshake_ack, validate_handshake_hello};
        use crate::plugin_runtime::uds::{read_mxpc_frame, write_mxpc_frame};
        use serde_json::json;
        use std::thread;

        const NONCE: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        let name = format!(
            r"\\.\pipe\mossx-{}{}",
            std::process::id() % 10_000,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() % 10_000)
                .unwrap_or(0)
        );
        let server = bind_named_pipe(&name).expect("bind");
        let peer = thread::spawn({
            let name = name.clone();
            move || {
                let mut stream = server.accept().expect("accept");
                let received = read_mxpc_frame(&mut stream).expect("hello");
                validate_handshake_hello(&received, 1, NONCE).expect("hello");
                write_mxpc_frame(
                    &mut stream,
                    &json!({
                        "jsonrpc": "2.0",
                        "id": "hs-1",
                        "result": {
                            "protocolVersion": 1,
                            "pluginId": "com.mossx.notes",
                            "version": "1.0.0",
                            "generation": 1,
                            "nonce": NONCE
                        }
                    }),
                )
                .expect("ack");
                let _ = name;
            }
        });
        let mut client = windows_pipe::connect(&name).expect("connect");
        write_mxpc_frame(
            &mut client,
            &json!({
                "jsonrpc": "2.0",
                "id": "hs-1",
                "method": "mossx.handshake.hello",
                "params": {
                    "protocolVersion": 1,
                    "coreContract": "1.0.0",
                    "nonce": NONCE,
                    "generation": 1
                }
            }),
        )
        .expect("hello");
        let received = read_mxpc_frame(&mut client).expect("ack frame");
        validate_handshake_ack(&received, NONCE, "com.mossx.notes", 1, "1.0.0").expect("ack");
        peer.join().expect("server");
    }

    #[cfg(windows)]
    #[test]
    fn mismatched_nonce_is_rejected_after_named_pipe_read() {
        use crate::plugin_runtime::ipc::validate_handshake_ack;
        use crate::plugin_runtime::uds::{read_mxpc_frame, write_mxpc_frame};
        use serde_json::json;
        use std::thread;

        const NONCE: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        let name = format!(
            r"\\.\pipe\mossx-bad{}{}",
            std::process::id() % 10_000,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis() % 10_000)
                .unwrap_or(1)
        );
        let server = bind_named_pipe(&name).expect("bind");
        let peer = thread::spawn(move || {
            let mut stream = server.accept().expect("accept");
            let _ = read_mxpc_frame(&mut stream).expect("hello");
            write_mxpc_frame(
                &mut stream,
                &json!({
                    "jsonrpc": "2.0",
                    "id": "hs-1",
                    "result": {
                        "protocolVersion": 1,
                        "pluginId": "com.mossx.notes",
                        "version": "1.0.0",
                        "generation": 1,
                        "nonce": "b".repeat(64)
                    }
                }),
            )
            .expect("bad ack");
        });
        let mut client = windows_pipe::connect(&name).expect("connect");
        write_mxpc_frame(
            &mut client,
            &json!({
                "jsonrpc": "2.0",
                "id": "hs-1",
                "method": "mossx.handshake.hello",
                "params": {
                    "protocolVersion": 1,
                    "coreContract": "1.0.0",
                    "nonce": NONCE,
                    "generation": 1
                }
            }),
        )
        .expect("hello");
        let received = read_mxpc_frame(&mut client).expect("ack frame");
        assert!(validate_handshake_ack(&received, NONCE, "com.mossx.notes", 1, "1.0.0").is_err());
        peer.join().expect("server");
    }
}
