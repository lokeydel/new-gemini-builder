import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot, Label } from 'recharts';
import { SimulationStep } from '../types';
import { PlayCircle } from 'lucide-react';

interface StatsChartProps {
  data: SimulationStep[];
  initialBalance: number;
  className?: string;
  onRunSimulation?: () => void;
}

const StatsChart: React.FC<StatsChartProps> = ({ data, initialBalance, className, onRunSimulation }) => {
  if (data.length === 0) return (
    <div className={`flex flex-col items-center justify-center gap-3 text-slate-500 border border-dashed border-slate-700 rounded-xl ${className || 'h-72'}`}>
      <span className="italic">No simulation data available.</span>
      {onRunSimulation && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onRunSimulation();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-600 transition-colors z-10"
        >
           <PlayCircle size={14} />
           Run Simulation
        </button>
      )}
    </div>
  );

  // Transform data for chart: ensure 0 starts at initial
  const chartData = [
    { spinIndex: 0, bankroll: initialBalance, outcome: 0 },
    ...data
  ];

  const minVal = Math.min(...chartData.map(d => d.bankroll));
  const maxVal = Math.max(...chartData.map(d => d.bankroll));
  
  // Dynamic padding to ensure dots/labels aren't cut off
  const range = maxVal - minVal;
  const padding = range === 0 ? initialBalance * 0.1 : range * 0.15;

  // Find High and Low Points
  const maxPoint = chartData.reduce((prev, curr) => curr.bankroll >= prev.bankroll ? curr : prev, chartData[0]);
  const minPoint = chartData.reduce((prev, curr) => curr.bankroll <= prev.bankroll ? curr : prev, chartData[0]);

  return (
    <div className={`w-full bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col ${className || 'h-72'}`}>
      <div className="flex items-center gap-4 mb-2 min-h-[24px]">
        <h3 className="text-sm font-semibold text-slate-300">Bankroll Progression</h3>
        {onRunSimulation && (
            <button
                onClick={(e) => {
                e.stopPropagation();
                onRunSimulation();
                }}
                className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 hover:text-emerald-300 border border-emerald-600/30 text-xs font-bold rounded transition-all shadow-sm z-10"
                title="Run Simulation Again"
            >
                <PlayCircle size={12} />
                Run
            </button>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
            <defs>
                <linearGradient id="colorBankroll" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="spinIndex" stroke="#94a3b8" fontSize={12} tickLine={false} />
            <YAxis domain={[minVal - padding, maxVal + padding]} stroke="#94a3b8" fontSize={12} tickLine={false} tickFormatter={(val) => `$${val}`} />
            <Tooltip 
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', color: '#f8fafc' }}
                itemStyle={{ color: '#34d399' }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Bankroll']}
            />
            <ReferenceLine y={initialBalance} stroke="#64748b" strokeDasharray="3 3" />
            
            <Area type="monotone" dataKey="bankroll" stroke="#34d399" fillOpacity={1} fill="url(#colorBankroll)" strokeWidth={2} />

            {/* Highest Bankroll Point */}
            <ReferenceDot x={maxPoint.spinIndex} y={maxPoint.bankroll} r={5} fill="#10b981" stroke="#fff" isFront={true}>
                <Label value={`High: $${maxPoint.bankroll}`} position="top" fill="#10b981" fontSize={12} fontWeight="bold" offset={10} />
            </ReferenceDot>

            {/* Lowest Bankroll Point */}
            <ReferenceDot x={minPoint.spinIndex} y={minPoint.bankroll} r={5} fill="#ef4444" stroke="#fff" isFront={true}>
                <Label value={`Low: $${minPoint.bankroll}`} position="bottom" fill="#ef4444" fontSize={12} fontWeight="bold" offset={10} />
            </ReferenceDot>

            </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StatsChart;