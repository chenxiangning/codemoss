//! Coding Plan / Token Plan 额度查询（对齐 CC Switch coding_plan 服务）。
//!
//! 按供应商 base_url 识别套餐域，用对应 API Key 查询 5h / 周窗口用量。
//! 当前内建：Kimi For Coding、MiniMax、智谱 GLM。

use serde::Serialize;
use serde_json::Value;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

const HTTP_TIMEOUT: Duration = Duration::from_secs(15);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CodingPlanProvider {
    Kimi,
    ZhipuCn,
    ZhipuEn,
    MiniMaxCn,
    MiniMaxEn,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CodingPlanQuotaWindow {
    pub(crate) id: String,
    pub(crate) used_percent: f64,
    pub(crate) remaining_percent: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) resets_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CodingPlanQuotaSnapshot {
    /// kimi | minimax | zhipu | official_cli | unsupported | empty_credentials | error | none
    pub(crate) source: String,
    /// api | cli | official_runtime — 便于 UI/调试看走了哪条路径
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) via: Option<String>,
    pub(crate) success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) plan_label: Option<String>,
    pub(crate) windows: Vec<CodingPlanQuotaWindow>,
    pub(crate) queried_at: i64,
}

/// 额度路由：官方 runtime/CLI vs 供应商 Coding Plan API。
#[derive(Debug, Clone)]
enum QuotaRoute {
    /// Codex 官方 / Claude 官方等：前端用 account rateLimits 或空块
    OfficialRuntime { source: &'static str },
    /// 已知 Coding Plan 供应商：用 base_url + key 查 HTTP
    CodingPlanApi { base_url: String, api_key: String },
    /// 无额度可查（官方无 plan / 缺凭据）
    None { reason: String },
}

fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn millis_to_iso8601(ms: i64) -> Option<String> {
    if ms <= 0 {
        return None;
    }
    let secs = ms / 1000;
    let nsecs = ((ms % 1000) * 1_000_000) as u32;
    chrono::DateTime::from_timestamp(secs, nsecs).map(|dt| dt.to_rfc3339())
}

fn extract_reset_time(value: &Value) -> Option<String> {
    if let Some(s) = value.as_str() {
        return Some(s.to_string());
    }
    if let Some(n) = value.as_i64() {
        if n <= 0 {
            return None;
        }
        let ms = if n < 1_000_000_000_000 { n * 1000 } else { n };
        return millis_to_iso8601(ms);
    }
    None
}

fn parse_f64(value: &Value) -> Option<f64> {
    value
        .as_f64()
        .or_else(|| value.as_str().and_then(|s| s.parse().ok()))
}

fn clamp_percent(value: f64) -> f64 {
    if !value.is_finite() {
        return 0.0;
    }
    value.clamp(0.0, 100.0)
}

fn window_from_used(
    id: &str,
    used_percent: f64,
    resets_at: Option<String>,
) -> CodingPlanQuotaWindow {
    let used = clamp_percent(used_percent);
    CodingPlanQuotaWindow {
        id: id.to_string(),
        used_percent: used,
        remaining_percent: clamp_percent(100.0 - used),
        resets_at,
    }
}

fn detect_provider(base_url: &str) -> Option<CodingPlanProvider> {
    let url = base_url.to_lowercase();
    if url.contains("api.kimi.com/coding") {
        Some(CodingPlanProvider::Kimi)
    } else if url.contains("open.bigmodel.cn") || url.contains("bigmodel.cn") {
        Some(CodingPlanProvider::ZhipuCn)
    } else if url.contains("api.z.ai") {
        Some(CodingPlanProvider::ZhipuEn)
    } else if url.contains("api.minimaxi.com") {
        Some(CodingPlanProvider::MiniMaxCn)
    } else if url.contains("api.minimax.io") {
        Some(CodingPlanProvider::MiniMaxEn)
    } else {
        None
    }
}

fn source_name(provider: CodingPlanProvider) -> &'static str {
    match provider {
        CodingPlanProvider::Kimi => "kimi",
        CodingPlanProvider::ZhipuCn | CodingPlanProvider::ZhipuEn => "zhipu",
        CodingPlanProvider::MiniMaxCn | CodingPlanProvider::MiniMaxEn => "minimax",
    }
}

