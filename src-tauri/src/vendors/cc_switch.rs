//! CC Switch 数据源只读发现
//!
//! 数据源（按优先级探测，仅读不写）:
//!   1. `~/.cc-switch/cc-switch.db`  (CC Switch v3, SQLite `providers` 表)
//!   2. `~/.cc-switch/config.json`   (CC Switch v2, legacy JSON)
//! 路径统一通过 home dir 解析, macOS / Linux / Windows 均为用户主目录下的 `.cc-switch`。

use std::path::{Path, PathBuf};

use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use serde_json::Value;

const CC_SWITCH_DIR_NAME: &str = ".cc-switch";
const CC_SWITCH_DB_NAME: &str = "cc-switch.db";
const CC_SWITCH_LEGACY_JSON_NAME: &str = "config.json";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CcSwitchProvider {
    pub id: String,
    pub name: String,
    pub category: Option<String>,
    pub website_url: Option<String>,
    pub base_url: Option<String>,
    pub has_api_key: bool,
    pub settings_config: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct CcSwitchProviderList {
    pub available: bool,
    pub providers: Vec<CcSwitchProvider>,
}

fn cc_switch_dir_from(home: &Path) -> PathBuf {
    home.join(CC_SWITCH_DIR_NAME)
}

fn extract_claude_base_url(settings_config: &Value) -> Option<String> {
    settings_config
        .get("env")?
        .get("ANTHROPIC_BASE_URL")?
        .as_str()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

/// codex 的 `settings_config.config` 是 TOML 文本, 供应商段形如
/// `[model_providers.<name>]` 子表, 取第一个命中的 `base_url`。
fn extract_codex_base_url(settings_config: &Value) -> Option<String> {
    let config_text = settings_config.get("config")?.as_str()?;
    let parsed = config_text.parse::<toml::Value>().ok()?;
    let providers = parsed.get("model_providers")?.as_table()?;
    providers
        .values()
        .filter_map(|provider| provider.get("base_url")?.as_str())
        .map(str::trim)
        .find(|value| !value.is_empty())
        .map(str::to_string)
}

fn extract_base_url(app_type: &str, settings_config: &Value) -> Option<String> {
    match app_type {
        "claude" => extract_claude_base_url(settings_config),
        "codex" => extract_codex_base_url(settings_config),
        _ => None,
    }
}

fn non_empty_json_str(value: Option<&Value>) -> bool {
    value
        .and_then(Value::as_str)
        .map(|text| !text.trim().is_empty())
        .unwrap_or(false)
}

fn detect_has_api_key(app_type: &str, settings_config: &Value) -> bool {
    match app_type {
        "claude" => non_empty_json_str(
            settings_config
                .get("env")
                .and_then(|env| env.get("ANTHROPIC_AUTH_TOKEN")),
        ),
        "codex" => non_empty_json_str(
            settings_config
                .get("auth")
                .and_then(|auth| auth.get("OPENAI_API_KEY")),
        ),
        _ => false,
    }
}

fn build_provider(
    app_type: &str,
    id: String,
    name: String,
    category: Option<String>,
    website_url: Option<String>,
    settings_config: Value,
) -> CcSwitchProvider {
    let base_url = extract_base_url(app_type, &settings_config);
    let has_api_key = detect_has_api_key(app_type, &settings_config);
    CcSwitchProvider {
        id,
        name,
        category,
        website_url,
        base_url,
        has_api_key,
        settings_config,
    }
}

fn list_from_db(db_path: &Path, app_type: &str) -> Result<Vec<CcSwitchProvider>, String> {
    let connection = Connection::open_with_flags(db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|error| format!("Failed to open CC Switch db: {error}"))?;
    let mut statement = connection
        .prepare(
            "SELECT id, name, category, website_url, settings_config \
             FROM providers WHERE app_type = ?1 \
             ORDER BY sort_index, created_at",
        )
        .map_err(|error| format!("Failed to prepare CC Switch query: {error}"))?;
    let rows = statement
        .query_map([app_type], |row| {
            let settings_text: String = row.get(4)?;
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, Option<String>>(3)?,
                settings_text,
            ))
        })
        .map_err(|error| format!("Failed to query CC Switch providers: {error}"))?;

    let mut providers = Vec::new();
    for row in rows {
        let (id, name, category, website_url, settings_text) =
            row.map_err(|error| format!("Failed to read CC Switch row: {error}"))?;
        // 单条 settings_config 损坏不应拖垮整批, 兜底为空对象
        let settings_config = serde_json::from_str(&settings_text)
            .unwrap_or_else(|_| Value::Object(Default::default()));
        providers.push(build_provider(
            app_type,
            id,
            name,
            category,
            website_url,
            settings_config,
        ));
    }
    Ok(providers)
}

