
import React from 'react';

interface StatCardProps {
  label: string;
  value: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value }) => {
  return (
    <div className="bg-slate-700/50 p-4 rounded-lg">
      <div className="text-sm text-slate-400 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-bold text-slate-100 mt-1">{value}</div>
    </div>
  );
};

export default StatCard;
