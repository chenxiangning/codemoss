import { useTranslation } from "react-i18next";

import {
  AlertDialog,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogTitle,
} from "../../../components/ui/alert-dialog";

type SquadStopDialogProps = {
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function SquadStopDialog({
  open,
  busy,
  onOpenChange,
  onConfirm,
}: SquadStopDialogProps) {
  const { t } = useTranslation();
  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!busy) onOpenChange(nextOpen);
      }}
    >
      <AlertDialogPopup bottomStickOnMobile={false} modalLayer>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("squadOrchestration.stopDialog.title")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("squadOrchestration.stopDialog.description")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <button
            type="button"
            className="ghost"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {t("squadOrchestration.stopDialog.keepRunning")}
          </button>
          <button
            type="button"
            className="primary squad-stop-confirm"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy
              ? t("squadOrchestration.actions.stopping")
              : t("squadOrchestration.stopDialog.confirm")}
          </button>
        </AlertDialogFooter>
      </AlertDialogPopup>
    </AlertDialog>
  );
}
