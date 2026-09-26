import type { SymbolKind } from "@/domain/planner/items";

const INK = "#2b2622";

/** Lighter (a > 0) or darker (a < 0) shade of a #rrggbb colour. */
export function shade(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(a < 0 ? v * (1 + a) : v + (255 - v) * a);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

const stroke = { stroke: INK, strokeWidth: 1.2, vectorEffect: "non-scaling-stroke" as const };

function R({ x, y, w, h, fill, rx, ...rest }: { x: number; y: number; w: number; h: number; fill: string; rx?: number } & React.SVGProps<SVGRectElement>) {
  return <rect x={x} y={y} width={Math.max(0, w)} height={Math.max(0, h)} fill={fill} rx={rx} {...stroke} {...rest} />;
}
function L(props: { x1: number; y1: number; x2: number; y2: number } & React.SVGProps<SVGLineElement>) {
  return <line {...stroke} {...props} />;
}

/**
 * Plan symbol of a piece in local coordinates: (0,0) top-left, width `w` along x,
 * depth `d` along y, back edge at the top.
 */
export function PieceSymbol({ kind, w, d, color }: { kind: SymbolKind; w: number; d: number; color: string }) {
  const lt = shade(color, 0.35);
  switch (kind) {
    case "sofa":
    case "armchair": {
      const arm = kind === "sofa" ? 14 : 12;
      const back = 18;
      const seats = kind === "sofa" ? (w > 180 ? 3 : 2) : 1;
      return (
        <>
          <R x={0} y={0} w={w} h={d} fill={color} rx={5} />
          <R x={arm} y={back} w={w - 2 * arm} h={d - back - 3} fill={lt} rx={3} />
          <R x={0} y={0} w={w} h={back} fill={color} rx={4} />
          {Array.from({ length: seats - 1 }, (_, i) => {
            const x = arm + ((i + 1) * (w - 2 * arm)) / seats;
            return <L key={i} x1={x} y1={back} x2={x} y2={d - 3} />;
          })}
        </>
      );
    }
    case "table":
      return Math.abs(w - d) < 1 ? (
        <>
          <circle cx={w / 2} cy={d / 2} r={w / 2} fill={color} {...stroke} />
          <circle cx={w / 2} cy={d / 2} r={Math.max(0, w / 2 - 5)} fill="none" {...stroke} strokeOpacity={0.4} />
        </>
      ) : (
        <>
          <R x={0} y={0} w={w} h={d} fill={color} rx={3} />
          <R x={6} y={6} w={w - 12} h={d - 12} fill="none" strokeOpacity={0.4} />
        </>
      );
    case "tv":
      return (
        <>
          <R x={0} y={0} w={w} h={d} fill={color} />
          <R x={w * 0.2} y={4} w={w * 0.6} h={5} fill={INK} />
          <L x1={w / 2} y1={9} x2={w / 2} y2={d} />
        </>
      );
    case "rug": {
      const ticks: number[] = [];
      for (let x = 6; x < w; x += 10) ticks.push(x);
      return (
        <>
          <R x={0} y={0} w={w} h={d} fill={color} strokeDasharray="5 3" />
          <R x={12} y={12} w={w - 24} h={d - 24} fill="none" strokeOpacity={0.45} />
          {ticks.map((x) => (
            <g key={x} strokeOpacity={0.5}>
              <L x1={x} y1={-5} x2={x} y2={0} />
              <L x1={x} y1={d} x2={x} y2={d + 5} />
            </g>
          ))}
        </>
      );
    }
    case "lamp":
      return (
        <>
          <circle cx={w / 2} cy={d / 2} r={w / 2} fill={color} {...stroke} />
          <circle cx={w / 2} cy={d / 2} r={w / 6} fill="none" {...stroke} />
          <L x1={w / 2} y1={2} x2={w / 2} y2={d - 2} strokeOpacity={0.5} />
          <L x1={2} y1={d / 2} x2={w - 2} y2={d / 2} strokeOpacity={0.5} />
        </>
      );
    case "shelf":
      return (
        <>
          <R x={0} y={0} w={w} h={d} fill={color} />
          {[1, 2, 3].map((i) => (
            <L key={i} x1={(i * w) / 4} y1={0} x2={(i * w) / 4} y2={d} />
          ))}
        </>
      );
    case "plant":
      return (
        <>
          <circle cx={w / 2} cy={d / 2} r={w * 0.28} fill="#c9a27a" {...stroke} />
          {Array.from({ length: 7 }, (_, k) => (
            <ellipse
              key={k}
              cx={w / 2}
              cy={d * 0.22}
              rx={w * 0.13}
              ry={d * 0.24}
              fill={color}
              fillOpacity={0.85}
              {...stroke}
              transform={`rotate(${k * 51} ${w / 2} ${d / 2})`}
            />
          ))}
        </>
      );
    case "bed":
      return (
        <>
          <R x={0} y={0} w={w} h={d} fill={color} />
          <R x={8} y={8} w={w / 2 - 12} h={28} fill="#fbf6ec" rx={5} />
          <R x={w / 2 + 4} y={8} w={w / 2 - 12} h={28} fill="#fbf6ec" rx={5} />
          <R x={0} y={d * 0.3} w={w} h={d * 0.7} fill={lt} />
          <L x1={0} y1={d * 0.42} x2={w} y2={d * 0.3} />
        </>
      );
    case "dining":
      return (
        <>
          {[
            [30, 0],
            [w - 70, 0],
            [30, d - 32],
            [w - 70, d - 32],
          ].map(([x, y], i) => (
            <R key={i} x={x!} y={y!} w={40} h={32} fill={lt} rx={4} />
          ))}
          <R x={15} y={26} w={w - 30} h={d - 52} fill={color} />
        </>
      );
    case "desk":
      return (
        <>
          <R x={0} y={0} w={w} h={d} fill={color} />
          <circle cx={w / 2} cy={d * 0.72} r={Math.min(17, w / 4)} fill={lt} {...stroke} />
        </>
      );
    case "wardrobe":
      return (
        <>
          <R x={0} y={0} w={w} h={d} fill={color} />
          <L x1={w / 2} y1={0} x2={w / 2} y2={d} />
          <L x1={0} y1={0} x2={w} y2={d} strokeDasharray="3 3" strokeOpacity={0.5} />
          <L x1={w} y1={0} x2={0} y2={d} strokeDasharray="3 3" strokeOpacity={0.5} />
        </>
      );
    case "box":
      return <R x={0} y={0} w={w} h={d} fill={color} />;
  }
}

/** Symbol scaled into a small preview box, e.g. a catalogue card. */
export function SymbolPreview({ kind, w, d, color }: { kind: SymbolKind; w: number; d: number; color: string }) {
  const pad = 8;
  return (
    <svg viewBox={`${-pad} ${-pad} ${w + 2 * pad} ${d + 2 * pad}`} preserveAspectRatio="xMidYMid meet" aria-hidden>
      <PieceSymbol kind={kind} w={w} d={d} color={color} />
    </svg>
  );
}
