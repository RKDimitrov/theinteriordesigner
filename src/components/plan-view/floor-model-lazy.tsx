"use client";

import dynamic from "next/dynamic";
import type { Room } from "@/domain/schemas/room";

/** The 3D floor model, loaded only in the browser and only where it is shown. */
const FloorModel3D = dynamic(() => import("./floor-model-3d"), { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-muted/40" /> });

export function FloorModel({ rooms }: { rooms: readonly Room[] }) {
  return <FloorModel3D rooms={rooms} />;
}
