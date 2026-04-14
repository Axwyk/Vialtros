import React from "react";
import { icons } from "./icons";

export default function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      {icons.inbox({
        size: 56,
        strokeWidth: 1.5,
        className: "mb-4 text-blue-200",
      })}
      <div className="text-lg text-gray-500 font-medium">{message}</div>
    </div>
  );
}
