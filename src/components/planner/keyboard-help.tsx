"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePlanner } from "./planner-context";
import { type Shortcut, SHORTCUTS, shortcutLabel } from "./shortcuts";

const GROUPS: readonly Shortcut["group"][] = ["edit", "draw", "move", "view", "tools"];

/** Every shortcut, from the same table the key handler uses. Opens with "?". */
export function KeyboardHelp() {
  const t = useTranslations("Planner");
  const { s, dispatch } = usePlanner();
  if (!s.helpOpen) return null;
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const close = () => dispatch({ type: "set", patch: { helpOpen: false } });
  const name = (a: Shortcut["action"]) => (a.startsWith("tool:") ? t(`tool_${a.slice(5)}` as "tool_select") : t(`key_${a}` as "key_undo"));
  return (
    <div className="pl-help" role="dialog" aria-modal="true" aria-label={t("keysTitle")} data-testid="planner-keys" onClick={close}>
      <div className="pl-help-card" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{t("keysTitle")}</h2>
          <button type="button" className="pl-ib" onClick={close} aria-label={t("keysClose")}>
            <X className="ic" />
          </button>
        </header>
        <div className="pl-help-grid">
          {GROUPS.map((g) => {
            // One row per action; an action with two keys (redo, delete) shows both.
            const rows = new Map<string, string[]>();
            for (const sc of SHORTCUTS.filter((x) => x.group === g)) rows.set(sc.action, [...(rows.get(sc.action) ?? []), shortcutLabel(sc, mac)]);
            return (
              <section key={g}>
                <h3>{t(`keys_${g}`)}</h3>
                <dl>
                  {[...rows].map(([action, keys]) => (
                    <div key={action}>
                      <dt>
                        {keys.map((k) => (
                          <kbd key={k}>{k}</kbd>
                        ))}
                      </dt>
                      <dd>{name(action as Shortcut["action"])}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            );
          })}
        </div>
        <p className="pl-hint">{t("keysHint")}</p>
      </div>
    </div>
  );
}
