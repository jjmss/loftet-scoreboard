const COLORS = ["#b4233a", "#ef8d22", "#3f7d45", "#2f6f8f", "#6b3fa0", "#d4a017", "#c45c26", "#4a1d2b"];

function polar(cx: number, cy: number, r: number, angle: number) {
  const a = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

function slicePath(cx: number, cy: number, r: number, start: number, end: number) {
  if (end - start >= 359.9) {
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
  }
  const from = polar(cx, cy, r, start);
  const to = polar(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${from.x} ${from.y} A ${r} ${r} 0 ${large} 1 ${to.x} ${to.y} Z`;
}

export function nextRotation(current: number, winnerIndex: number, count: number) {
  const slice = 360 / count;
  const land = -((winnerIndex + 0.5) * slice);
  let target = land;
  while (target < current + 360 * 5) target += 360;
  return target;
}

type Props = {
  names: string[];
  rotation: number;
  spinning: boolean;
};

export function Wheel({ names, rotation, spinning }: Props) {
  const size = 320;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const n = Math.max(names.length, 1);
  const slice = 360 / n;

  return (
    <div className="wheel-wrap">
      <div className="wheel-pointer" aria-hidden="true" />
      <svg
        className={`wheel${spinning ? " spinning" : ""}`}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: `rotate(${rotation}deg)` }}
        role="img"
        aria-label="Loddhjul"
      >
        {names.length === 0 ? (
          <circle cx={cx} cy={cy} r={r} fill="#efe0c6" />
        ) : (
          names.map((name, i) => {
            const start = i * slice;
            const mid = polar(cx, cy, r * 0.62, start + slice / 2);
            return (
              <g key={`${name}-${i}`}>
                <path d={slicePath(cx, cy, r, start, start + slice)} fill={COLORS[i % COLORS.length]} />
                <text
                  x={mid.x}
                  y={mid.y}
                  fill="#fffaf1"
                  fontSize={names.length > 8 ? 12 : 15}
                  fontWeight={700}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {name.length > 10 ? `${name.slice(0, 9)}…` : name}
                </text>
              </g>
            );
          })
        )}
        <circle cx={cx} cy={cy} r={28} fill="#fffaf1" />
        <circle cx={cx} cy={cy} r={18} fill="#4a1d2b" />
      </svg>
    </div>
  );
}
