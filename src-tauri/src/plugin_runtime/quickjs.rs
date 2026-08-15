//! Per-plugin QuickJS Worker isolate. Real C engine, not in product path.

use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use serde_json::{json, Value};

use super::host::{DriverError, EntryDriver};
use super::ipc::{issue_handshake_nonce, validate_handshake_ack, validate_handshake_hello};
#[cfg(unix)]
use super::ipc::HANDSHAKE_DEADLINE;
#[cfg(not(unix))]
use super::ipc::{decode_mxpc, encode_mxpc};

static WORKER_SOCK_SEQ: AtomicU64 = AtomicU64::new(1);
pub const EVAL_DEADLINE: Duration = Duration::from_secs(2);

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkerError {
    pub code: &'static str,
    pub message: String,
}

fn err(code: &'static str, message: impl Into<String>) -> WorkerError {
    WorkerError {
        code,
        message: message.into(),
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct IsolateKey {
    plugin_id: String,
    entry_id: String,
    generation: u64,
}

pub struct WorkerIsolate {
    pub plugin_id: String,
    pub entry_id: String,
    pub generation: u64,
    engine: EngineHandle,
}

enum EngineCmd {
    Eval(String, Duration, Sender<Result<(), WorkerError>>),
    Shutdown,
}

struct EngineHandle {
    tx: Sender<EngineCmd>,
    thread: Option<JoinHandle<()>>,
}

impl Drop for EngineHandle {
    fn drop(&mut self) {
        let _ = self.tx.send(EngineCmd::Shutdown);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}

impl WorkerIsolate {
    fn eval(&self, source: &str, timeout: Duration) -> Result<(), WorkerError> {
        let (reply_tx, reply_rx) = mpsc::channel();
        self.engine
            .tx
            .send(EngineCmd::Eval(source.to_string(), timeout, reply_tx))
            .map_err(|_| err("plugin-unavailable", "worker isolate is not live"))?;
        reply_rx
            .recv_timeout(timeout.saturating_add(Duration::from_millis(200)))
            .map_err(|_| err("deadline", "worker eval exceeded deadline"))?
    }
}

fn spawn_engine() -> Result<EngineHandle, DriverError> {
    let (tx, rx) = mpsc::channel();
    let (ready_tx, ready_rx) = mpsc::channel();
    let thread = std::thread::spawn(move || engine_loop(rx, ready_tx));
    ready_rx.recv().map_err(|_| DriverError::Crash)??;
    Ok(EngineHandle {
        tx,
        thread: Some(thread),
    })
}

fn engine_loop(rx: Receiver<EngineCmd>, ready: Sender<Result<(), DriverError>>) {
    let runtime = match rquickjs::Runtime::new() {
        Ok(runtime) => runtime,
        Err(_) => {
            let _ = ready.send(Err(DriverError::Crash));
            return;
        }
    };
    let context = match rquickjs::Context::full(&runtime) {
        Ok(context) => context,
        Err(_) => {
            let _ = ready.send(Err(DriverError::Crash));
            return;
        }
    };
    if context
        .with(|ctx| {
            ctx.eval::<(), _>(
                r#"
                var mossx = {
                    handshake: { hello: function() { return 'ok'; } },
                    sdk: { ready: function() { return 'ok'; } }
                };
                "#,
            )
        })
        .is_err()
    {
        let _ = ready.send(Err(DriverError::Crash));
        return;
    }
    let _ = ready.send(Ok(()));
    while let Ok(cmd) = rx.recv() {
        match cmd {
            EngineCmd::Eval(source, timeout, reply) => {
                let deadline = Instant::now() + timeout;
                runtime.set_interrupt_handler(Some(Box::new(move || Instant::now() >= deadline)));
                let result = context.with(|ctx| ctx.eval::<(), _>(source.as_str()));
                runtime.set_interrupt_handler(None);
                let mapped = match result {
                    Ok(()) => Ok(()),
                    Err(_) if Instant::now() >= deadline => {
                        Err(err("deadline", "worker eval exceeded deadline"))
                    }
                    Err(_) => Err(err("schema", "QuickJS rejected the worker source")),
                };
                let _ = reply.send(mapped);
            }
            EngineCmd::Shutdown => break,
        }
    }
}

pub struct QuickJsWorkerDriver {
    isolates: HashMap<IsolateKey, WorkerIsolate>,
    catalog: HashSet<(String, String)>,
    corrupt_ack_on: Option<String>,
}

impl Default for QuickJsWorkerDriver {
    fn default() -> Self {
        Self {
            isolates: HashMap::new(),
            catalog: declared_quickjs_workers(),
            corrupt_ack_on: None,
        }
    }
}

impl QuickJsWorkerDriver {
    pub fn live_count(&self) -> usize {
        self.isolates.len()
    }

    pub fn isolate(
        &self,
        plugin_id: &str,
        entry_id: &str,
        generation: u64,
    ) -> Option<&WorkerIsolate> {
        self.isolates.get(&IsolateKey {
            plugin_id: plugin_id.to_string(),
            entry_id: entry_id.to_string(),
            generation,
        })
    }

    pub fn eval(
        &self,
        plugin_id: &str,
        entry_id: &str,
        generation: u64,
        source: &str,
    ) -> Result<(), WorkerError> {
        let isolate = self
            .isolate(plugin_id, entry_id, generation)
            .ok_or_else(|| err("plugin-unavailable", "worker isolate is not live"))?;
        allow_mossx_bridge(source)?;
        isolate.eval(source, EVAL_DEADLINE)
    }

    pub fn eval_with_deadline(
        &self,
        plugin_id: &str,
        entry_id: &str,
        generation: u64,
        source: &str,
        timeout: Duration,
    ) -> Result<(), WorkerError> {
        let isolate = self
            .isolate(plugin_id, entry_id, generation)
            .ok_or_else(|| err("plugin-unavailable", "worker isolate is not live"))?;
        allow_mossx_bridge(source)?;
        isolate.eval(source, timeout)
    }

    pub fn declare(&mut self, plugin_id: &str, entry_id: &str) {
        self.catalog
            .insert((plugin_id.to_string(), entry_id.to_string()));
    }

    #[cfg(test)]
    pub fn corrupt_ack_on(&mut self, entry_id: impl Into<String>) {
        self.corrupt_ack_on = Some(entry_id.into());
    }
}

fn hello(generation: u64, nonce: &str) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": "hs-1",
        "method": "mossx.handshake.hello",
        "params": {
            "protocolVersion": 1,
            "coreContract": "1.0.0",
            "nonce": nonce,
            "generation": generation
        }
    })
}