fn empty_snapshot(source: &str, error: Option<String>) -> CodingPlanQuotaSnapshot {
    CodingPlanQuotaSnapshot {
        source: source.to_string(),
        via: None,
        success: false,
        error,
        plan_label: None,
        windows: vec![],
        queried_at: now_millis(),
    }
}

fn success_snapshot(
    source: &str,
    via: &str,
    windows: Vec<CodingPlanQuotaWindow>,
    plan_label: Option<String>,
) -> CodingPlanQuotaSnapshot {
    CodingPlanQuotaSnapshot {
        source: source.to_string(),
        via: Some(via.to_string()),
        success: true,
        error: None,
        plan_label,
        windows,
        queried_at: now_millis(),
    }
}

fn is_official_anthropic_base(base_url: &str) -> bool {
    let url = base_url.trim().to_ascii_lowercase();
    url.is_empty() || url.contains("api.anthropic.com") || url.contains("anthropic.com/claude")
}

fn is_official_openai_base(base_url: &str) -> bool {
    let url = base_url.trim().to_ascii_lowercase();
    url.is_empty()
        || url.contains("api.openai.com")
        || url.contains("chatgpt.com")
        || url.contains("openai.com/v1")
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(HTTP_TIMEOUT)
        .build()
        .map_err(|error| format!("http client: {error}"))
}

async fn query_kimi(api_key: &str) -> CodingPlanQuotaSnapshot {
    let client = match http_client() {
        Ok(c) => c,
        Err(error) => return empty_snapshot("kimi", Some(error)),
    };
    let resp = match client
        .get("https://api.kimi.com/coding/v1/usages")
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Accept", "application/json")
        .send()
        .await
    {
        Ok(r) => r,
        Err(error) => {
            return empty_snapshot("kimi", Some(format!("Network error: {error}")));
        }
    };
    let status = resp.status();
    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        return empty_snapshot(
            "kimi",
            Some(format!("Authentication failed (HTTP {status})")),
        );
    }
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return empty_snapshot("kimi", Some(format!("API error (HTTP {status}): {body}")));
    }
    let raw = match resp.bytes().await {
        Ok(b) => b,
        Err(error) => {
            return empty_snapshot("kimi", Some(format!("Failed to read response: {error}")));
        }
    };
    let body: Value = match serde_json::from_slice(&raw) {
        Ok(v) => v,
        Err(error) => {
            return empty_snapshot("kimi", Some(format!("Failed to parse response: {error}")));
        }
    };

    let mut windows = Vec::new();
    if let Some(limits) = body.get("limits").and_then(|v| v.as_array()) {
        for limit_item in limits {
            if let Some(detail) = limit_item.get("detail") {
                let limit = detail.get("limit").and_then(parse_f64).unwrap_or(1.0);
                let remaining = detail.get("remaining").and_then(parse_f64).unwrap_or(0.0);
                let resets_at = detail.get("resetTime").and_then(extract_reset_time);
                let used = (limit - remaining).max(0.0);
                let used_percent = if limit > 0.0 {
                    (used / limit) * 100.0
                } else {
                    0.0
                };
                windows.push(window_from_used("five_hour", used_percent, resets_at));
                break;
            }
        }
    }
    if let Some(usage) = body.get("usage") {
        let limit = usage.get("limit").and_then(parse_f64).unwrap_or(1.0);
        let remaining = usage.get("remaining").and_then(parse_f64).unwrap_or(0.0);
        let resets_at = usage.get("resetTime").and_then(extract_reset_time);
        let used = (limit - remaining).max(0.0);
        let used_percent = if limit > 0.0 {
            (used / limit) * 100.0
        } else {
            0.0
        };
        windows.push(window_from_used("weekly_limit", used_percent, resets_at));
    }

    success_snapshot("kimi", "api", windows, None)
}

