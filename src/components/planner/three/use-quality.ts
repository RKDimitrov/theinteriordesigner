"use client";

import { useSyncExternalStore } from "react";
import { effectiveQuality, parseStoredQuality, type Quality, QUALITY_STORAGE_KEY, type QualityChoice, type StoredQuality } from "@/domain/planner/quality";

/*
 * The 3D quality level, shared by the scene and the Scene tab and remembered
 * in the browser: the user's choice, and the level Auto last settled on so
 * the next visit starts there.
 */

const FRESH: StoredQuality = { choice: "auto", measured: "high" };
let current: StoredQuality | null = null;
const listeners = new Set<() => void>();

function read(): StoredQuality {
  if (current) return current;
  try {
    current = parseStoredQuality(window.localStorage.getItem(QUALITY_STORAGE_KEY));
  } catch {
    // Storage blocked (private mode): the level still works for this visit.
    current = FRESH;
  }
  return current;
}

function write(next: StoredQuality) {
  current = next;
  try {
    window.localStorage.setItem(QUALITY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Not remembered; nothing else to do.
  }
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export function useQuality() {
  const stored = useSyncExternalStore(subscribe, read, () => FRESH);
  return {
    ...stored,
    /** The level in force. */
    level: effectiveQuality(stored.choice, stored.measured),
    setChoice: (choice: QualityChoice) => write({ ...read(), choice }),
    setMeasured: (measured: Quality) => write({ ...read(), measured }),
  };
}

/** The stored level, and a way to move it, for code outside React (the frame-rate watch). */
export const qualityStore = { read, write };
