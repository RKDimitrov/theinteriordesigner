import { describe, expect, it } from "vitest";
import { matchShortcut, SHORTCUTS, shortcutLabel } from "./shortcuts";

const press = (key: string, o: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean } = {}) => ({ key, ctrlKey: !!o.ctrl, metaKey: !!o.meta, shiftKey: !!o.shift, altKey: !!o.alt });

describe("matchShortcut", () => {
  it("knows undo, redo, copy, paste and duplicate, with Ctrl or Cmd", () => {
    expect(matchShortcut(press("z", { ctrl: true }), false)).toBe("undo");
    expect(matchShortcut(press("Z", { ctrl: true, shift: true }), false)).toBe("redo");
    expect(matchShortcut(press("y", { meta: true }), false)).toBe("redo");
    expect(matchShortcut(press("c", { ctrl: true }), false)).toBe("copy");
    expect(matchShortcut(press("v", { meta: true }), false)).toBe("paste");
    expect(matchShortcut(press("d", { ctrl: true }), false)).toBe("duplicate");
  });

  it("finishes and steps back while drawing walls, and deletes otherwise", () => {
    expect(matchShortcut(press("Enter"), true)).toBe("finish");
    expect(matchShortcut(press("Backspace"), true)).toBe("back");
    expect(matchShortcut(press("Backspace"), false)).toBe("delete");
    expect(matchShortcut(press("Delete"), true)).toBe("delete");
  });

  it("nudges with the arrows, Shift or not, and turns pieces or the view with Q and E", () => {
    expect(matchShortcut(press("ArrowLeft"), false)).toBe("nudgeLeft");
    expect(matchShortcut(press("ArrowDown", { shift: true }), false)).toBe("nudgeDown");
    expect(matchShortcut(press("e"), false)).toBe("turnRight");
    expect(matchShortcut(press("Q", { shift: true }), false)).toBe("viewLeft");
  });

  it("picks tools by their letter, but not with Ctrl, Alt or Shift held", () => {
    expect(matchShortcut(press("w"), false)).toBe("tool:wall");
    expect(matchShortcut(press("W"), false)).toBe("tool:wall");
    expect(matchShortcut(press("w", { alt: true }), false)).toBeNull();
    expect(matchShortcut(press("w", { shift: true }), false)).toBeNull();
    expect(matchShortcut(press("x"), false)).toBeNull();
  });

  it("opens the help with ?, which needs Shift on most keyboards", () => {
    expect(matchShortcut(press("?", { shift: true }), false)).toBe("help");
  });

  it("lists Shift and Ctrl held while drawing, without making them commands", () => {
    expect(matchShortcut(press("Shift", { shift: true }), false)).toBeNull();
    expect(matchShortcut(press("Control", { ctrl: true }), false)).toBeNull();
    const held = SHORTCUTS.filter((s) => s.hold).map((s) => s.action);
    expect(held).toEqual(["straight", "noSnap"]);
    expect(shortcutLabel(SHORTCUTS.find((s) => s.action === "noSnap")!, true)).toBe("⌘");
  });

  it("gives every key combination one meaning", () => {
    const seen = new Map<string, string>();
    for (const s of SHORTCUTS) {
      const combo = `${s.mod ? "mod+" : ""}${s.shift ? "shift+" : ""}${s.key.toLowerCase()}`;
      // Backspace means "back" or "delete" depending on drawing, by design.
      if (s.key === "Backspace") continue;
      expect(seen.get(combo) ?? s.action, combo).toBe(s.action);
      seen.set(combo, s.action);
    }
  });
});

describe("shortcutLabel", () => {
  it("writes shortcuts for Windows and Mac", () => {
    expect(shortcutLabel({ action: "redo", key: "z", mod: true, shift: true, group: "edit" }, false)).toBe("Ctrl+Shift+Z");
    expect(shortcutLabel({ action: "copy", key: "c", mod: true, group: "edit" }, true)).toBe("⌘+C");
    expect(shortcutLabel({ action: "escape", key: "Escape", group: "edit" }, false)).toBe("Esc");
  });
});
