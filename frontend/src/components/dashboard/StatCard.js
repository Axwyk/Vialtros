import React from "react";

const colorMap = {
  blue: { iconBg: "bg-blue-50", iconText: "text-blue-600" },
  green: { iconBg: "bg-emerald-50", iconText: "text-emerald-600" },
  purple: { iconBg: "bg-violet-50", iconText: "text-violet-600" },
  orange: { iconBg: "bg-orange-50", iconText: "text-orange-500" },
};

export default function StatCard({
  icon: Icon,
  value,
  label,
  color = "blue",
  trend,
  trendLabel,
}) {
  const c = colorMap[color] || colorMap.blue;
  const isUp = trend === "up";
  const isDown = trend === "down";

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-4 flex flex-col gap-3 hover:shadow-md transition-shadow duration-200 cursor-default">
      <div className="flex items-start justify-between gap-2.5">
        <div
          className={`${c.iconBg} rounded-xl p-2 border border-white shadow-sm`}
        >
          <Icon size={18} strokeWidth={2} className={c.iconText} />
        </div>
        {trendLabel && (
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
              isUp
                ? "bg-emerald-50 text-emerald-600"
                : isDown
                  ? "bg-red-50 text-red-500"
                  : "bg-slate-100 text-slate-500"
            }`}
          >
            {isUp ? "↑ " : isDown ? "↓ " : ""}
            {trendLabel}
          </span>
        )}
      </div>
      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-[0.2em]">
          {label}
        </p>
        <p className="mt-1.5 text-[2rem] font-bold tracking-tight text-slate-900 leading-none">
          {value}
        </p>
      </div>
    </div>
  );
}
