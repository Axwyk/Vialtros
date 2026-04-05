import React from "react";

const DAY_MAP = { 0: "D", 1: "L", 2: "M", 3: "X", 4: "J", 5: "V", 6: "S" };

const DEFAULT_DATA = [
  { day: "L", value: 5 },
  { day: "M", value: 8 },
  { day: "X", value: 6 },
  { day: "J", value: 10 },
  { day: "V", value: 9 },
  { day: "S", value: 3 },
  { day: "D", value: 1 },
];

export default function MiniChart({ data = DEFAULT_DATA }) {
  const todayLetter = DAY_MAP[new Date().getDay()];
  const max = Math.max(...data.map((d) => d.value), 1);
  const slotW = 40;
  const barW  = 26;
  const chartH = 80;
  const labelH = 24;
  const vpW = data.length * slotW;
  const vpH = chartH + labelH;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${vpW} ${vpH}`}
      preserveAspectRatio="xMidYMax meet"
      className="block"
      style={{ maxHeight: 120 }}
    >
      {data.map((d, i) => {
        const barH = Math.max((d.value / max) * chartH, 5);
        const x = i * slotW + (slotW - barW) / 2;
        const y = chartH - barH;
        const isToday = d.day === todayLetter;
        return (
          <g key={i}>
            {/* Track background */}
            <rect x={x} y={0} width={barW} height={chartH} rx={6} fill="#F1F5F9" />
            {/* Value bar */}
            <rect x={x} y={y} width={barW} height={barH} rx={6} fill={isToday ? "#2563EB" : "#BFDBFE"} />
            {/* Day label */}
            <text
              x={x + barW / 2}
              y={chartH + 18}
              textAnchor="middle"
              fontSize="11"
              fill={isToday ? "#2563EB" : "#94A3B8"}
              fontWeight={isToday ? "600" : "400"}
              fontFamily="system-ui, sans-serif"
            >
              {d.day}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