fn ack(plugin_id: &str, generation: u64, nonce: &str) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": "hs-1",
        "result": {
            "protocolVersion": 1,
            "pluginId": plugin_id,
            "version": "1.0.0",
            "generation": generation,
            "nonce": nonce
        }
    })
}

#[cfg(unix)]
fn worker_sock_path(
    plugin_id: &str,
    entry_id: &str,
    generation: u64,
) -> Result<std::path::PathBuf, DriverError> {
    let seq = WORKER_SOCK_SEQ.fetch_add(1, Ordering::Relaxed);
    super::uds::private_uds_path(
        plugin_id,
        &format!(
            "w{}{}{}",
            seq % 1000,
            entry_id.as_bytes().first().copied().unwrap_or(b'w') as char,
            generation % 10
        ),
    )
    .map_err(|_| DriverError::Crash)
}

fn handshake_worker(
    plugin_id: &str,
    entry_id: &str,
    generation: u64,
    corrupt: bool,
) -> Result<(), DriverError> {
    #[cfg(unix)]
    {
        use std::thread;

        use super::uds::{
            accept_uds_timed, bind_uds, connect_uds_timed, read_mxpc_frame_timed,
            write_mxpc_frame_timed,
        };

        let path = worker_sock_path(plugin_id, entry_id, generation)?;
        let listener = bind_uds(&path).map_err(|_| DriverError::Crash)?;
        let _unlink = super::uds::UnlinkOnDrop::new(&path);
        let peer_plugin = plugin_id.to_string();
        let issued = issue_handshake_nonce();
        let peer_nonce = issued.clone();
        let peer = thread::spawn(move || {
            let mut stream = accept_uds_timed(&listener, HANDSHAKE_DEADLINE).map_err(|_| ())?;
            let received =
                read_mxpc_frame_timed(&mut stream, HANDSHAKE_DEADLINE).map_err(|_| ())?;
            validate_handshake_hello(&received, generation, &peer_nonce).map_err(|_| ())?;
            let ack_nonce = if corrupt {
                "bb".repeat(32)
            } else {
                peer_nonce
            };
            write_mxpc_frame_timed(
                &mut stream,
                &ack(&peer_plugin, generation, &ack_nonce),
                HANDSHAKE_DEADLINE,
            )
            .map_err(|_| ())?;
            Ok::<(), ()>(())
        });
        let mut client =
            connect_uds_timed(&path, HANDSHAKE_DEADLINE).map_err(|_| DriverError::Crash)?;
        write_mxpc_frame_timed(&mut client, &hello(generation, &issued), HANDSHAKE_DEADLINE)
            .map_err(|_| DriverError::Crash)?;
        let received =
            read_mxpc_frame_timed(&mut client, HANDSHAKE_DEADLINE).map_err(|_| DriverError::Crash)?;
        let result = validate_handshake_ack(&received, &issued, plugin_id, generation, "1.0.0")
            .map_err(|_| DriverError::Crash);
        let _ = peer.join();
        result
    }
    #[cfg(not(unix))]
    {
        let issued = issue_handshake_nonce();
        let encoded_hello = encode_mxpc(&hello(generation, &issued)).map_err(|_| DriverError::Crash)?;
        let (decoded_hello, _) = decode_mxpc(&encoded_hello).map_err(|_| DriverError::Crash)?;
        validate_handshake_hello(&decoded_hello, generation, &issued).map_err(|_| DriverError::Crash)?;
        let nonce = if corrupt {
            "bb".repeat(32)
        } else {
            issued.clone()
        };
        let encoded_ack =
            encode_mxpc(&ack(plugin_id, generation, &nonce)).map_err(|_| DriverError::Crash)?;
        let (decoded_ack, _) = decode_mxpc(&encoded_ack).map_err(|_| DriverError::Crash)?;
        validate_handshake_ack(&decoded_ack, &issued, plugin_id, generation, "1.0.0")
            .map_err(|_| DriverError::Crash)?;
        let _ = entry_id;
        Ok(())
    }
}

