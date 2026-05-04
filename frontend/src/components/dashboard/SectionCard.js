import React from "react";

export default function SectionCard({ label, value, editable, onChange, type = "text" }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex flex-col mb-4">
      <span className="text-xs font-semibold text-blue-600 mb-1 uppercase tracking-wider">{label}</span>
      {editable ? (
        <input
          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-blue-400 focus:outline-none text-gray-900 text-base font-medium bg-white"
          type={type}
          value={value}
          onChange={onChange}
        />
      ) : (
        <span className="text-gray-800 text-lg font-semibold">{value || <span className='text-gray-400'>Sin especificar</span>}</span>
      )}
    </div>
  );
}