fn parse_minimax_windows(body: &Value) -> Vec<CodingPlanQuotaWindow> {
    let mut windows = Vec::new();
    let Some(model_remains) = body.get("model_remains").and_then(|v| v.as_array()) else {
        return windows;
    };
    let Some(item) = model_remains.iter().find(|item| {
        item.get("model_name")
            .and_then(|v| v.as_str())
            .map(|s| s == "general")
            .unwrap_or(false)
    }) else {
        return windows;
    };

    if let Some(remain_pct) = item
        .get("current_interval_remaining_percent")
        .and_then(|v| v.as_f64())
    {
        let resets_at = item
            .get("end_time")
            .and_then(|v| v.as_i64())
            .and_then(millis_to_iso8601);
        windows.push(window_from_used("five_hour", 100.0 - remain_pct, resets_at));
    }

    if item.get("current_weekly_status").and_then(|v| v.as_i64()) == Some(1) {
        if let Some(remain_pct) = item
            .get("current_weekly_remaining_percent")
            .and_then(|v| v.as_f64())
        {
            let resets_at = item
                .get("weekly_end_time")
                .and_then(|v| v.as_i64())
                .and_then(millis_to_iso8601);
            windows.push(window_from_used(
                "weekly_limit",
                100.0 - remain_pct,
                resets_at,
            ));
        }
    }
    windows
}

async fn query_minimax(api_key: &str, is_cn: bool) -> CodingPlanQuotaSnapshot {
    let client = match http_client() {
        Ok(c) => c,
        Err(error) => return empty_snapshot("minimax", Some(error)),
    };
    let domain = if is_cn {
        "api.minimaxi.com"
    } else {
        "api.minimax.io"
    };
    let url = format!("https://{domain}/v1/api/openplatform/coding_plan/remains");
    let resp = match client
        .get(&url)
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Content-Type", "application/json")
        .send()
        .await
    {
        Ok(r) => r,
        Err(error) => {
            return empty_snapshot("minimax", Some(format!("Network error: {error}")));
        }
    };
    let status = resp.status();
    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        return empty_snapshot(
            "minimax",
            Some(format!("Authentication failed (HTTP {status})")),
        );
    }
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return empty_snapshot(
            "minimax",
            Some(format!("API error (HTTP {status}): {body}")),
        );
    }
    let raw = match resp.bytes().await {
        Ok(b) => b,
        Err(error) => {
            return empty_snapshot("minimax", Some(format!("Failed to read response: {error}")));
        }
    };
    let body: Value = match serde_json::from_slice(&raw) {
        Ok(v) => v,
        Err(error) => {
            return empty_snapshot(
                "minimax",
                Some(format!("Failed to parse response: {error}")),
            );
        }
    };
    if let Some(base_resp) = body.get("base_resp") {
        let status_code = base_resp
            .get("status_code")
            .and_then(|v| v.as_i64())
            .unwrap_or(-1);
        if status_code != 0 {
            let msg = base_resp
                .get("status_msg")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown error");
            return empty_snapshot(
                "minimax",
                Some(format!("API error (code {status_code}): {msg}")),
            );
        }
    }

    success_snapshot("minimax", "api", parse_minimax_windows(&body), None)
}

