use std::collections::VecDeque;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::{Duration, Instant};

use serde_json::Value;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, ChildStdout, Command};

use super::omp_env::OmpEnvironmentSpec;
use super::omp_protocol::OmpFrameDecoder;
use super::omp_release::OMP_METRICS;
use super::omp_rpc::{OmpRpcClient, OmpRpcRestartReason};

const OMP_RPC_TIMEOUT: Duration = Duration::from_secs(30);

pub(crate) struct OmpRpcProcess {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
    client: OmpRpcClient,
    control_events: VecDeque<Value>,
    workspace_root: PathBuf,
}

impl OmpRpcProcess {
    /// environment assembly 边界：与 ACP spawn 同一 OmpEnvironmentSpec
    /// 显式组装语义（见 omp_process.rs）。
    pub(crate) async fn spawn(
        binary: Option<&Path>,
        workspace_root: &Path,
        environment: Option<&OmpEnvironmentSpec>,
    ) -> Result<Self, String> {
        let executable = binary
            .map(Path::to_path_buf)
            .unwrap_or_else(|| PathBuf::from("omp"));
        let assembled = environment
            .cloned()
            .unwrap_or_else(OmpEnvironmentSpec::default_inherit)
            .assemble_from_current_process();
        let spawn_started = Instant::now();
        let mut command = Command::new(&executable);
        command
            .args([
                "--mode",
                "rpc",
                "--no-session",
                "--no-extensions",
                "--no-skills",
                "--no-rules",
            ])
            .current_dir(workspace_root)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .kill_on_drop(true);
        assembled.apply(&mut command);
        let mut child = command
            .spawn()
            .map_err(|error| format!("failed to spawn omp rpc: {error}"))?;
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "omp rpc stdin was not piped".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "omp rpc stdout was not piped".to_string())?;
        // Startup metric：进程 spawn + 管道就绪即启动落点。
        OMP_METRICS.record_startup(spawn_started.elapsed());
        Ok(Self {
            child,
            stdin,
            stdout: BufReader::new(stdout),
            client: OmpRpcClient::new(),
            control_events: VecDeque::new(),
            workspace_root: workspace_root.to_path_buf(),
        })
    }

    pub(crate) async fn read_ready(&mut self) -> Result<(), String> {
        let frame = self.read_frame(OMP_RPC_TIMEOUT).await?;
        if self.client.apply_ready(&frame) {
            Ok(())
        } else {
            self.client.stop();
            Err(format!("invalid omp rpc ready frame: {frame}"))
        }
    }

    pub(crate) async fn request(&mut self, command: &str) -> Result<Value, String> {
        let (id, payload) = self
            .client
            .request(command)
            .ok_or_else(|| "omp rpc client is not ready or request ids exhausted".to_string())?;
        let mut encoded = serde_json::to_vec(&payload).map_err(|error| error.to_string())?;
        encoded.push(b'\n');
        self.stdin
            .write_all(&encoded)
            .await
            .map_err(|error| format!("failed to write omp rpc request: {error}"))?;
        self.stdin
            .flush()
            .await
            .map_err(|error| format!("failed to flush omp rpc request: {error}"))?;
        let deadline = Instant::now() + OMP_RPC_TIMEOUT;
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                // 超时视同 transport 失败：pending 全部 typed 结算并停止，
                // 由上层决定是否显式 restart。
                let _ = self
                    .client
                    .handle_transport_failure(OmpRpcRestartReason::Timeout);
                return Err("omp rpc request timed out".to_string());
            }
            let frame = match self.read_frame(remaining).await {
                Ok(frame) => frame,
                Err(error) => {
                    if error.contains("exited before returning a frame") {
                        // 进程退出/EOF：全部 pending 以 typed error 结算（不悬挂），
                        // 等待显式 restart（重新 ready handshake + version negotiation）。
                        let _ = self
                            .client
                            .handle_transport_failure(OmpRpcRestartReason::ProcessEof);
                    } else if error.contains("failed to read") {
                        let _ = self
                            .client
                            .handle_transport_failure(OmpRpcRestartReason::TransportRead);
                    } else {
                        self.client.reject_request(&id);
                    }
                    return Err(error);
                }
            };
            if frame.get("id").and_then(Value::as_str) == Some(id.as_str()) {
                let resolved = self.client.resolve_response(&frame);
                if resolved.as_deref() != Some(id.as_str()) {
                    self.client.reject_request(&id);
                    return Err(format!("omp rpc response correlation mismatch: {frame}"));
                }
                if frame.get("success") == Some(&Value::Bool(false)) {
                    return Err(format!("omp rpc command failed: {frame}"));
                }
                return Ok(frame);
            }
            if frame.get("id").is_some()
                && (frame.get("type").and_then(Value::as_str) == Some("response")
                    || frame.get("success").is_some())
            {
                self.client.reject_request(&id);
                return Err(format!("omp rpc response correlation mismatch: {frame}"));
            }
            self.control_events.push_back(frame);
        }
    }

    async fn read_frame(&mut self, timeout_duration: Duration) -> Result<Value, String> {
        let deadline = Instant::now() + timeout_duration;
        let max_frame_bytes = self
            .client
            .ready()
            .map(|ready| ready.max_frame_bytes)
            .unwrap_or(1_048_576);
        let mut bytes = Vec::new();
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Err("omp rpc frame read timed out".to_string());
            }
            let chunk = tokio::time::timeout(remaining, self.stdout.fill_buf())
                .await
                .map_err(|_| "omp rpc frame read timed out".to_string())?
                .map_err(|error| format!("failed to read omp rpc frame: {error}"))?;
            if chunk.is_empty() {
                return Err("omp rpc exited before returning a frame".to_string());
            }
            let newline = chunk.iter().position(|byte| *byte == b'\n');
            let consumed = newline.map_or(chunk.len(), |index| index + 1);
            bytes.extend_from_slice(&chunk[..consumed]);
            self.stdout.consume(consumed);
            if bytes.len() > max_frame_bytes.saturating_add(2) {
                return Err("omp rpc frame exceeds negotiated limit".to_string());
            }
            if newline.is_some() {
                break;
            }
        }
        let mut decoder = OmpFrameDecoder::new(max_frame_bytes);
        decoder
            .push(&bytes)
            .map_err(|error| format!("invalid omp rpc frame: {error}"))?
            .into_iter()
            .next()
            .ok_or_else(|| "omp rpc line contained no frame".to_string())
    }
    /// Return control-plane notifications observed while servicing requests.
    pub(crate) fn take_control_events(&mut self) -> Vec<Value> {
        self.control_events.drain(..).collect()
    }

    pub(crate) fn is_stopped(&self) -> bool {
        self.client.state() == super::omp_rpc::OmpRpcState::Stopped
    }

    /// restart 可观测面：次数与最近原因（进程级 restart 由 manager 移除
    /// stopped runtime 后显式重 spawn 完成，新进程重新 handshake）。
    pub(crate) fn restart_count(&self) -> u64 {
        self.client.restart_count()
    }

    pub(crate) fn last_restart_reason(&self) -> Option<OmpRpcRestartReason> {
        self.client.last_restart_reason()
    }

    pub(crate) fn workspace_root(&self) -> &Path {
        &self.workspace_root
    }

    pub(crate) async fn shutdown(mut self) -> Result<(), String> {
        self.stdin
            .shutdown()
            .await
            .map_err(|error| format!("failed to close omp rpc stdin: {error}"))?;
        let _ = self.child.start_kill();
        tokio::time::timeout(Duration::from_secs(2), self.child.wait())
            .await
            .map_err(|_| "timed out waiting for omp rpc to stop".to_string())?
            .map_err(|error| format!("failed to reap omp rpc: {error}"))?;
        Ok(())
    }
}

impl Drop for OmpRpcProcess {
    fn drop(&mut self) {
        let _ = self.child.start_kill();
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;
    use super::*;

    #[test]
    fn rpc_command_payload_matches_native_contract() {
        assert_eq!(
            json!({ "id": "1", "type": "get_state" })["type"],
            "get_state"
        );
    }
}
