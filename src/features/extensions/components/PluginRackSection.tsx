import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getPluginRackSnapshot,
  type PluginRackPlug,
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
  if (snapshot.supervisorLive && !snapshot.hostEnabled) {
    return "extensions.rack.hostSupervisorLive";
  }
  return snapshot.hostEnabled
    ? "extensions.rack.hostEnabled"
    : "extensions.rack.hostDisabled";
}

function circuitTone(circuit: string): string {
  if (circuit === "live") {
    return "is-live";
  }
  if (circuit === "fallback") {
    return "is-fallback";
  }
  return "is-idle";
}

const KIND_ORDER = ["engine", "feature"] as const;

function groupPlugs(plugs: PluginRackPlug[]): Array<{ kind: string; plugs: PluginRackPlug[] }> {
  const groups = new Map<string, PluginRackPlug[]>();
  for (const plug of plugs) {
    const existing = groups.get(plug.kind);
    if (existing) {
      existing.push(plug);
    } else {
      groups.set(plug.kind, [plug]);
    }
  }
  const ordered: Array<{ kind: string; plugs: PluginRackPlug[] }> = KIND_ORDER.filter(
    (kind) => groups.has(kind),
  ).map((kind) => ({
    kind,
    plugs: groups.get(kind) ?? [],
  }));
  for (const [kind, kindPlugs] of groups) {
    if (!KIND_ORDER.includes(kind as (typeof KIND_ORDER)[number])) {
      ordered.push({ kind, plugs: kindPlugs });
    }
  }
  return ordered;
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
        {snapshot?.supervisorLive ? (
          <dl className="extensions-plugin-rack-supervisor">
            <div>
              <dt>{t("extensions.rack.supervisor")}</dt>
              <dd>{t("extensions.rack.supervisorLive")}</dd>
            </div>
            <div>
              <dt>{t("extensions.rack.supervisorPid")}</dt>
              <dd>{snapshot.supervisorPid ?? "—"}</dd>
            </div>
            <div>
              <dt>{t("extensions.rack.supervisorPath")}</dt>
              <dd className="extensions-plugin-rack-id">{snapshot.supervisorPath ?? "—"}</dd>
            </div>
          </dl>
        ) : null}
        {error ? (
          <p className="extensions-plugin-rack-error" role="alert">
            {t("extensions.rack.error", { message: error })}
          </p>
        ) : (
          <div className="extensions-plugin-rack-groups">
            {groupPlugs(snapshot?.plugs ?? []).map((group) => (
              <section
                key={group.kind}
                className="extensions-plugin-rack-group"
                aria-label={t(`extensions.rack.kinds.${group.kind}`, { defaultValue: group.kind })}
              >
                <h3>{t(`extensions.rack.kinds.${group.kind}`, { defaultValue: group.kind })}</h3>
                <ul className="extensions-plugin-rack-list">
                  {group.plugs.map((plug) => (
                    <li
                      key={plug.pluginId}
                      className={`extensions-plugin-rack-card ${circuitTone(plug.circuit)}`}
                    >
                      <div>
                        <h4>{plug.displayName}</h4>
                        <p className="extensions-plugin-rack-id">{plug.pluginId}</p>
                      </div>
                      <p
                        className={`extensions-plugin-rack-circuit ${circuitTone(plug.circuit)}`}
                        aria-label={t("extensions.rack.circuit")}
                      >
                        {t(`extensions.rack.circuits.${plug.circuit}`, { defaultValue: plug.circuit })}
                      </p>
                      <dl>
                        <div>
                          <dt>{t("extensions.rack.ownerClass")}</dt>
                          <dd>
                            {t(`extensions.rack.ownerClasses.${plug.ownerClass}`, {
                              defaultValue: plug.ownerClass,
                            })}
                          </dd>
                        </div>
                        <div>
                          <dt>{t("extensions.rack.productPath")}</dt>
                          <dd>
                            {t(`extensions.rack.productPaths.${plug.productPath}`, {
                              defaultValue: plug.productPath,
                            })}
                          </dd>
                        </div>
                        <div>
                          <dt>{t("extensions.rack.coreOwner")}</dt>
                          <dd>
                            {t(`extensions.rack.coreOwners.${plug.coreOwner}`, {
                              defaultValue: plug.coreOwner,
                            })}
                          </dd>
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
              </section>
            ))}
          </div>
        )}
        <p className="extensions-plugin-rack-footnote">{t("extensions.rack.marketplaceLater")}</p>
      </div>
    </section>
  );
}
