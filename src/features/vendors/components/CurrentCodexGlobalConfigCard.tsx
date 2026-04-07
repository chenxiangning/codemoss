import { useState } from "react";
import { useTranslation } from "react-i18next";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import ChevronRight from "lucide-react/dist/esm/icons/chevron-right";

interface CurrentCodexGlobalConfigCardProps {
  configLoading: boolean;
  configExists: boolean;
  configContent: string;
  configTruncated: boolean;
  configError: string | null;
  authLoading: boolean;
  authExists: boolean;
  authContent: string;
  authTruncated: boolean;
  authError: string | null;
}

function renderContent(
  loading: boolean,
  error: string | null,
  exists: boolean,
  content: string,
  truncated: boolean,
  emptyLabel: string,
  errorLabel: string,
  truncatedLabel: string,
  loadingLabel: string,
  contentId: string,
) {
  if (loading) {
    return (
      <div id={contentId} className="vendor-codex-global-config-body">
        <div className="vendor-current-config-loading">{loadingLabel}</div>
      </div>
    );
  }
  if (error) {
    return (
      <div id={contentId} className="vendor-codex-global-config-body">
        <div className="vendor-current-config-empty">
          {errorLabel}: {error}
        </div>
      </div>
    );
  }
  if (!exists) {
    return (
      <div id={contentId} className="vendor-codex-global-config-body">
        <div className="vendor-current-config-empty">{emptyLabel}</div>
      </div>
    );
  }
  return (
    <div id={contentId} className="vendor-codex-global-config-body">
      <pre className="vendor-codex-global-config-content">{content}</pre>
      {truncated ? <div className="settings-help">{truncatedLabel}</div> : null}
    </div>
  );
}

export function CurrentCodexGlobalConfigCard({
  configLoading,
  configExists,
  configContent,
  configTruncated,
  configError,
  authLoading,
  authExists,
  authContent,
  authTruncated,
  authError,
}: CurrentCodexGlobalConfigCardProps) {
  const { t } = useTranslation();
  const [configExpanded, setConfigExpanded] = useState(true);
  const [authExpanded, setAuthExpanded] = useState(false);
  const [authSensitiveVisible, setAuthSensitiveVisible] = useState(false);

  const maskedAuthContent = redactAuthContent(authContent);
  const authDisplayContent = authSensitiveVisible ? authContent : maskedAuthContent;

  const handleToggleAuthSensitive = () => {
    setAuthSensitiveVisible((value) => !value);
  };

  return (
    <div className="vendor-current-config vendor-codex-global-config">
      <div className="vendor-codex-global-config-section">
        <div className="vendor-current-config-header">
          <button
            type="button"
            className="vendor-codex-global-config-toggle"
            onClick={() => setConfigExpanded((value) => !value)}
            aria-expanded={configExpanded}
            aria-controls="codex-global-config-content"
          >
            {configExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span className="vendor-current-config-title">
              {t("settings.vendor.currentCodexGlobalConfig")}
            </span>
          </button>
          <code className="vendor-codex-global-config-path">
            {t("settings.vendor.codexGlobalConfigPath")}
          </code>
        </div>
        {configExpanded
          ? renderContent(
              configLoading,
              configError,
              configExists,
              configContent,
              configTruncated,
              t("settings.vendor.codexGlobalConfigEmpty"),
              t("settings.vendor.codexGlobalConfigReadFailed"),
              t("settings.vendor.codexGlobalConfigTruncated"),
              t("settings.loading"),
              "codex-global-config-content",
            )
          : null}
      </div>

      <div className="vendor-codex-global-config-section">
        <div className="vendor-current-config-header">
          <button
            type="button"
            className="vendor-codex-global-config-toggle"
            onClick={() => setAuthExpanded((value) => !value)}
            aria-expanded={authExpanded}
            aria-controls="codex-auth-config-content"
          >
            {authExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span className="vendor-current-config-title">
              {t("settings.vendor.currentCodexAuthConfig")}
            </span>
          </button>
          <div className="vendor-codex-global-config-header-actions">
            <button
              type="button"
              className="vendor-codex-sensitive-toggle"
              onClick={handleToggleAuthSensitive}
            >
              {authSensitiveVisible
                ? t("settings.vendor.codexAuthConfigHideSensitive")
                : t("settings.vendor.codexAuthConfigShowSensitive")}
            </button>
            <code className="vendor-codex-global-config-path">
              {t("settings.vendor.codexAuthConfigPath")}
            </code>
          </div>
        </div>
        {authExpanded
          ? renderContent(
              authLoading,
              authError,
              authExists,
              authDisplayContent,
              authTruncated,
              t("settings.vendor.codexAuthConfigEmpty"),
              t("settings.vendor.codexAuthConfigReadFailed"),
              t("settings.vendor.codexAuthConfigTruncated"),
              t("settings.loading"),
              "codex-auth-config-content",
            )
          : null}
      </div>
    </div>
  );
}

const SENSITIVE_KEY_PATTERN =
  /(access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|password|secret)/i;

function redactAuthContent(content: string): string {
  if (!content.trim()) {
    return content;
  }

  try {
    const parsed = JSON.parse(content) as unknown;
    const redacted = redactAuthValue(parsed);
    return JSON.stringify(redacted, null, 2);
  } catch {
    return content.replace(
      /("?(?:access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|password|secret)"?\s*:\s*)"([^"]*)"/gi,
      (_match, prefix, value) => `${prefix}"${maskSecret(String(value))}"`,
    );
  }
}

function redactAuthValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactAuthValue(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const output: Record<string, unknown> = {};
  for (const [key, nested] of entries) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = typeof nested === "string" ? maskSecret(nested) : "***";
      continue;
    }
    output[key] = redactAuthValue(nested);
  }
  return output;
}

function maskSecret(raw: string): string {
  if (!raw) {
    return "";
  }
  const trimmed = raw.trim();
  if (trimmed.length <= 8) {
    return "*".repeat(trimmed.length);
  }
  return `${trimmed.slice(0, 4)}${"*".repeat(8)}${trimmed.slice(-2)}`;
}
