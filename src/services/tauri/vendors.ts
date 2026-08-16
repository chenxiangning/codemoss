import { invoke } from "@tauri-apps/api/core";
import type {
  ClaudeCurrentConfig as VendorClaudeCurrentConfig,
  CodexProviderConfig as VendorCodexProviderConfig,
  GrokCurrentConfig as VendorGrokCurrentConfig,
  GrokProviderDeleteResult as VendorGrokProviderDeleteResult,
  GrokProviderConfig as VendorGrokProviderConfig,
  KimiCurrentConfig as VendorKimiCurrentConfig,
  KimiProviderDeleteResult as VendorKimiProviderDeleteResult,
  KimiProviderConfig as VendorKimiProviderConfig,
  OpenCodeCurrentConfig as VendorOpenCodeCurrentConfig,
  OpenCodeProviderConfig as VendorOpenCodeProviderConfig,
  ProviderConfig as VendorProviderConfig,
} from "@mossx/plugin-vendors/runtime";

export async function getClaudeProviders(): Promise<VendorProviderConfig[]> {
  return invoke<VendorProviderConfig[]>("vendor_get_claude_providers");
}

export async function addClaudeProvider(provider: unknown): Promise<void> {
  return invoke("vendor_add_claude_provider", { provider });
}

export async function updateClaudeProvider(
  id: string,
  updates: unknown,
): Promise<void> {
  return invoke("vendor_update_claude_provider", { id, updates });
}

export async function deleteClaudeProvider(id: string): Promise<void> {
  return invoke("vendor_delete_claude_provider", { id });
}

export async function switchClaudeProvider(id: string): Promise<void> {
  return invoke("vendor_switch_claude_provider", { id });
}

export async function reorderClaudeProviders(orderedIds: string[]): Promise<void> {
  return invoke("vendor_reorder_claude_providers", { orderedIds });
}

export async function getCurrentClaudeConfig(): Promise<VendorClaudeCurrentConfig> {
  return invoke<VendorClaudeCurrentConfig>("vendor_get_current_claude_config");
}

export async function readClaudeSettingsJson(): Promise<string> {
  return invoke<string>("vendor_read_claude_settings_json");
}

export async function saveClaudeSettingsJson(content: string): Promise<void> {
  return invoke("vendor_save_claude_settings_json", { content });
}

export async function getClaudeAlwaysThinkingEnabled(): Promise<boolean> {
  return invoke<boolean>("vendor_get_claude_always_thinking_enabled");
}

export async function setClaudeAlwaysThinkingEnabled(
  enabled: boolean,
): Promise<void> {
  return invoke("vendor_set_claude_always_thinking_enabled", { enabled });
}

export interface VendorModelListResult {
  models: string[];
  endpoint: string;
}

export async function fetchClaudeProviderModels(
  baseUrl: string,
  apiKey: string,
): Promise<VendorModelListResult> {
  return invoke<VendorModelListResult>("vendor_fetch_claude_models", {
    baseUrl,
    apiKey,
  });
}

export async function getCodexProviders(): Promise<
  VendorCodexProviderConfig[]
> {
  return invoke<VendorCodexProviderConfig[]>("vendor_get_codex_providers");
}

export async function addCodexProvider(provider: unknown): Promise<void> {
  return invoke("vendor_add_codex_provider", { provider });
}

export async function updateCodexProvider(
  id: string,
  updates: unknown,
): Promise<void> {
  return invoke("vendor_update_codex_provider", { id, updates });
}

export async function deleteCodexProvider(id: string): Promise<void> {
  return invoke("vendor_delete_codex_provider", { id });
}

export async function switchCodexProvider(id: string): Promise<void> {
  return invoke("vendor_switch_codex_provider", { id });
}

export async function reorderCodexProviders(orderedIds: string[]): Promise<void> {
  return invoke("vendor_reorder_codex_providers", { orderedIds });
}

export async function getKimiProviders(): Promise<VendorKimiProviderConfig[]> {
  return invoke<VendorKimiProviderConfig[]>("vendor_get_kimi_providers");
}

export async function getCurrentKimiConfig(): Promise<VendorKimiCurrentConfig> {
  return invoke<VendorKimiCurrentConfig>("vendor_get_current_kimi_config");
}

/** Raw `~/.kimi-code/config.toml` (or `$KIMI_CODE_HOME/config.toml`). */
export async function readKimiConfigToml(): Promise<string> {
  return invoke<string>("vendor_read_kimi_config_toml");
}

export async function saveKimiConfigToml(content: string): Promise<void> {
  return invoke("vendor_save_kimi_config_toml", { content });
}

export async function addKimiProvider(provider: unknown): Promise<void> {
  return invoke("vendor_add_kimi_provider", { provider });
}

export async function updateKimiProvider(
  id: string,
  updates: unknown,
): Promise<void> {
  return invoke("vendor_update_kimi_provider", { id, updates });
}

export async function deleteKimiProvider(
  id: string,
): Promise<VendorKimiProviderDeleteResult> {
  return invoke<VendorKimiProviderDeleteResult>("vendor_delete_kimi_provider", {
    id,
  });
}

export async function switchKimiProvider(id: string): Promise<void> {
  return invoke("vendor_switch_kimi_provider", { id });
}

