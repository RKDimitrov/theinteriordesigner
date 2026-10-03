import { TOOL_KEY, TOOLS, type Tool } from "./state";

/*
 * Every keyboard shortcut of the planner, in one table: the key handler
 * matches against it and the help panel (?) lists it, so the two agree.
 * Plain data and a pure matcher, so the table is tested.
 */

export type ShortcutAction =
  | "undo"
  | "redo"
  | "copy"
  | "paste"
  | "duplicate"
  | "delete"
  | "escape"
  | "finish"
  | "back"
  | "nudgeLeft"
  | "nudgeRight"
  | "nudgeUp"
  | "nudgeDown"
  | "turnLeft"
  | "turnRight"
  | "viewLeft"
  | "viewRight"
  | "toggle3d"
  | "help"
  | "straight"
  | "noSnap"
  | `tool:${Tool}`;

export interface Shortcut {
  action: ShortcutAction;
  /** `KeyboardEvent.key`, compared case-insensitively. */
  key: string;
  mod?: boolean;
  shift?: boolean;
  /** Groups for the help panel. */
  group: "edit" | "draw" | "move" | "view" | "tools";
  /** Held while drawing or dragging rather than pressed: listed in the help, never matched as a command. */
  hold?: boolean;
}

export const SHORTCUTS: readonly Shortcut[] = [
  { action: "undo", key: "z", mod: true, group: "edit" },
  { action: "redo", key: "z", mod: true, shift: true, group: "edit" },
  { action: "redo", key: "y", mod: true, group: "edit" },
  { action: "copy", key: "c", mod: true, group: "edit" },
  { action: "paste", key: "v", mod: true, group: "edit" },
  { action: "duplicate", key: "d", mod: true, group: "edit" },
  { action: "delete", key: "Delete", group: "edit" },
  { action: "delete", key: "Backspace", group: "edit" },
  { action: "escape", key: "Escape", group: "edit" },
  { action: "finish", key: "Enter", group: "draw" },
  { action: "back", key: "Backspace", group: "draw" },
  { action: "straight", key: "Shift", group: "draw", hold: true },
  { action: "noSnap", key: "Control", group: "draw", hold: true },
  { action: "nudgeLeft", key: "ArrowLeft", group: "move" },
  { action: "nudgeRight", key: "ArrowRight", group: "move" },
  { action: "nudgeUp", key: "ArrowUp", group: "move" },
  { action: "nudgeDown", key: "ArrowDown", group: "move" },
  { action: "turnLeft", key: "q", group: "move" },
  { action: "turnRight", key: "e", group: "move" },
  { action: "viewLeft", key: "q", shift: true, group: "view" },
  { action: "viewRight", key: "e", shift: true, group: "view" },
  { action: "toggle3d", key: "3", group: "view" },
  { action: "help", key: "?", group: "view" },
  ...TOOLS.map((t): Shortcut => ({ action: `tool:${t}`, key: TOOL_KEY[t].toLowerCase(), group: "tools" })),
];

/** Keys whose Shift version is a different character: Shift is part of the key itself, not a modifier. */
const SHIFTED_KEYS = new Set(["?"]);

/**
 * The actions a key press can mean, best match first. `drawing` is true while
 * the wall tool has points down, where Enter and Backspace act on the outline.
 */
export function matchShortcut(e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }, drawing: boolean): ShortcutAction | null {
  if (e.altKey) return null;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const hits = SHORTCUTS.filter((s) => {
    if (s.hold) return false;
    if ((s.key.length === 1 ? s.key.toLowerCase() : s.key) !== key) return false;
    if (!!s.mod !== mod) return false;
    if (SHIFTED_KEYS.has(s.key)) return true;
    // Arrows take Shift for a bigger step; every other key needs its exact Shift state.
    if (s.key.startsWith("Arrow")) return true;
    return !!s.shift === e.shiftKey;
  });
  if (hits.length === 0) return null;
  // Backspace removes the last corner while drawing, the selection otherwise.
  if (key === "Backspace") return drawing ? "back" : "delete";
  return hits[0]!.action;
}

/** How a shortcut is written for people: "Ctrl+Shift+Z", "Enter", "?". */
export function shortcutLabel(s: Shortcut, mac: boolean): string {
  if (s.key === "Control") return mac ? "⌘" : "Ctrl";
  const names: Record<string, string> = { ArrowLeft: "←", ArrowRight: "→", ArrowUp: "↑", ArrowDown: "↓", Escape: "Esc", Delete: "Del", Backspace: "⌫" };
  const key = names[s.key] ?? (s.key.length === 1 ? s.key.toUpperCase() : s.key);
  return [s.mod ? (mac ? "⌘" : "Ctrl") : null, s.shift ? "Shift" : null, key].filter(Boolean).join("+");
}
