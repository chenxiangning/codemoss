//! Host supervisor process. Rejects unexpected MXPC peers with host-disabled.
//! Not the in-process BootHost and not a product plugin activator.

use std::io::Write;
use std::os::unix::net::UnixListener;
use std::path::Path;
use std::time::Duration;

const MXPC_MAGIC: u32 = 0x4D58_5043;
const DISABLED: &str = r#"{"jsonrpc":"2.0","id":null,"error":{"code":-32000,"message":"host-disabled"}}"#;

fn write_frame(stream: &mut impl Write, body: &str) {
    let mut frame = vec![0_u8; 10 + body.len()];
    frame[0..4].copy_from_slice(&MXPC_MAGIC.to_be_bytes());
    frame[4] = 1;
    frame[5] = 0;
    frame[6..10].copy_from_slice(&(body.len() as u32).to_le_bytes());
    frame[10..].copy_from_slice(body.as_bytes());
    let _ = stream.write_all(&frame);
    let _ = stream.flush();
}

fn listen(path: &Path) -> std::io::Result<UnixListener> {
    let _ = std::fs::remove_file(path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let _ = std::fs::set_permissions(parent, std::fs::Permissions::from_mode(0o700));
        }
    }
    let listener = UnixListener::bind(path)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600));
    }
    listener.set_nonblocking(true)?;
    Ok(listener)
}

fn main() {
    let path = std::env::args().nth(1).expect("uds path");
    let listener = listen(Path::new(&path)).expect("bind");
    loop {
        match listener.accept() {
            Ok((mut stream, _)) => write_frame(&mut stream, DISABLED),
            Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(20));
            }
            Err(_) => std::thread::sleep(Duration::from_millis(50)),
        }
    }
}