export async function fetchKimiProviderModels(
  baseUrl: string,
  apiKey: string,
): Promise<VendorModelListResult> {
  return invoke<VendorModelListResult>("vendor_fetch_kimi_models", {
    baseUrl,
    apiKey,
  });
}

export async function getGrokProviders(): Promise<VendorGrokProviderConfig[]> {
  return invoke<VendorGrokProviderConfig[]>("vendor_get_grok_providers");
}

export async function getCurrentGrokConfig(): Promise<VendorGrokCurrentConfig> {
  return invoke<VendorGrokCurrentConfig>("vendor_get_current_grok_config");
}

/** Raw `~/.grok/config.toml` (or `$GROK_HOME/config.toml`). */
export async function readGrokConfigToml(): Promise<string> {
  return invoke<string>("vendor_read_grok_config_toml");
}

export async function saveGrokConfigToml(content: string): Promise<void> {
  return invoke("vendor_save_grok_config_toml", { content });
}

export async function addGrokProvider(provider: unknown): Promise<void> {
  return invoke("vendor_add_grok_provider", { provider });
}

export async function updateGrokProvider(
  id: string,
  updates: unknown,
): Promise<void> {
  return invoke("vendor_update_grok_provider", { id, updates });
}

export async function deleteGrokProvider(
  id: string,
): Promise<VendorGrokProviderDeleteResult> {
  return invoke<VendorGrokProviderDeleteResult>("vendor_delete_grok_provider", {
    id,
  });
}

export async function switchGrokProvider(id: string): Promise<void> {
  return invoke("vendor_switch_grok_provider", { id });
}

export async function fetchGrokProviderModels(
  baseUrl: string,
  apiKey: string,
): Promise<VendorModelListResult> {
  return invoke<VendorModelListResult>("vendor_fetch_grok_models", {
    baseUrl,
    apiKey,
  });
}

export async function getOpenCodeProviders(): Promise<
  VendorOpenCodeProviderConfig[]
> {
  return invoke<VendorOpenCodeProviderConfig[]>(
    "vendor_get_opencode_providers",
  );
}

export async function getCurrentOpenCodeConfig(): Promise<VendorOpenCodeCurrentConfig> {
  return invoke<VendorOpenCodeCurrentConfig>(
    "vendor_get_current_opencode_config",
  );
}

/**
 * Raw OpenCode global config (`$OPENCODE_CONFIG` or
 * `~/.config/opencode/opencode.json` / `.jsonc`).
 */
export async function readOpenCodeConfigJson(): Promise<string> {
  return invoke<string>("vendor_read_opencode_config_json");
}

export async function saveOpenCodeConfigJson(content: string): Promise<void> {
  return invoke("vendor_save_opencode_config_json", { content });
}

export async function addOpenCodeProvider(provider: unknown): Promise<void> {
  return invoke("vendor_add_opencode_provider", { provider });
}

export async function updateOpenCodeProvider(
  id: string,
  updates: unknown,
): Promise<void> {
  return invoke("vendor_update_opencode_provider", { id, updates });
}

export async function deleteOpenCodeProvider(id: string): Promise<void> {
  return invoke("vendor_delete_opencode_provider", { id });
}

export async function switchOpenCodeProvider(id: string): Promise<void> {
  return invoke("vendor_switch_opencode_provider", { id });
}

export async function fetchOpenCodeProviderModels(
  baseUrl: string,
  apiKey: string,
): Promise<VendorModelListResult> {
  return invoke<VendorModelListResult>("vendor_fetch_opencode_models", {
    baseUrl,
    apiKey,
  });
}

export type CcSwitchAppType = "claude" | "codex";

export interface CcSwitchProvider {
  id: string;
  name: string;
  category: string | null;
  websiteUrl: string | null;
  baseUrl: string | null;
  hasApiKey: boolean;
  settingsConfig: Record<string, unknown>;
}

export interface CcSwitchProviderList {
  available: boolean;
  providers: CcSwitchProvider[];
}

export async function listCcSwitchProviders(
  appType: CcSwitchAppType,
): Promise<CcSwitchProviderList> {
  return invoke<CcSwitchProviderList>("vendor_list_cc_switch_providers", {
    appType,
  });
}

export async function listCcSwitchProvidersFromPath(
  path: string,
  appType: CcSwitchAppType,
): Promise<CcSwitchProviderList> {
  return invoke<CcSwitchProviderList>("vendor_list_cc_switch_providers_from_path", {
    path,
    appType,
  });
}

export interface GeminiVendorSettings {
  enabled: boolean;
  env: Record<string, string>;
  authMode: string;
}

export interface GeminiVendorPreflightCheck {
  id: string;
  label: string;
  status: "pass" | "fail" | string;
  message: string;
}

export interface GeminiVendorPreflightResult {
  checks: GeminiVendorPreflightCheck[];
}

export async function getGeminiVendorSettings(): Promise<GeminiVendorSettings> {
  return invoke<GeminiVendorSettings>("vendor_get_gemini_settings");
}

export async function saveGeminiVendorSettings(
  settings: GeminiVendorSettings,
): Promise<void> {
  return invoke("vendor_save_gemini_settings", { settings });
}

export async function getGeminiVendorPreflight(): Promise<GeminiVendorPreflightResult> {
  return invoke<GeminiVendorPreflightResult>("vendor_gemini_preflight");
}