fn parse_zhipu_windows(data: &Value) -> Vec<CodingPlanQuotaWindow> {
    let mut five_hour: Option<(f64, Option<String>)> = None;
    let mut weekly: Option<(f64, Option<String>)> = None;

    let Some(limits) = data.get("limits").and_then(|v| v.as_array()) else {
        return vec![];
    };
    for item in limits {
        let unit = item.get("unit").and_then(|v| v.as_i64());
        let percentage = item
            .get("percentage")
            .or_else(|| item.get("UsagePercent"))
            .or_else(|| item.get("usagePercent"))
            .and_then(parse_f64)
            .unwrap_or(0.0);
        let resets_at = item
            .get("nextResetTime")
            .or_else(|| item.get("resetTime"))
            .and_then(extract_reset_time);
        match unit {
            Some(3) if five_hour.is_none() => five_hour = Some((percentage, resets_at)),
            Some(6) if weekly.is_none() => weekly = Some((percentage, resets_at)),
            _ => {}
        }
    }

    let mut windows = Vec::new();
    if let Some((pct, resets)) = five_hour {
        windows.push(window_from_used("five_hour", pct, resets));
    }
    if let Some((pct, resets)) = weekly {
        windows.push(window_from_used("weekly_limit", pct, resets));
    }
    windows
}

async fn query_zhipu(base_url: &str, api_key: &str) -> CodingPlanQuotaSnapshot {
    let client = match http_client() {
        Ok(c) => c,
        Err(error) => return empty_snapshot("zhipu", Some(error)),
    };
    let host = if base_url.to_lowercase().contains("bigmodel.cn") {
        "https://open.bigmodel.cn"
    } else {
        "https://api.z.ai"
    };
    let url = format!("{host}/api/monitor/usage/quota/limit");
    // 智谱：Authorization 不加 Bearer 前缀
    let resp = match client
        .get(&url)
        .header("Authorization", api_key)
        .header("Content-Type", "application/json")
        .header("Accept-Language", "en-US,en")
        .send()
        .await
    {
        Ok(r) => r,
        Err(error) => {
            return empty_snapshot("zhipu", Some(format!("Network error: {error}")));
        }
    };
    let status = resp.status();
    if status == reqwest::StatusCode::UNAUTHORIZED || status == reqwest::StatusCode::FORBIDDEN {
        return empty_snapshot(
            "zhipu",
            Some(format!("Authentication failed (HTTP {status})")),
        );
    }
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        return empty_snapshot("zhipu", Some(format!("API error (HTTP {status}): {body}")));
    }
    let raw = match resp.bytes().await {
        Ok(b) => b,
        Err(error) => {
            return empty_snapshot("zhipu", Some(format!("Failed to read response: {error}")));
        }
    };
    let body: Value = match serde_json::from_slice(&raw) {
        Ok(v) => v,
        Err(error) => {
            return empty_snapshot("zhipu", Some(format!("Failed to parse response: {error}")));
        }
    };
    if body.get("success").and_then(|v| v.as_bool()) == Some(false) {
        let msg = body
            .get("msg")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown error");
        return empty_snapshot("zhipu", Some(format!("API error: {msg}")));
    }
    let Some(data) = body.get("data") else {
        return empty_snapshot("zhipu", Some("Missing 'data' field in response".into()));
    };
    let plan_label = data
        .get("level")
        .and_then(|v| v.as_str())
        .map(str::to_string);

    success_snapshot("zhipu", "api", parse_zhipu_windows(data), plan_label)
}

async fn query_by_base_url_and_key(base_url: &str, api_key: &str) -> CodingPlanQuotaSnapshot {
    if api_key.trim().is_empty() {
        return empty_snapshot("empty_credentials", Some("API key is empty".into()));
    }
    let Some(provider) = detect_provider(base_url) else {
        return empty_snapshot(
            "unsupported",
            Some(format!(
                "base_url is not a known coding-plan host: {base_url}"
            )),
        );
    };
    match provider {
        CodingPlanProvider::Kimi => query_kimi(api_key).await,
        CodingPlanProvider::MiniMaxCn => query_minimax(api_key, true).await,
        CodingPlanProvider::MiniMaxEn => query_minimax(api_key, false).await,
        CodingPlanProvider::ZhipuCn | CodingPlanProvider::ZhipuEn => {
            query_zhipu(base_url, api_key).await
        }
    }
}

