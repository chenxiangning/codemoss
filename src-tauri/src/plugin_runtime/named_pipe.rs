//! Windows Named Pipe MXPC transport. No TCP, not in boot.

use super::ipc::IpcError;

fn err(code: &'static str, message: impl Into<String>) -> IpcError {
    IpcError {
        code,
        message: message.into(),
    }
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

#[cfg(windows)]
pub fn bind_named_pipe(name: &str) -> Result<windows_pipe::NamedPipeServer, IpcError> {
    if !pipe_name_ok(name) {
        return Err(err("schema", "named pipe must be \\\\.\\pipe\\mossx-*"));
    }
    windows_pipe::bind(name)
}

#[cfg(windows)]
pub fn connect_named_pipe(name: &str) -> Result<std::fs::File, IpcError> {
    if !pipe_name_ok(name) {
        return Err(err("schema", "named pipe must be \\\\.\\pipe\\mossx-*"));
    }
    windows_pipe::connect(name)
}

#[cfg(not(windows))]
pub fn bind_named_pipe(_name: &str) -> Result<(), IpcError> {
    if !pipe_name_ok(_name) {
        return Err(err("schema", "named pipe must be \\\\.\\pipe\\mossx-*"));
    }
    Err(err(
        "unsupported-platform",
        "Named Pipe transport is windows-only in V1",
    ))
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

    pub fn bind(name: &str) -> Result<NamedPipeServer, IpcError> {
        let wide_name = wide(name);
        let handle = unsafe {
            CreateNamedPipeW(
                wide_name.as_ptr(),
                PIPE_ACCESS_DUPLEX | FILE_FLAG_FIRST_PIPE_INSTANCE,
                PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT,
                1,
                65_536,
                65_536,
                0,
                null_mut(),
            )
        };
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
                validate_handshake_hello(&received).expect("hello");
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
        validate_handshake_ack(&received, NONCE).expect("ack");
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
        assert!(validate_handshake_ack(&received, NONCE).is_err());
        peer.join().expect("server");
    }
}
