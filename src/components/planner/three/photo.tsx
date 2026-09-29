"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";

export interface PhotoApi {
  /** Renders a high-quality still and resolves with a PNG data URL. */
  capture: () => Promise<string>;
}

/** Sub-pixel offsets (Halton 2, 3) for the accumulated frames. */
const JITTER = [
  [0.5, 0.333],
  [0.25, 0.667],
  [0.75, 0.111],
  [0.125, 0.444],
  [0.625, 0.778],
  [0.375, 0.222],
  [0.875, 0.556],
  [0.0625, 0.889],
] as const;

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Photo mode: renders at twice the pixel density (the Canvas raises it while
 * `onBusy` is true) and averages eight frames,
 * each shifted by a fraction of a pixel. Edges come out clean and the noise
 * of the ambient occlusion evens out. No path tracer: this stays a few
 * seconds on an ordinary laptop.
 */
export function PhotoCapture({ apiRef, onBusy }: { apiRef: React.RefObject<PhotoApi | null>; onBusy: (busy: boolean) => void }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    apiRef.current = {
      async capture() {
        // The Canvas switches to twice the pixel density while busy; let it resize and shaders settle.
        onBusy(true);
        for (let i = 0; i < 6; i++) await nextFrame();
        const canvas = gl.domElement;
        const acc = document.createElement("canvas");
        acc.width = canvas.width;
        acc.height = canvas.height;
        const ctx = acc.getContext("2d")!;
        const cam = camera as THREE.PerspectiveCamera;
        try {
          for (let i = 0; i < JITTER.length; i++) {
            const [jx, jy] = JITTER[i]!;
            cam.setViewOffset(canvas.width, canvas.height, jx - 0.5, jy - 0.5, canvas.width, canvas.height);
            await nextFrame();
            await nextFrame();
            // A running average: frame i weighs 1 / (i + 1).
            ctx.globalAlpha = 1 / (i + 1);
            ctx.drawImage(canvas, 0, 0);
          }
        } finally {
          cam.clearViewOffset();
          onBusy(false);
        }
        return acc.toDataURL("image/png");
      },
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, gl, camera, onBusy]);
  return null;
}
