"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { judgeFrameRate, type Quality, stepDown, stepUp } from "@/domain/planner/quality";
import { qualityStore } from "./use-quality";

const { read, write } = qualityStore;

/** Frames averaged per judgement; long enough to ride out a hitch. */
const SAMPLE_FRAMES = 90;
/** A longer gap than this is the view resting (it only draws on demand), not a slow frame. */
const IDLE_GAP_S = 0.25;

/**
 * Watches the frame rate while the view is actually drawing (orbiting,
 * walking) and moves the automatic level down when it sags and back up when
 * there is room. A level that proved too slow is not tried again this visit.
 */
export function FrameRateWatch() {
  const frames = useRef(0);
  const time = useRef(0);
  const tooSlow = useRef<Quality | null>(null);
  useFrame((_, dt) => {
    if (dt > IDLE_GAP_S) {
      frames.current = 0;
      time.current = 0;
      return;
    }
    frames.current += 1;
    time.current += dt;
    if (frames.current < SAMPLE_FRAMES) return;
    const verdict = judgeFrameRate(frames.current / time.current);
    frames.current = 0;
    time.current = 0;
    const { measured } = read();
    if (verdict === "down" && measured !== "low") {
      tooSlow.current = measured;
      write({ ...read(), measured: stepDown(measured) });
    } else if (verdict === "up" && stepUp(measured) !== measured && stepUp(measured) !== tooSlow.current) {
      write({ ...read(), measured: stepUp(measured) });
    }
  });
  return null;
}