fn read_app_config_root() -> Value {
    let Ok(path) = crate::app_paths::config_file_path() else {
        return Value::Object(Default::default());
    };
    let content = std::fs::read_to_string(&path).unwrap_or_default();
    if content.trim().is_empty() {
        return Value::Object(Default::default());
    }
    serde_json::from_str(&content).unwrap_or(Value::Object(Default::default()))
}

fn pick_base_url_api_key(value: &Value) -> (String, String) {
    let base_url = value
        .get("baseUrl")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let api_key = value
        .get("apiKey")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    (base_url, api_key)
}

fn pick_from_providers_map(
    providers: &serde_json::Map<String, Value>,
    profile_id: Option<&str>,
) -> Option<(String, String)> {
    if let Some(id) = profile_id {
        if let Some(value) = providers.get(id) {
            return Some(pick_base_url_api_key(value));
        }
    }
    for (_, value) in providers {
        if value
            .get("isActive")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            return Some(pick_base_url_api_key(value));
        }
    }
    providers.values().next().map(pick_base_url_api_key)
}

fn resolve_claude_settings_env() -> (String, String) {
    // Claude 当前生效 settings.json 的 env（active provider 已写回）
    let path = dirs::home_dir().map(|home| home.join(".claude").join("settings.json"));
    let content = path
        .as_ref()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .unwrap_or_default();
    let settings: Value =
        serde_json::from_str(&content).unwrap_or(Value::Object(Default::default()));
    let env = settings
        .get("env")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();
    let base_url = env
        .get("ANTHROPIC_BASE_URL")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let api_key = env
        .get("ANTHROPIC_AUTH_TOKEN")
        .or_else(|| env.get("ANTHROPIC_API_KEY"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    (base_url, api_key)
}

fn extract_codex_base_url_and_key(
    config_toml: &str,
    auth_json: Option<&str>,
) -> Option<(String, String)> {
    let value: toml::Value = config_toml.parse().ok()?;
    let providers = value.get("model_providers")?.as_table()?;
    let mut base_url = String::new();
    for (_name, provider) in providers {
        if let Some(url) = provider
            .get("base_url")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|v| !v.is_empty())
        {
            base_url = url.to_string();
            break;
        }
    }
    if base_url.is_empty() {
        return None;
    }
    let mut api_key = String::new();
    if let Some(auth) = auth_json {
        if let Ok(auth_value) = serde_json::from_str::<Value>(auth) {
            for key in [
                "OPENAI_API_KEY",
                "openai_api_key",
                "api_key",
                "apiKey",
                "token",
            ] {
                if let Some(v) = auth_value
                    .get(key)
                    .and_then(|v| v.as_str())
                    .map(str::trim)
                    .filter(|v| !v.is_empty())
                {
                    api_key = v.to_string();
                    break;
                }
            }
            // nested tokens
            if api_key.is_empty() {
                if let Some(tokens) = auth_value.get("tokens").and_then(|v| v.as_object()) {
                    for key in ["access_token", "api_key", "token"] {
                        if let Some(v) = tokens
                            .get(key)
                            .and_then(|v| v.as_str())
                            .map(str::trim)
                            .filter(|v| !v.is_empty())
                        {
                            api_key = v.to_string();
                            break;
                        }
                    }
                }
            }
        }
    }
    Some((base_url, api_key))
}

/// 优先使用 Kimi CLI 登录态（~/.kimi-code/credentials），与 /status 同源。
fn resolve_kimi_cli_oauth_token() -> Option<(String, String)> {
    let path = dirs::home_dir()?.join(".kimi-code/credentials/kimi-code.json");
    let content = std::fs::read_to_string(path).ok()?;
    let value: Value = serde_json::from_str(&content).ok()?;
    let token = value
        .get("access_token")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|v| !v.is_empty())?
        .to_string();
    // 官方 coding 端点（与 kimi CLI /status 一致）
    Some(("https://api.kimi.com/coding/v1".to_string(), token))
}

