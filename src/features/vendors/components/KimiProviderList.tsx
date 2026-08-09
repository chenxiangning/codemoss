import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Network from "lucide-react/dist/esm/icons/network";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import type { KimiProviderConfig } from "../types";
import { LOCAL_KIMI_PROVIDER_ID } from "../types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  renderVendorProviderDisplayName,
  VendorProviderTable,
} from "./VendorProviderTable";
import { VendorProviderActiveSwitch } from "./VendorProviderActiveSwitch";

interface KimiProviderListProps {
  providers: KimiProviderConfig[];
  loading: boolean;
  headerActions?: ReactNode;
  /** 渲染在「+ 添加」按钮之后 */
  trailingActions?: ReactNode;
  onAdd: () => void;
  onEdit: (provider: KimiProviderConfig) => void;
  onDelete: (provider: KimiProviderConfig) => void;
  onSwitch: (id: string) => void;
}

export function KimiProviderList({
  providers,
  loading,
  headerActions,
  trailingActions,
  onAdd,
  onEdit,
  onDelete,
  onSwitch,
}: KimiProviderListProps) {
  const { t } = useTranslation();
  // Local official provider is rendered in the engine card, not this table.
  const providerList = (Array.isArray(providers) ? providers : []).filter(
    (provider) =>
      provider.id !== LOCAL_KIMI_PROVIDER_ID && !provider.isLocalProvider,
  );

  return (
    <div className="vendor-provider-list">
      <div className="vendor-list-header">
        <span className="vendor-list-title">
          <Network
            className="vendor-section-label-icon"
            size={15}
            strokeWidth={2}
            aria-hidden
          />
          {t("settings.vendor.providerChannels", {
            defaultValue: t("settings.vendor.thirdPartyConfig"),
          })}
        </span>
        <div className="vendor-list-actions">
          {headerActions}
          <Button size="xs" className="rounded-[4px]" onClick={onAdd}>
            + {t("settings.vendor.add")}
          </Button>
          {trailingActions}
        </div>
      </div>

      <VendorProviderTable
        loading={loading}
        empty={providerList.length === 0}
        emptyText={t("settings.vendor.emptyKimiState")}
        renderRows={() => (
          <tbody className="vendor-provider-table-body" data-slot="table-body">
            {providerList.map((provider) => (
              <tr
                key={provider.id}
                data-slot="table-row"
                className={cn(
                  "vendor-provider-table-row",
                  provider.isActive && "active",
                )}
              >
                <td
                  data-slot="table-cell"
                  className="vendor-provider-table-main-cell"
                >
                  <div className="vendor-card-info">
                    <div className="vendor-card-name">
                      {renderVendorProviderDisplayName(provider.name)}
                    </div>
                    {provider.remark ? (
                      <div className="vendor-card-remark" title={provider.remark}>
                        {provider.remark}
                      </div>
                    ) : null}
                    {(provider.model || provider.baseUrl) && (
                      <div
                        className="vendor-card-remark"
                        title={`${provider.model} · ${provider.baseUrl}`}
                      >
                        {provider.model}
                        {provider.model && provider.baseUrl ? " · " : ""}
                        {provider.baseUrl}
                      </div>
                    )}
                  </div>
                </td>
                <td
                  data-slot="table-cell"
                  className="vendor-provider-table-status-cell"
                >
                  <VendorProviderActiveSwitch
                    active={Boolean(provider.isActive)}
                    providerId={provider.id}
                    providerName={provider.name}
                    onSwitch={onSwitch}
                  />
                </td>
                <td
                  data-slot="table-cell"
                  className="vendor-provider-table-actions-cell"
                >
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onEdit(provider)}
                    title={t("settings.vendor.edit")}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="hover:text-destructive"
                    onClick={() => onDelete(provider)}
                    title={t("settings.vendor.delete")}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        )}
      />
    </div>
  );
}
