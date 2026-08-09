import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import Globe from "lucide-react/dist/esm/icons/globe";
import GripVertical from "lucide-react/dist/esm/icons/grip-vertical";
import Network from "lucide-react/dist/esm/icons/network";
import Pencil from "lucide-react/dist/esm/icons/pencil";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import type { ProviderConfig } from "../types";
import { LOCAL_SETTINGS_PROVIDER_ID } from "../types";
import { resolveProviderBrandIcon } from "../providerBrandIcon";
import { ProviderBrandIconImg } from "./ProviderBrandIconImg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { renderVendorProviderDisplayName } from "./VendorProviderTable";
import { VendorProviderActiveSwitch } from "./VendorProviderActiveSwitch";

interface ProviderListProps {
  providers: ProviderConfig[];
  loading: boolean;
  headerActions?: ReactNode;
  /** 渲染在「+ 添加」按钮之后 */
  trailingActions?: ReactNode;
  onAdd: () => void;
  onEdit: (provider: ProviderConfig) => void;
  onDelete: (provider: ProviderConfig) => void;
  onReorder: (orderedIds: string[]) => void;
  onSwitch: (id: string) => void;
}

export function buildClaudeProviderReorderIds(
  regularProviders: ProviderConfig[],
  sourceIndex: number,
  destinationIndex: number,
): string[] {
  const reorderedProviders = Array.from(regularProviders);
  const [moved] = reorderedProviders.splice(sourceIndex, 1);
  if (!moved) {
    return regularProviders.map((provider) => provider.id);
  }
  const safeDestinationIndex = Math.min(
    Math.max(destinationIndex, 0),
    reorderedProviders.length,
  );
  reorderedProviders.splice(safeDestinationIndex, 0, moved);
  return reorderedProviders.map((provider) => provider.id);
}

/** 取一个最具代表性的已配置模型 id 用于品牌图标兜底识别(baseUrl 是主信号)。 */
function pickProviderModelId(provider: ProviderConfig): string | undefined {
  const env = provider.settingsConfig?.env;
  if (!env) return undefined;
  return (
    env.ANTHROPIC_DEFAULT_FABLE_MODEL ||
    env.ANTHROPIC_MODEL ||
    env.ANTHROPIC_DEFAULT_SONNET_MODEL ||
    env.ANTHROPIC_DEFAULT_OPUS_MODEL ||
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL
  );
}

export function ProviderList({
  providers,
  loading,
  headerActions,
  trailingActions,
  onAdd,
  onEdit,
  onDelete,
  onReorder,
  onSwitch,
}: ProviderListProps) {
  const { t } = useTranslation();
  const providerList = Array.isArray(providers) ? providers : [];
  const regularProviders = providerList.filter(
    (provider) =>
      provider.id !== LOCAL_SETTINGS_PROVIDER_ID && !provider.isLocalProvider,
  );

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    if (sourceIndex === destinationIndex) {
      return;
    }

    onReorder(
      buildClaudeProviderReorderIds(
        regularProviders,
        sourceIndex,
        destinationIndex,
      ),
    );
  };

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
            defaultValue: t("settings.vendor.allProviders"),
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

      {loading && <div className="vendor-loading">{t("settings.loading")}</div>}

      <div className="vendor-card-list vendor-provider-group">
        {regularProviders.length > 0 && (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="vendor-provider-card-list">
              {(provided) => (
                <div
                  className="vendor-card-list"
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                >
                  {regularProviders.map((provider, index) => {
                    const brandIconSrc = resolveProviderBrandIcon({
                      baseUrl:
                        provider.settingsConfig?.env?.ANTHROPIC_BASE_URL,
                      modelId: pickProviderModelId(provider),
                    });
                    return (
                      <Draggable
                        key={provider.id}
                        draggableId={provider.id}
                        index={index}
                      >
                        {(draggableProvided, snapshot) => (
                          <div
                            ref={draggableProvided.innerRef}
                            {...draggableProvided.draggableProps}
                            style={draggableProvided.draggableProps.style}
                            className={cn(
                              "vendor-card",
                              provider.isActive && "active",
                              snapshot.isDragging && "is-dragging",
                            )}
                          >
                            <span
                              className="vendor-card-drag-handle"
                              title={t("settings.vendor.dragToReorder")}
                              aria-label={t("settings.vendor.dragToReorder")}
                              {...draggableProvided.dragHandleProps}
                            >
                              <GripVertical aria-hidden />
                            </span>
                            <span className="vendor-card-icon">
                              {brandIconSrc ? (
                                <ProviderBrandIconImg src={brandIconSrc} />
                              ) : (
                                <Globe aria-hidden />
                              )}
                            </span>
                            <div className="vendor-card-info">
                              <div className="vendor-card-name">
                                {renderVendorProviderDisplayName(provider.name)}
                                {provider.source === "cc-switch" && (
                                  <Badge
                                    variant="outline"
                                    size="sm"
                                    className="text-stone-600 dark:text-stone-300"
                                  >
                                    cc-switch
                                  </Badge>
                                )}
                              </div>
                              {(provider.remark || provider.websiteUrl) && (
                                <div
                                  className="vendor-card-remark"
                                  title={provider.remark || provider.websiteUrl}
                                >
                                  {provider.remark || provider.websiteUrl}
                                </div>
                              )}
                            </div>
                            <div className="vendor-card-actions">
                              <VendorProviderActiveSwitch
                                active={Boolean(provider.isActive)}
                                providerId={provider.id}
                                providerName={provider.name}
                                onSwitch={onSwitch}
                              />
                              <span className="vendor-card-divider" />
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => onEdit(provider)}
                                title={t("settings.vendor.edit")}
                                aria-label={t("settings.vendor.edit")}
                              >
                                <Pencil aria-hidden />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="hover:text-destructive"
                                onClick={() => onDelete(provider)}
                                title={t("settings.vendor.delete")}
                                aria-label={t("settings.vendor.delete")}
                              >
                                <Trash2 aria-hidden />
                              </Button>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}

        {!loading && regularProviders.length === 0 && (
          <div className="vendor-empty">{t("settings.vendor.emptyState")}</div>
        )}
      </div>
    </div>
  );
}
