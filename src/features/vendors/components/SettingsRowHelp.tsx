import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Info from "lucide-react/dist/esm/icons/info";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Compact info affordance next to a settings row title.
 * Stops click propagation so parent clickable rows do not open.
 */
export function SettingsRowHelp({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="vendor-btn-icon vendor-settings-row-help"
          title={t("settings.vendor.whatIsThis")}
          aria-label={t("settings.vendor.whatIsThis")}
          onClick={(event) => {
            event.stopPropagation();
          }}
          onKeyDown={(event) => {
            event.stopPropagation();
          }}
        >
          <Info aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="vendor-settings-row-help-popover"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="vendor-settings-row-help-body">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
