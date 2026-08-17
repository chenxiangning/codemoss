import { useTranslation } from "react-i18next";

import {
  isPlugged,
  listingCopyKey,
  type PluginRackPlug,
} from "@/services/tauri/pluginRack";

const NOTES_PLUGIN_ID = "com.mossx.notes";

type PluginMarketplaceCatalogProps = {
  live: PluginRackPlug[];
  later: PluginRackPlug[];
  pendingId: string | null;
  allowLocalSource?: boolean;
  onAction: (plug: PluginRackPlug) => void;
  onInstallFromPath?: (plug: PluginRackPlug) => void;
};

function MarketplaceListing({
  plug,
  pendingId,
  allowLocalSource,
  onAction,
  onInstallFromPath,
}: {
  plug: PluginRackPlug;
  pendingId: string | null;
  allowLocalSource?: boolean;
  onAction: (plug: PluginRackPlug) => void;
  onInstallFromPath?: (plug: PluginRackPlug) => void;
}) {
  const { t } = useTranslation();
  const copyKey = listingCopyKey(plug.pluginId);
  const plugged = isPlugged(plug);

  return (
    <li
      className={`extensions-plugin-market-card ${
        plug.installable ? (plugged ? "is-installed" : "is-available") : "is-sealed"
      }`}
    >
      <div className="extensions-plugin-market-card-head">
        <div>
          <h4>{plug.displayName}</h4>
          <p className="extensions-plugin-rack-id">{plug.pluginId}</p>
        </div>
        <p className="extensions-plugin-market-badge">
          {plug.installable
            ? plugged
              ? t("extensions.market.installed")
              : t("extensions.market.availableBadge")
            : t("extensions.market.comingSoonBadge")}
        </p>
      </div>
      <p className="extensions-plugin-market-summary">
        {t(`extensions.market.listings.${copyKey}`)}
      </p>
      <p className="extensions-plugin-market-meta">
        {t("extensions.market.publisher")}
        {" · "}
        {t(`extensions.rack.kinds.${plug.kind}`, { defaultValue: plug.kind })}
      </p>
      {plug.installable ? (
        <div className="extensions-plugin-market-actions">
          <button
            type="button"
            className="extensions-plugin-rack-stage"
            disabled={pendingId === plug.pluginId}
            onClick={() => {
              onAction(plug);
            }}
          >
            {plugged ? t("extensions.rack.uninstall") : t("extensions.rack.install")}
          </button>
          {allowLocalSource && plug.pluginId === NOTES_PLUGIN_ID && !plugged ? (
            <button
              type="button"
              className="extensions-plugin-rack-stage is-secondary"
              disabled={pendingId === plug.pluginId}
              onClick={() => {
                onInstallFromPath?.(plug);
              }}
            >
              {t("extensions.market.installFromFolder")}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function PluginMarketplaceCatalog({
  live,
  later,
  pendingId,
  allowLocalSource = false,
  onAction,
  onInstallFromPath,
}: PluginMarketplaceCatalogProps) {
  const { t } = useTranslation();

  return (
    <div className="extensions-plugin-market">
      <section
        className="extensions-plugin-market-shelf is-live"
        aria-label={t("extensions.market.available")}
      >
        <h3>{t("extensions.market.available")}</h3>
        <ul className="extensions-plugin-market-listings">
          {live.map((plug) => (
            <MarketplaceListing
              key={plug.pluginId}
              plug={plug}
              pendingId={pendingId}
              allowLocalSource={allowLocalSource}
              onAction={onAction}
              onInstallFromPath={onInstallFromPath}
            />
          ))}
        </ul>
      </section>
      <section
        className="extensions-plugin-market-shelf is-later"
        aria-label={t("extensions.market.comingSoon")}
      >
        <h3>{t("extensions.market.comingSoon")}</h3>
        <ul className="extensions-plugin-market-listings">
          {later.map((plug) => (
            <MarketplaceListing
              key={plug.pluginId}
              plug={plug}
              pendingId={pendingId}
              allowLocalSource={allowLocalSource}
              onAction={onAction}
              onInstallFromPath={onInstallFromPath}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
