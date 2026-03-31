
import React from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

const colorClasses = {
  emerald: {
    bg: "bg-emerald-500",
    light: "bg-emerald-50",
    text: "text-emerald-700",
    icon: "text-emerald-600"
  },
  blue: {
    bg: "bg-blue-500", 
    light: "bg-blue-50",
    text: "text-blue-700",
    icon: "text-blue-600"
  },
  purple: {
    bg: "bg-purple-500",
    light: "bg-purple-50", 
    text: "text-purple-700",
    icon: "text-purple-600"
  },
  orange: {
    bg: "bg-orange-500",
    light: "bg-orange-50",
    text: "text-orange-700", 
    icon: "text-orange-600"
  },
  sky: {
    bg: "bg-sky-500",
    light: "bg-sky-50",
    text: "text-sky-700",
    icon: "text-sky-600"
  },
  red: {
    bg: "bg-red-500",
    light: "bg-red-50",
    text: "text-red-700",
    icon: "text-red-600"
  }
};

export default function StatsCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendUp, 
  color = 'blue' 
}) {
  const colors = colorClasses[color];

  return (
    <Card className="relative overflow-hidden hover-lift card-shadow border-0">
      <div className={`absolute top-0 right-0 w-24 h-24 ${colors.bg} opacity-5 rounded-full transform translate-x-8 -translate-y-8`} />
      
      <CardHeader className="p-6 pb-2">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-600 mb-1">{title}</p>
            <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
            )}
          </div>
          <div className={`${colors.light} p-3 rounded-xl`}>
            <Icon className={`w-6 h-6 ${colors.icon}`} />
          </div>
        </div>
      </CardHeader>

      {trend && (
        <CardContent className="px-6 pb-6 pt-2">
          <div className="flex items-center gap-2">
            {trendUp ? (
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
            <span className={`text-sm font-medium ${trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
              {trend}
            </span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
