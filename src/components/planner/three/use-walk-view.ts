"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_WALK_VIEW, parseWalkView, WALK_VIEW_STORAGE_KEY, type WalkView } from "@/domain/planner/walk-view";

/* The walkthrough's field of view and eye height, shared by the Scene tab and the walk, remembered in the browser. */

let current: WalkView | null = null;
const listeners = new Set<() => void>();

function read(): WalkView {
  if (current) return current;
  try {
    current = parseWalkView(window.localStorage.getItem(WALK_VIEW_STORAGE_KEY));
  } catch {
    current = DEFAULT_WALK_VIEW;
  }
  return current;
}

function write(next: WalkView) {
  current = next;
  try {
    window.localStorage.setItem(WALK_VIEW_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Not remembered.
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function useWalkView() {
  const view = useSyncExternalStore(subscribe, read, () => DEFAULT_WALK_VIEW);
  return { ...view, set: (patch: Partial<WalkView>) => write({ ...read(), ...patch }) };
}

/** For the walk's frame loop, which must not re-render to see a change. */
export const walkViewStore = { read };