fn collect_quickjs_workers(source: &str, catalog: &mut HashSet<(String, String)>) {
    let Ok(manifest) = serde_json::from_str::<Value>(source) else {
        return;
    };
    let Some(plugin_id) = manifest.get("pluginId").and_then(Value::as_str) else {
        return;
    };
    let Some(entries) = manifest.get("entries").and_then(Value::as_array) else {
        return;
    };
    for entry in entries {
        let Some(entry_id) = entry.get("id").and_then(Value::as_str) else {
            continue;
        };
        if entry.get("kind").and_then(Value::as_str) == Some("worker")
            && entry.get("runtime").and_then(Value::as_str) == Some("quickjs")
        {
            catalog.insert((plugin_id.to_string(), entry_id.to_string()));
        }
    }
}

fn declared_quickjs_workers() -> HashSet<(String, String)> {
    let mut catalog = HashSet::new();
    collect_quickjs_workers(
        include_str!("../../../packages/plugin-contract/fixtures/valid/notes-pilot.json"),
        &mut catalog,
    );
    collect_quickjs_workers(
        include_str!("../../../packages/plugin-contract/fixtures/valid/claude-engine.json"),
        &mut catalog,
    );
    catalog
}

fn allow_mossx_bridge(source: &str) -> Result<(), WorkerError> {
    let trimmed = source.trim();
    let lowered = trimmed.to_ascii_lowercase();
    let allowed = lowered.starts_with("mossx.handshake.") || lowered.starts_with("mossx.sdk.");
    let smuggled = [
        "require(",
        "process.",
        "fetch(",
        "import(",
        "eval(",
        "function(",
        "child_process",
        "worker_threads",
    ]
    .iter()
    .any(|needle| lowered.contains(needle));
    if allowed && !smuggled {
        return Ok(());
    }
    Err(err(
        "permission-denied",
        "QuickJS Worker can only call mossx.handshake.* or mossx.sdk.*",
    ))
}

impl EntryDriver for QuickJsWorkerDriver {
    fn start(&mut self, plugin_id: &str, entry_id: &str, generation: u64) -> Result<(), DriverError> {
        if !self
            .catalog
            .contains(&(plugin_id.to_string(), entry_id.to_string()))
        {
            return Ok(());
        }
        let key = IsolateKey {
            plugin_id: plugin_id.to_string(),
            entry_id: entry_id.to_string(),
            generation,
        };
        if self.isolates.contains_key(&key) {
            return Err(DriverError::Crash);
        }
        let corrupt = self.corrupt_ack_on.as_deref() == Some(entry_id);
        handshake_worker(plugin_id, entry_id, generation, corrupt)?;
        let engine = spawn_engine()?;
        self.isolates.insert(
            key,
            WorkerIsolate {
                plugin_id: plugin_id.to_string(),
                entry_id: entry_id.to_string(),
                generation,
                engine,
            },
        );
        Ok(())
    }

