import React from "react";

const colorMap = {
  blue:   { iconBg: "bg-blue-50",    iconText: "text-blue-600" },
  green:  { iconBg: "bg-emerald-50", iconText: "text-emerald-600" },
  purple: { iconBg: "bg-violet-50",  iconText: "text-violet-600" },
  orange: { iconBg: "bg-orange-50",  iconText: "text-orange-500" },
};

export default function StatCard({ icon: Icon, value, label, color = "blue", trend, trendLabel }) {
  const c = colorMap[color] || colorMap.blue;
  const isUp   = trend === "up";
  const isDown = trend === "down";

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow duration-200 cursor-default">
      <div className="flex items-start justify-between">
        <div className={`${c.iconBg} rounded-lg p-2.5`}>
          <Icon size={20} strokeWidth={2} className={c.iconText} />
        </div>
        {trendLabel && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            isUp   ? "bg-emerald-50 text-emerald-600" :
            isDown ? "bg-red-50 text-red-500" :
                     "bg-gray-100 text-gray-500"
          }`}>
            {isUp ? "↑ " : isDown ? "↓ " : ""}{trendLabel}
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-none mb-1">{value}</p>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}
