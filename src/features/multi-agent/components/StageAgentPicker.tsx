import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";

import { AgentIcon } from "../../../components/AgentIcon";
import {
  agentProvider,
  CREATE_NEW_AGENT_ID,
  EMPTY_STATE_ID,
  type AgentItem,
} from "../../composer/components/ChatInputBox/providers/agentProvider";
import { pushErrorToast } from "../../../services/toasts";

export type StagePersonaAgent = {
  id: string;
  name: string;
  icon?: string | null;
  prompt?: string | null;
};

type StageAgentPickerProps = {
  value: StagePersonaAgent | null;
  onChange: (next: StagePersonaAgent | null) => void;
};

/**
 * 协作模板环节：选择客户端已有智能体（自定义 + 已启用内置）。
 * 数据源与 Composer # 智能体菜单同源（agentProvider）。
 */
export function StageAgentPicker({ value, onChange }: StageAgentPickerProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AgentItem[]>([]);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(
    null,
  );

  const load = useCallback(async () => {
    const controller = new AbortController();
    setLoading(true);
    try {
      const list = await agentProvider("", controller.signal);
      setItems(list);
    } catch {
      setItems([
        {
          id: EMPTY_STATE_ID,
          name: t("settings.agent.loadFailed", { defaultValue: "加载失败" }),
        },
        {
          id: CREATE_NEW_AGENT_ID,
          name: t("settings.agent.createAgent", { defaultValue: "创建智能体" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    void load();
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 220),
      });
    }
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      const menu = document.getElementById("ma-stage-agent-menu");
      if (menu?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, load]);

  const pick = (agent: AgentItem) => {
    if (agent.itemKind === "sectionHeader") return;
    if (agent.id === EMPTY_STATE_ID) return;
    if (agent.id === CREATE_NEW_AGENT_ID) {
      pushErrorToast({
        title: t("multiAgent.template.agentCreateTitle", {
          defaultValue: "创建智能体",
        }),
        message: t("multiAgent.template.agentCreateHint", {
          defaultValue: "请到 设置 → 智能体 中创建后，再回到此处选择。",
        }),
      });
      setOpen(false);
      return;
    }
    onChange({
      id: agent.id,
      name: agent.name,
      icon: agent.icon ?? null,
      prompt: agent.prompt ?? null,
    });
    setOpen(false);
  };

  const clear = (event: ReactMouseEvent) => {
    event.stopPropagation();
    onChange(null);
  };

  const label = value?.name?.trim()
    ? value.name
    : t("multiAgent.template.pickAgent", { defaultValue: "选择智能体" });

  return (
    <div className="ma-stage-agent" ref={rootRef}>
      <button
        type="button"
        ref={buttonRef}
        className={`ma-stage-agent-btn${value ? " is-set" : ""}${open ? " is-open" : ""}`}
        onClick={() => setOpen((prev) => !prev)}
        title={
          value
            ? t("multiAgent.template.agentSelected", {
                defaultValue: "智能体：{{name}}",
                name: value.name,
              })
            : t("multiAgent.template.pickAgentHint", {
                defaultValue: "选用客户端已有智能体（与 # 菜单同源）",
              })
        }
      >
        {value?.icon ? (
          <AgentIcon icon={value.icon} size={14} className="ma-stage-agent-icon" />
        ) : (
          <span className="ma-stage-agent-icon-fallback" aria-hidden>
            ⌘
          </span>
        )}
        <span className="ma-stage-agent-label">{label}</span>
        <span className="ma-stage-agent-caret" aria-hidden>
          ▾
        </span>
      </button>
      {value ? (
        <button
          type="button"
          className="ma-stage-agent-clear"
          onClick={clear}
          aria-label={t("multiAgent.template.clearAgent", {
            defaultValue: "清除智能体",
          })}
        >
          ×
        </button>
      ) : null}

      {open && menuPos && typeof document !== "undefined"
        ? createPortal(
            <div
              id="ma-stage-agent-menu"
              className="ma-stage-agent-menu"
              style={{
                top: menuPos.top,
                left: menuPos.left,
                minWidth: menuPos.width,
              }}
              role="listbox"
            >
              {loading ? (
                <div className="ma-stage-agent-empty">
                  {t("common.loading", { defaultValue: "加载中…" })}
                </div>
              ) : (
                items.map((agent) => {
                  if (agent.itemKind === "sectionHeader") {
                    return (
                      <div
                        key={agent.id}
                        className="ma-stage-agent-section"
                        role="presentation"
                      >
                        {agent.name}
                      </div>
                    );
                  }
                  const selected = value?.id === agent.id;
                  return (
                    <button
                      type="button"
                      key={agent.id}
                      role="option"
                      aria-selected={selected}
                      className={`ma-stage-agent-item${selected ? " is-on" : ""}${
                        agent.id === CREATE_NEW_AGENT_ID ? " is-create" : ""
                      }`}
                      onClick={() => pick(agent)}
                    >
                      <span className="ma-stage-agent-item-main">
                        {agent.icon &&
                        agent.id !== CREATE_NEW_AGENT_ID &&
                        agent.id !== EMPTY_STATE_ID ? (
                          <AgentIcon icon={agent.icon} size={14} />
                        ) : (
                          <span className="ma-stage-agent-item-dot" aria-hidden>
                            {agent.id === CREATE_NEW_AGENT_ID ? "+" : "·"}
                          </span>
                        )}
                        <span className="ma-stage-agent-item-name">
                          {agent.name}
                        </span>
                      </span>
                      {agent.description ? (
                        <span className="ma-stage-agent-item-desc">
                          {agent.description}
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