/// CC Switch v2 JSON: `{ "<app>": { "providers": [...] } }`,
/// providers 兼容数组与对象(map)两种形态。
fn list_from_legacy_json(
    json_path: &Path,
    app_type: &str,
) -> Result<Vec<CcSwitchProvider>, String> {
    let text = std::fs::read_to_string(json_path)
        .map_err(|error| format!("Failed to read CC Switch config.json: {error}"))?;
    let root: Value = serde_json::from_str(&text)
        .map_err(|error| format!("Failed to parse CC Switch config.json: {error}"))?;
    let Some(section) = root.get(app_type).and_then(|app| app.get("providers")) else {
        return Ok(Vec::new());
    };

    let entries: Vec<&Value> = match section {
        Value::Array(items) => items.iter().collect(),
        Value::Object(map) => map.values().collect(),
        _ => Vec::new(),
    };

    let providers = entries
        .into_iter()
        .filter_map(|entry| {
            let id = entry.get("id")?.as_str()?.to_string();
            let name = entry.get("name")?.as_str()?.to_string();
            let category = entry
                .get("category")
                .and_then(Value::as_str)
                .map(str::to_string);
            let website_url = entry
                .get("websiteUrl")
                .or_else(|| entry.get("website_url"))
                .and_then(Value::as_str)
                .map(str::to_string);
            let settings_config = entry
                .get("settingsConfig")
                .or_else(|| entry.get("settings_config"))
                .cloned()
                .unwrap_or_else(|| Value::Object(Default::default()));
            Some(build_provider(
                app_type,
                id,
                name,
                category,
                website_url,
                settings_config,
            ))
        })
        .collect();
    Ok(providers)
}

fn list_from_dir(dir: &Path, app_type: &str) -> CcSwitchProviderList {
    let db_path = dir.join(CC_SWITCH_DB_NAME);
    if db_path.is_file() {
        return match list_from_db(&db_path, app_type) {
            Ok(providers) => CcSwitchProviderList {
                available: true,
                providers,
            },
            // DB 损坏按不可用空态处理, 不向前端抛错
            Err(_) => CcSwitchProviderList {
                available: false,
                providers: Vec::new(),
            },
        };
    }

    let json_path = dir.join(CC_SWITCH_LEGACY_JSON_NAME);
    if json_path.is_file() {
        return match list_from_legacy_json(&json_path, app_type) {
            Ok(providers) => CcSwitchProviderList {
                available: true,
                providers,
            },
            Err(_) => CcSwitchProviderList {
                available: false,
                providers: Vec::new(),
            },
        };
    }

    CcSwitchProviderList {
        available: false,
        providers: Vec::new(),
    }
}

/// 从用户显式选择的文件导入: `.json` 按 legacy JSON 解析, 其余按 SQLite db 解析。
/// 与目录探测一致, 解析失败按不可用空态处理, 不向前端抛错。
fn list_from_file(file_path: &Path, app_type: &str) -> CcSwitchProviderList {
    let is_json = file_path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("json"))
        .unwrap_or(false);
    let result = if is_json {
        list_from_legacy_json(file_path, app_type)
    } else {
        list_from_db(file_path, app_type)
    };
    match result {
        Ok(providers) => CcSwitchProviderList {
            available: true,
            providers,
        },
        Err(_) => CcSwitchProviderList {
            available: false,
            providers: Vec::new(),
        },
    }
}