fn resolve_engine_base_url_and_key(
    engine: &str,
    provider_profile_id: Option<&str>,
) -> Result<(String, String), String> {
    let engine = engine.trim().to_ascii_lowercase();
    let profile_id = provider_profile_id.map(str::trim).filter(|v| !v.is_empty());

    match engine.as_str() {
        "kimi" => {
            // 1) CLI OAuth（优先，对齐 kimi /status）
            if let Some(pair) = resolve_kimi_cli_oauth_token() {
                return Ok(pair);
            }
            // 2) mossx 内 managed kimi provider
            let root = read_app_config_root();
            let providers = root
                .get("kimi")
                .and_then(|k| k.get("providers"))
                .and_then(|p| p.as_object())
                .ok_or_else(|| "Kimi providers not found".to_string())?;
            pick_from_providers_map(providers, profile_id)
                .ok_or_else(|| "Kimi provider credentials not found".into())
        }
        "claude" => {
            if let Some(profile_id) = profile_id {
                if let Some(profile) =
                    crate::engine::claude::provider_profile::resolve_claude_provider_launch_profile(
                        Some(profile_id),
                    )?
                {
                    let base_url = profile
                        .env
                        .get("ANTHROPIC_BASE_URL")
                        .cloned()
                        .unwrap_or_default();
                    let api_key = profile
                        .env
                        .get("ANTHROPIC_AUTH_TOKEN")
                        .or_else(|| profile.env.get("ANTHROPIC_API_KEY"))
                        .cloned()
                        .unwrap_or_default();
                    return Ok((base_url, api_key));
                }
            }
            Ok(resolve_claude_settings_env())
        }
        "codex" => {
            let profile_id = profile_id
                .unwrap_or(crate::codex::provider_profile::CODEX_DISK_PROVIDER_PROFILE_ID);
            if profile_id == crate::codex::provider_profile::CODEX_DISK_PROVIDER_PROFILE_ID {
                // 官方 disk / ChatGPT：无第三方 base_url
                return Ok((String::new(), String::new()));
            }
            match crate::codex::provider_profile::resolve_codex_provider_profile(Some(profile_id)) {
                Ok(crate::codex::provider_profile::CodexProviderProfile::Disk) => {
                    Ok((String::new(), String::new()))
                }
                Ok(crate::codex::provider_profile::CodexProviderProfile::Managed {
                    config_toml,
                    auth_json,
                    ..
                }) => extract_codex_base_url_and_key(&config_toml, auth_json.as_deref())
                    .ok_or_else(|| {
                        "Codex provider has no model_providers.base_url / auth key".into()
                    }),
                Err(error) => Err(error),
            }
        }
        "grok" => {
            let root = read_app_config_root();
            let providers = root
                .get("grok")
                .and_then(|k| k.get("providers"))
                .and_then(|p| p.as_object())
                .ok_or_else(|| "Grok providers not found".to_string())?;
            pick_from_providers_map(providers, profile_id)
                .ok_or_else(|| "Grok provider credentials not found".into())
        }
        "opencode" => {
            let root = read_app_config_root();
            let providers = root
                .get("opencode")
                .and_then(|k| k.get("providers"))
                .and_then(|p| p.as_object())
                .ok_or_else(|| "OpenCode providers not found".to_string())?;
            pick_from_providers_map(providers, profile_id)
                .ok_or_else(|| "OpenCode provider credentials not found".into())
        }
        other => Err(format!(
            "engine {other} has no coding-plan credential resolver"
        )),
    }
}

