import React from 'react';

const colorClasses = {
  blue: 'bg-blue-100 text-blue-600',
  green: 'bg-green-100 text-green-600',
  orange: 'bg-orange-100 text-orange-600',
  purple: 'bg-purple-100 text-purple-600',
};

export default function ReportCard({ title, value, icon: Icon, color, subtitle }) {
  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100 flex items-center">
      <div className={`p-3 rounded-full ${colors} mr-4`}>
        <Icon className="w-6 h-6" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="text-2xl font-bold text-slate-800">{value}</p>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}