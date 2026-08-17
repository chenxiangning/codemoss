import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  getPluginRackSnapshot,
  installPlugin,
  uninstallPlugin,
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

function partitionPlugs(plugs: PluginRackPlug[]): { live: PluginRackPlug[]; later: PluginRackPlug[] } {
  const live: PluginRackPlug[] = [];
  const later: PluginRackPlug[] = [];
  for (const plug of plugs) {
    if (plug.installable) {
      live.push(plug);
    } else {
      later.push(plug);
    }
  }
  return { live, later };
}

function isPlugged(plug: PluginRackPlug): boolean {
  return plug.desiredState !== "uninstalled";
}

function socketClassName(plug: PluginRackPlug): string {
  const role = plug.installable ? "is-writable" : "is-sealed";
  const occupancy = plug.installable
    ? isPlugged(plug)
      ? "is-plugged"
      : "is-unplugged"
    : "is-capped";
  return `extensions-plugin-rack-socket ${role} ${occupancy} ${circuitTone(plug.circuit)}`;
}

function SocketWell({ plug }: { plug: PluginRackPlug }) {
  if (!plug.installable) {
    return (
      <div className="extensions-plugin-rack-well is-capped" aria-hidden>
        <span className="extensions-plugin-rack-cap" />
      </div>
    );
  }
  if (isPlugged(plug)) {
    return (
      <div className="extensions-plugin-rack-well is-occupied" aria-hidden>
        <span className="extensions-plugin-rack-plug" />
      </div>
    );
  }
  return (
    <div className="extensions-plugin-rack-well is-empty" aria-hidden>
      <span className="extensions-plugin-rack-pins">
        <span className="extensions-plugin-rack-pin is-earth" />
        <span className="extensions-plugin-rack-pin is-line" />
        <span className="extensions-plugin-rack-pin is-neutral" />
      </span>
    </div>
  );
}

function SocketMeta({ plug }: { plug: PluginRackPlug }) {
  const { t } = useTranslation();
  return (
    <p className="extensions-plugin-rack-meta">
      {t(`extensions.rack.circuits.${plug.circuit}`, { defaultValue: plug.circuit })}
      {" · "}
      {t(`extensions.rack.productPaths.${plug.productPath}`, { defaultValue: plug.productPath })}
      {" · "}
      {plug.kind}
    </p>
  );
}

function PlugSocket({
  plug,
  pendingId,
  onAction,
}: {
  plug: PluginRackPlug;
  pendingId: string | null;
  onAction: (plug: PluginRackPlug) => void;
}) {
  const { t } = useTranslation();
  const statusKey = plug.installable
    ? isPlugged(plug)
      ? "extensions.rack.plugged"
      : "extensions.rack.unplugged"
    : "extensions.rack.sealed";

  return (
    <li className={socketClassName(plug)}>
      <SocketWell plug={plug} />
      <div>
        <h4>{plug.displayName}</h4>
        <p className="extensions-plugin-rack-id">{plug.pluginId}</p>
      </div>
      <SocketMeta plug={plug} />
      <p className="extensions-plugin-rack-status">{t(statusKey)}</p>
      {plug.installable ? (
        <button
          type="button"
          className="extensions-plugin-rack-stage"
          disabled={pendingId === plug.pluginId}
          onClick={() => {
            onAction(plug);
          }}
        >
          {isPlugged(plug) ? t("extensions.rack.uninstall") : t("extensions.rack.install")}
        </button>
      ) : null}
    </li>
  );
}

export function PluginRackSection() {
  const { t } = useTranslation();
  const stylesReady = useFeatureStylesReady(loadExtensionsStyles);
  const [snapshot, setSnapshot] = useState<PluginRackSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const banks = partitionPlugs(snapshot?.plugs ?? []);

  const handlePlugAction = async (plug: PluginRackPlug) => {
    setPendingId(plug.pluginId);
    try {
      const next =
        plug.desiredState === "uninstalled"
          ? await installPlugin(plug.pluginId)
          : await uninstallPlugin(plug.pluginId);
      setSnapshot(next);
      setError(null);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPendingId(null);
    }
  };

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
          <div className="extensions-plugin-rack-strip">
            <div className="extensions-plugin-rack-bus" aria-hidden />
            <section className="extensions-plugin-rack-bank is-live" aria-label={t("extensions.rack.liveBank")}>
              <h3>{t("extensions.rack.liveBank")}</h3>
              <ul className="extensions-plugin-rack-sockets">
                {banks.live.map((plug) => (
                  <PlugSocket
                    key={plug.pluginId}
                    plug={plug}
                    pendingId={pendingId}
                    onAction={(next) => {
                      void handlePlugAction(next);
                    }}
                  />
                ))}
              </ul>
            </section>
            <section className="extensions-plugin-rack-bank is-later" aria-label={t("extensions.rack.laterBank")}>
              <h3>{t("extensions.rack.laterBank")}</h3>
              <ul className="extensions-plugin-rack-sockets">
                {banks.later.map((plug) => (
                  <PlugSocket key={plug.pluginId} plug={plug} pendingId={pendingId} onAction={handlePlugAction} />
                ))}
              </ul>
            </section>
          </div>
        )}
        <p className="extensions-plugin-rack-footnote">{t("extensions.rack.marketplaceLater")}</p>
      </div>
    </section>
  );
}