/// 决策路由：官方 runtime vs 供应商 Coding Plan API。
fn resolve_quota_route(engine: &str, provider_profile_id: Option<&str>) -> QuotaRoute {
    let engine = engine.trim().to_ascii_lowercase();
    let (base_url, api_key) = match resolve_engine_base_url_and_key(&engine, provider_profile_id) {
        Ok(pair) => pair,
        Err(error) => {
            return QuotaRoute::None { reason: error };
        }
    };

    // Codex / Claude 官方：无第三方 base 或官方 host
    if engine == "codex" {
        if base_url.trim().is_empty() || is_official_openai_base(&base_url) {
            return QuotaRoute::OfficialRuntime { source: "codex" };
        }
        if detect_provider(&base_url).is_some() {
            if api_key.trim().is_empty() {
                return QuotaRoute::None {
                    reason: "Codex third-party provider missing API key".into(),
                };
            }
            return QuotaRoute::CodingPlanApi { base_url, api_key };
        }
        return QuotaRoute::None {
            reason: format!("Codex provider base_url not a known coding-plan host: {base_url}"),
        };
    }

    if engine == "claude" {
        if is_official_anthropic_base(&base_url) {
            // 官方 Claude：无 Coding Plan 窗口（与 Kimi /status 不同）
            return QuotaRoute::None {
                reason: "official_anthropic_no_coding_plan".into(),
            };
        }
        if detect_provider(&base_url).is_some() {
            if api_key.trim().is_empty() {
                return QuotaRoute::None {
                    reason: "Claude provider missing API key".into(),
                };
            }
            return QuotaRoute::CodingPlanApi { base_url, api_key };
        }
        return QuotaRoute::None {
            reason: format!("Claude base_url not a known coding-plan host: {base_url}"),
        };
    }

    // Kimi / Grok / OpenCode / 其他：有 coding-plan host 就走 API
    if detect_provider(&base_url).is_some() {
        if api_key.trim().is_empty() {
            return QuotaRoute::None {
                reason: "Provider API key is empty".into(),
            };
        }
        return QuotaRoute::CodingPlanApi { base_url, api_key };
    }

    // Kimi 官方无 base 但已有 CLI oauth（resolve 已填 coding v1）
    if engine == "kimi" && !api_key.trim().is_empty() {
        let base = if base_url.trim().is_empty() {
            "https://api.kimi.com/coding/v1".to_string()
        } else {
            base_url.clone()
        };
        if detect_provider(&base).is_some() {
            return QuotaRoute::CodingPlanApi {
                base_url: base,
                api_key,
            };
        }
    }

    QuotaRoute::None {
        reason: if base_url.trim().is_empty() {
            "Provider base_url is empty".into()
        } else {
            format!("base_url is not a known coding-plan host: {base_url}")
        },
    }
}

/// 按当前会话引擎 + provider profile 解析路由并查询额度。
/// 原则：官方 runtime/CLI 优先；第三方供应商走已知 Coding Plan API。
pub(crate) async fn get_coding_plan_quota_for_session(
    engine: &str,
    provider_profile_id: Option<&str>,
) -> CodingPlanQuotaSnapshot {
    match resolve_quota_route(engine, provider_profile_id) {
        QuotaRoute::OfficialRuntime { source } => CodingPlanQuotaSnapshot {
            source: source.to_string(),
            via: Some("official_runtime".to_string()),
            success: true,
            error: None,
            plan_label: None,
            windows: vec![],
            queried_at: now_millis(),
        },
        QuotaRoute::CodingPlanApi { base_url, api_key } => {
            let mut snapshot = query_by_base_url_and_key(&base_url, &api_key).await;
            // Kimi CLI oauth 路径标记 via=cli
            if snapshot.source == "kimi"
                && resolve_kimi_cli_oauth_token().is_some_and(|(_, token)| token == api_key)
            {
                snapshot.via = Some("cli".to_string());
            } else if snapshot.via.is_none() && snapshot.success {
                snapshot.via = Some("api".to_string());
            }
            snapshot
        }
        QuotaRoute::None { reason } => {
            // 官方 Claude 无 plan：用 none 而非 unsupported，UI 可隐藏
            if reason == "official_anthropic_no_coding_plan" {
                return CodingPlanQuotaSnapshot {
                    source: "none".to_string(),
                    via: Some("official_runtime".to_string()),
                    success: true,
                    error: None,
                    plan_label: None,
                    windows: vec![],
                    queried_at: now_millis(),
                };
            }
            let source = if reason.contains("not a known") || reason.contains("not found") {
                "unsupported"
            } else if reason.contains("missing") || reason.contains("empty") {
                "empty_credentials"
            } else {
                "empty"
            };
            empty_snapshot(source, Some(reason))
        }
    }
}