#[tauri::command]
pub(crate) async fn vendor_list_cc_switch_providers(
    app_type: String,
) -> Result<CcSwitchProviderList, String> {
    let Some(home) = dirs::home_dir() else {
        return Ok(CcSwitchProviderList {
            available: false,
            providers: Vec::new(),
        });
    };
    let dir = cc_switch_dir_from(&home);
    tauri::async_runtime::spawn_blocking(move || list_from_dir(&dir, &app_type))
        .await
        .map_err(|error| format!("CC Switch scan task failed: {error}"))
}

#[tauri::command]
pub(crate) async fn vendor_list_cc_switch_providers_from_path(
    path: String,
    app_type: String,
) -> Result<CcSwitchProviderList, String> {
    let file_path = PathBuf::from(path);
    if !file_path.is_file() {
        return Ok(CcSwitchProviderList {
            available: false,
            providers: Vec::new(),
        });
    }
    tauri::async_runtime::spawn_blocking(move || list_from_file(&file_path, &app_type))
        .await
        .map_err(|error| format!("CC Switch file scan task failed: {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEST_DIR_SEQ: AtomicU64 = AtomicU64::new(0);

    struct TestDir(PathBuf);

    impl TestDir {
        fn new() -> Self {
            let seq = TEST_DIR_SEQ.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir()
                .join(format!("ccgui-cc-switch-test-{}-{seq}", std::process::id()));
            fs::create_dir_all(&path).expect("create temp dir");
            TestDir(path)
        }
    }

    impl Drop for TestDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn seed_db(dir: &Path) {
        let connection = Connection::open(dir.join(CC_SWITCH_DB_NAME)).expect("open test db");
        connection
            .execute_batch(
                "CREATE TABLE providers (
                    id TEXT NOT NULL,
                    app_type TEXT NOT NULL,
                    name TEXT NOT NULL,
                    settings_config TEXT NOT NULL,
                    website_url TEXT,
                    category TEXT,
                    created_at INTEGER,
                    sort_index INTEGER,
                    PRIMARY KEY (id, app_type)
                );",
            )
            .expect("create providers table");
    }

    fn insert_provider(dir: &Path, id: &str, app_type: &str, name: &str, settings_config: &str) {
        let connection = Connection::open(dir.join(CC_SWITCH_DB_NAME)).expect("open test db");
        connection
            .execute(
                "INSERT INTO providers (id, app_type, name, settings_config, sort_index) \
                 VALUES (?1, ?2, ?3, ?4, 0)",
                (id, app_type, name, settings_config),
            )
            .expect("insert provider");
    }

    #[test]
    fn missing_dir_returns_unavailable() {
        let dir = TestDir::new();
        let result = list_from_dir(&dir.0.join("not-exist"), "claude");
        assert!(!result.available);
        assert!(result.providers.is_empty());
    }

    #[test]
    fn claude_entries_extract_base_url_and_api_key() {
        let dir = TestDir::new();
        seed_db(&dir.0);
        insert_provider(
            &dir.0,
            "p1",
            "claude",
            "DeepSeek",
            r#"{"env":{"ANTHROPIC_AUTH_TOKEN":"sk-x","ANTHROPIC_BASE_URL":"https://api.deepseek.com/anthropic"}}"#,
        );
        insert_provider(&dir.0, "p2", "claude", "Official", "{}");
        insert_provider(&dir.0, "p3", "codex", "OtherApp", "{}");

        let result = list_from_dir(&dir.0, "claude");
        assert!(result.available);
        assert_eq!(result.providers.len(), 2);
        assert_eq!(
            result.providers[0].base_url.as_deref(),
            Some("https://api.deepseek.com/anthropic")
        );
        assert!(result.providers[0].has_api_key);
        assert_eq!(result.providers[1].base_url, None);
        assert!(!result.providers[1].has_api_key);
    }

    #[test]
    fn codex_entries_parse_base_url_from_toml() {
        let dir = TestDir::new();
        seed_db(&dir.0);
        let toml_config = "model_provider = \"mimo\"\n\n[model_providers.mimo]\nbase_url = \"https://ai.17nas.com/v1\"\nwire_api = \"responses\"\n";
        let settings = serde_json::json!({
            "auth": {"OPENAI_API_KEY": "sk-codex"},
            "config": toml_config,
        });
        insert_provider(&dir.0, "c1", "codex", "My Codex", &settings.to_string());
        insert_provider(
            &dir.0,
            "c2",
            "codex",
            "Broken",
            "{\"auth\":{},\"config\":\"not = [valid toml\"}",
        );

        let result = list_from_dir(&dir.0, "codex");
        assert!(result.available);
        assert_eq!(result.providers.len(), 2);
        assert_eq!(
            result.providers[0].base_url.as_deref(),
            Some("https://ai.17nas.com/v1")
        );
        assert!(result.providers[0].has_api_key);
        assert_eq!(result.providers[1].base_url, None);
        assert!(!result.providers[1].has_api_key);
    }

    #[test]
    fn legacy_json_fallback_when_db_missing() {
        let dir = TestDir::new();
        let legacy = serde_json::json!({
            "claude": {
                "providers": [{
                    "id": "legacy-1",
                    "name": "Xm",
                    "category": "aggregator",
                    "websiteUrl": "https://example.com",
                    "settingsConfig": {"env": {"ANTHROPIC_BASE_URL": "https://token.example.com/anthropic"}}
                }]
            }
        });
        fs::write(
            dir.0.join(CC_SWITCH_LEGACY_JSON_NAME),
            serde_json::to_string(&legacy).unwrap(),
        )
        .expect("write legacy json");

        let result = list_from_dir(&dir.0, "claude");
        assert!(result.available);
        assert_eq!(result.providers.len(), 1);
        assert_eq!(result.providers[0].name, "Xm");
        assert_eq!(
            result.providers[0].base_url.as_deref(),
            Some("https://token.example.com/anthropic")
        );
        assert!(!result.providers[0].has_api_key);
    }

    #[test]
    fn db_takes_priority_over_legacy_json() {
        let dir = TestDir::new();
        seed_db(&dir.0);
        fs::write(
            dir.0.join(CC_SWITCH_LEGACY_JSON_NAME),
            r#"{"claude":{"providers":[{"id":"x","name":"Legacy","settingsConfig":{}}]}}"#,
        )
        .expect("write legacy json");

        let result = list_from_dir(&dir.0, "claude");
        assert!(result.available);
        assert!(result.providers.is_empty());
    }

    #[test]
    fn list_from_file_reads_db_file_at_arbitrary_path() {
        let dir = TestDir::new();
        seed_db(&dir.0);
        insert_provider(
            &dir.0,
            "p1",
            "claude",
            "DeepSeek",
            r#"{"env":{"ANTHROPIC_AUTH_TOKEN":"sk-x","ANTHROPIC_BASE_URL":"https://api.deepseek.com/anthropic"}}"#,
        );

        let result = list_from_file(&dir.0.join(CC_SWITCH_DB_NAME), "claude");
        assert!(result.available);
        assert_eq!(result.providers.len(), 1);
        assert_eq!(result.providers[0].name, "DeepSeek");
    }

    #[test]
    fn list_from_file_reads_legacy_json_by_extension() {
        let dir = TestDir::new();
        let json_path = dir.0.join("exported.json");
        let legacy = serde_json::json!({
            "codex": {
                "providers": [{
                    "id": "c1",
                    "name": "My Codex",
                    "settingsConfig": {"auth": {"OPENAI_API_KEY": "sk-codex"}, "config": ""}
                }]
            }
        });
        fs::write(&json_path, serde_json::to_string(&legacy).unwrap()).expect("write legacy json");

        let result = list_from_file(&json_path, "codex");
        assert!(result.available);
        assert_eq!(result.providers.len(), 1);
        assert_eq!(result.providers[0].name, "My Codex");
        assert!(result.providers[0].has_api_key);
    }

    #[test]
    fn list_from_file_broken_db_returns_unavailable() {
        let dir = TestDir::new();
        let broken_path = dir.0.join("broken.db");
        fs::write(&broken_path, b"not a sqlite db").expect("write broken db");

        let result = list_from_file(&broken_path, "claude");
        assert!(!result.available);
        assert!(result.providers.is_empty());
    }
}