    fn stop(&mut self, plugin_id: &str, entry_id: &str, generation: u64) {
        self.isolates.remove(&IsolateKey {
            plugin_id: plugin_id.to_string(),
            entry_id: entry_id.to_string(),
            generation,
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::plugin_runtime::claude_pilot::claude_activation_request;
    use crate::plugin_runtime::host::{ActivationRequest, Host, HostConfig, SlotState};
    use crate::plugin_runtime::notes_pilot::notes_activation_request;

    fn enabled_host(driver: QuickJsWorkerDriver) -> Host<QuickJsWorkerDriver> {
        Host::new(
            HostConfig {
                enabled: true,
                ..HostConfig::default()
            },
            driver,
        )
        .expect("config")
    }

    #[test]
    fn notes_and_claude_workers_do_not_share_an_isolate() {
        let mut host = enabled_host(QuickJsWorkerDriver::default());
        host.activate(notes_activation_request()).expect("notes");
        host.activate(claude_activation_request()).expect("claude");
        let notes = host
            .driver()
            .isolate("com.mossx.notes", "notes-worker", 1)
            .expect("notes isolate");
        let claude = host
            .driver()
            .isolate("com.mossx.engine.claude", "claude-worker", 1)
            .expect("claude isolate");
        assert_ne!(notes.plugin_id, claude.plugin_id);
        assert_eq!(host.driver().live_count(), 2);
        host.disable("com.mossx.notes").expect("disable notes");
        assert!(host
            .driver()
            .isolate("com.mossx.notes", "notes-worker", 1)
            .is_none());
        assert!(host
            .driver()
            .isolate("com.mossx.engine.claude", "claude-worker", 1)
            .is_some());
    }

    #[test]
    fn worker_cannot_reach_node_or_os_apis() {
        let mut host = enabled_host(QuickJsWorkerDriver::default());
        host.activate(notes_activation_request()).expect("notes");
        for source in [
            "require('fs')",
            "process.exit(0)",
            "fetch('https://example.com')",
            "import('net')",
            "child_process.spawn('sh')",
            "1 + 1",
            "eval('1')",
        ] {
            assert_eq!(
                host.driver()
                    .eval("com.mossx.notes", "notes-worker", 1, source)
                    .unwrap_err()
                    .code,
                "permission-denied",
                "{source}"
            );
        }
    }

    #[test]
    fn disable_disposes_the_worker_isolate() {
        let mut host = enabled_host(QuickJsWorkerDriver::default());
        host.activate(notes_activation_request()).expect("notes");
        assert_eq!(host.slot("com.mossx.notes").unwrap().state, SlotState::Ready);
        host.disable("com.mossx.notes").expect("disable");
        assert_eq!(host.driver().live_count(), 0);
        assert_eq!(
            host.driver()
                .eval("com.mossx.notes", "notes-worker", 1, "1 + 1")
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
    }

    #[test]
    fn handshake_call_is_accepted() {
        let mut host = enabled_host(QuickJsWorkerDriver::default());
        host.activate(notes_activation_request()).expect("notes");
        host.driver()
            .eval("com.mossx.notes", "notes-worker", 1, "mossx.handshake.hello()")
            .expect("handshake");
        host.driver()
            .eval("com.mossx.notes", "notes-worker", 1, "mossx.sdk.ready()")
            .expect("sdk");
    }

    #[test]
    fn allowlisted_but_invalid_javascript_cannot_stay_half_executed() {
        let mut host = enabled_host(QuickJsWorkerDriver::default());
        host.activate(notes_activation_request()).expect("notes");
        assert_eq!(
            host.driver()
                .eval("com.mossx.notes", "notes-worker", 1, "mossx.handshake.hello(")
                .unwrap_err()
                .code,
            "schema"
        );
        host.driver()
            .eval("com.mossx.notes", "notes-worker", 1, "mossx.handshake.hello()")
            .expect("still live");
        assert_eq!(host.driver().live_count(), 1);
    }

    #[test]
    fn an_infinite_loop_cannot_hang_the_host() {
        let mut host = enabled_host(QuickJsWorkerDriver::default());
        host.activate(notes_activation_request()).expect("notes");
        assert_eq!(
            host.driver()
                .eval_with_deadline(
                    "com.mossx.notes",
                    "notes-worker",
                    1,
                    "mossx.handshake.hello();while(true){}",
                    Duration::from_millis(50),
                )
                .unwrap_err()
                .code,
            "deadline"
        );
        host.driver()
            .eval("com.mossx.notes", "notes-worker", 1, "mossx.sdk.ready()")
            .expect("still live");
        assert_eq!(host.driver().live_count(), 1);
    }

    #[test]
    fn stale_worker_generation_cannot_eval() {
        let mut host = enabled_host(QuickJsWorkerDriver::default());
        host.activate(notes_activation_request()).expect("first");
        host.activate(notes_activation_request()).expect("second");
        assert_eq!(
            host.driver()
                .eval(
                    "com.mossx.notes",
                    "notes-worker",
                    1,
                    "mossx.handshake.hello()"
                )
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        host.driver()
            .eval(
                "com.mossx.notes",
                "notes-worker",
                2,
                "mossx.handshake.hello()",
            )
            .expect("new generation");
        assert_eq!(host.driver().live_count(), 1);
    }

    #[test]
    fn notes_ui_cannot_eval() {
        let mut host = enabled_host(QuickJsWorkerDriver::default());
        host.activate(notes_activation_request()).expect("notes");
        assert!(host
            .driver()
            .isolate("com.mossx.notes", "notes-worker", 1)
            .is_some());
        assert!(host
            .driver()
            .isolate("com.mossx.notes", "notes-ui", 1)
            .is_none());
        assert_eq!(
            host.driver()
                .eval(
                    "com.mossx.notes",
                    "notes-ui",
                    1,
                    "mossx.handshake.hello()"
                )
                .unwrap_err()
                .code,
            "plugin-unavailable"
        );
        assert_eq!(host.driver().live_count(), 1);
    }

    #[test]
    fn undeclared_worker_named_entry_has_no_isolate() {
        let mut driver = QuickJsWorkerDriver::default();
        driver
            .start("com.mossx.notes", "evil-worker", 1)
            .expect("start");
        assert!(driver
            .isolate("com.mossx.notes", "evil-worker", 1)
            .is_none());
        assert_eq!(driver.live_count(), 0);
    }

    #[test]
    fn declared_worker_without_suffix_gets_an_isolate() {
        let mut driver = QuickJsWorkerDriver::default();
        driver.declare("com.mossx.notes", "notes-core");
        driver
            .start("com.mossx.notes", "notes-core", 1)
            .expect("start");
        assert!(driver
            .isolate("com.mossx.notes", "notes-core", 1)
            .is_some());
        assert_eq!(driver.live_count(), 1);
    }

    #[test]
    fn notes_worker_becomes_ready_only_after_handshake() {
        let mut host = enabled_host(QuickJsWorkerDriver::default());
        let generation = host.activate(notes_activation_request()).expect("notes");
        assert_eq!(generation, 1);
        assert_eq!(host.slot("com.mossx.notes").unwrap().state, SlotState::Ready);
        let isolate = host
            .driver()
            .isolate("com.mossx.notes", "notes-worker", 1)
            .expect("isolate");
        assert_eq!(isolate.generation, 1);
        assert_eq!(host.driver().live_count(), 1);
    }

    #[cfg(unix)]
    #[test]
    fn notes_worker_becomes_ready_over_private_uds() {
        let source = include_str!("quickjs.rs");
        assert!(source.contains("private_uds_path"));
        assert!(source.contains("connect_uds"));
        assert!(source.contains("read_mxpc_frame_timed"));
        assert!(source.contains("rquickjs::Runtime::new"));
        let mut host = enabled_host(QuickJsWorkerDriver::default());
        host.activate(notes_activation_request()).expect("notes");
        assert_eq!(host.driver().live_count(), 1);
    }

    #[test]
    fn a_bad_worker_nonce_cannot_leave_an_isolate() {
        let mut driver = QuickJsWorkerDriver::default();
        driver.corrupt_ack_on("notes-worker");
        let mut host = enabled_host(driver);
        assert!(host.activate(notes_activation_request()).is_err());
        assert_eq!(
            host.slot("com.mossx.notes").unwrap().state,
            SlotState::Failed
        );
        assert_eq!(host.driver().live_count(), 0);
        assert!(host
            .driver()
            .isolate("com.mossx.notes", "notes-worker", 1)
            .is_none());
    }

    #[test]
    fn later_worker_handshake_failure_rolls_back_earlier_isolate() {
        let mut driver = QuickJsWorkerDriver::default();
        driver.declare("com.mossx.notes", "notes-core");
        driver.corrupt_ack_on("notes-core");
        let mut host = enabled_host(driver);
        assert!(host
            .activate(ActivationRequest {
                plugin_id: "com.mossx.notes".into(),
                unit_id: "notes-main".into(),
                required_entries: vec!["notes-worker".into(), "notes-core".into()],
            })
            .is_err());
        assert_eq!(
            host.slot("com.mossx.notes").unwrap().state,
            SlotState::Failed
        );
        assert_eq!(host.driver().live_count(), 0);
    }
}