/// 直接用 base_url + api_key 查询（调试 / 前端已有凭据时）。
pub(crate) async fn get_coding_plan_quota_direct(
    base_url: &str,
    api_key: &str,
) -> CodingPlanQuotaSnapshot {
    query_by_base_url_and_key(base_url, api_key).await
}

#[tauri::command]
pub(crate) async fn get_coding_plan_quota(
    engine: String,
    provider_profile_id: Option<String>,
) -> Result<CodingPlanQuotaSnapshot, String> {
    Ok(get_coding_plan_quota_for_session(&engine, provider_profile_id.as_deref()).await)
}

#[tauri::command]
pub(crate) async fn get_coding_plan_quota_direct_cmd(
    base_url: String,
    api_key: String,
) -> Result<CodingPlanQuotaSnapshot, String> {
    Ok(get_coding_plan_quota_direct(&base_url, &api_key).await)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn detect_known_hosts() {
        assert!(matches!(
            detect_provider("https://api.kimi.com/coding/v1"),
            Some(CodingPlanProvider::Kimi)
        ));
        assert!(matches!(
            detect_provider("https://api.minimaxi.com/anthropic"),
            Some(CodingPlanProvider::MiniMaxCn)
        ));
        assert!(matches!(
            detect_provider("https://api.minimax.io/v1"),
            Some(CodingPlanProvider::MiniMaxEn)
        ));
        assert!(detect_provider("https://api.deepseek.com").is_none());
    }

    #[test]
    fn parse_minimax_remaining_to_used() {
        let body = json!({
            "model_remains": [{
                "model_name": "general",
                "current_interval_remaining_percent": 99.0,
                "end_time": 1_800_000_000_000i64,
                "current_weekly_status": 1,
                "current_weekly_remaining_percent": 89.0,
                "weekly_end_time": 1_800_100_000_000i64
            }]
        });
        let windows = parse_minimax_windows(&body);
        assert_eq!(windows.len(), 2);
        assert_eq!(windows[0].id, "five_hour");
        assert!((windows[0].used_percent - 1.0).abs() < 0.01);
        assert!((windows[0].remaining_percent - 99.0).abs() < 0.01);
        assert_eq!(windows[1].id, "weekly_limit");
        assert!((windows[1].used_percent - 11.0).abs() < 0.01);
    }

    #[test]
    fn parse_minimax_skips_inactive_weekly() {
        let body = json!({
            "model_remains": [{
                "model_name": "general",
                "current_interval_remaining_percent": 50.0,
                "current_weekly_status": 3,
                "current_weekly_remaining_percent": 100.0
            }]
        });
        let windows = parse_minimax_windows(&body);
        assert_eq!(windows.len(), 1);
        assert_eq!(windows[0].id, "five_hour");
    }

    #[test]
    fn official_base_detection() {
        assert!(is_official_anthropic_base(""));
        assert!(is_official_anthropic_base("https://api.anthropic.com/v1"));
        assert!(!is_official_anthropic_base(
            "https://api.minimaxi.com/anthropic"
        ));
        assert!(is_official_openai_base(""));
        assert!(is_official_openai_base("https://api.openai.com/v1"));
        assert!(!is_official_openai_base("https://api.kimi.com/coding/v1"));
    }

    #[test]
    fn extract_codex_minimax_provider_from_toml() {
        let toml = r#"
model = "m2"
[model_providers.minimax]
base_url = "https://api.minimaxi.com/v1"
wire_api = "responses"
"#;
        let auth = r#"{"OPENAI_API_KEY":"sk-test"}"#;
        let (base, key) = extract_codex_base_url_and_key(toml, Some(auth)).expect("extract");
        assert!(base.contains("minimaxi.com"));
        assert_eq!(key, "sk-test");
    }
}
