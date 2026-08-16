import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getPluginRackSnapshot,
  type PluginRackSnapshot,
} from "@/services/tauri/pluginRack";
import { loadExtensionsStyles } from "../../../styles/featureStyleLoaders";
import { useFeatureStylesReady } from "../../../styles/useFeatureStylesReady";

function hostStatusKey(snapshot: PluginRackSnapshot | null): string {
  if (!snapshot) {
    return "extensions.rack.loading";
  }
  if (!snapshot.hostAvailable) {
    return "extensions.rack.hostUnavailable";
  }
  return snapshot.hostEnabled
    ? "extensions.rack.hostEnabled"
    : "extensions.rack.hostDisabled";
}

export function PluginRackSection() {
  const { t } = useTranslation();
  const stylesReady = useFeatureStylesReady(loadExtensionsStyles);
  const [snapshot, setSnapshot] = useState<PluginRackSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getPluginRackSnapshot()
      .then((next) => {
        if (!cancelled) {
          setSnapshot(next);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : String(cause));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stylesReady) {
    return (
      <section className="extensions-view market-view" aria-label={t("extensions.rack.title")} aria-busy="true" />
    );
  }

  return (
    <section className="extensions-view market-view" aria-label={t("extensions.rack.title")}>
      <div className="extensions-plugin-rack">
        <header className="extensions-plugin-rack-header">
          <div>
            <h2>{t("extensions.rack.title")}</h2>
            <p>{t("extensions.rack.subtitle")}</p>
          </div>
          <p className="extensions-plugin-rack-host" role="status">
            {t(hostStatusKey(snapshot))}
          </p>
        </header>
        {error ? (
          <p className="extensions-plugin-rack-error" role="alert">
            {t("extensions.rack.error", { message: error })}
          </p>
        ) : (
          <ul className="extensions-plugin-rack-list">
            {(snapshot?.plugs ?? []).map((plug) => (
              <li key={plug.pluginId} className="extensions-plugin-rack-card">
                <div>
                  <h3>{plug.displayName}</h3>
                  <p className="extensions-plugin-rack-id">{plug.pluginId}</p>
                </div>
                <dl>
                  <div>
                    <dt>{t("extensions.rack.kind")}</dt>
                    <dd>{t(`extensions.rack.kinds.${plug.kind}`, { defaultValue: plug.kind })}</dd>
                  </div>
                  <div>
                    <dt>{t("extensions.rack.state")}</dt>
                    <dd>{t(`extensions.rack.states.${plug.state}`, { defaultValue: plug.state })}</dd>
                  </div>
                  <div>
                    <dt>{t("extensions.rack.generation")}</dt>
                    <dd>{plug.generation}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
        <p className="extensions-plugin-rack-footnote">{t("extensions.rack.marketplaceLater")}</p>
      </div>
    </section>
  );
}
