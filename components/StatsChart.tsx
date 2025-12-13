import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot, Label } from 'recharts';
import { SimulationStep, SimulationStatus, SimulationSpeed, SimulationSettings, ProgressionConfig } from '../types';
import { PlayCircle, Maximize2, Minimize2, Pause, Play, Square, Zap, Clock, MousePointerClick, Settings, Target, ShieldAlert, RotateCcw, Layers } from 'lucide-react';
import { getNumberColor } from '../constants';

interface StatsChartProps {
  data: SimulationStep[];
  initialBalance: number;
  className?: string;
  
  // Simulation Controls
  onRunSimulation?: () => void;
  simStatus?: SimulationStatus;
  onPause?: () => void;
  onResume?: () => void;
  onStop?: () => void;
  
  speed?: SimulationSpeed;
  onSpeedChange?: (speed: SimulationSpeed) => void;

  // View Controls
  isFullScreen?: boolean;
  onToggleFullScreen?: () => void;

  // Config Inputs for Full Screen
  settings?: SimulationSettings;
  onUpdateSettings?: (settings: SimulationSettings) => void;
  strategyConfig?: ProgressionConfig;
}

const StatsChart: React.FC<StatsChartProps> = ({ 
  data, 
  initialBalance, 
  className, 
  onRunSimulation,
  simStatus = 'IDLE',
  onPause,
  onResume,
  onStop,
  speed = 'FAST',
  onSpeedChange,
  isFullScreen: propIsFullScreen, 
  onToggleFullScreen,
  settings,
  onUpdateSettings,
  strategyConfig
}) => {
  // Fallback local state if not controlled
  const [localIsFullScreen, setLocalIsFullScreen] = useState(false);
  
  const isFullScreen = propIsFullScreen !== undefined ? propIsFullScreen : localIsFullScreen;
  const toggleFullScreen = onToggleFullScreen || (() => setLocalIsFullScreen(prev => !prev));

  // Transform data for chart: ensure 0 starts at initial
  const chartData = [
    { spinIndex: 0, bankroll: initialBalance, outcome: 0 },
    ...data
  ];

  const minVal = Math.min(...chartData.map(d => d.bankroll));
  const maxVal = Math.max(...chartData.map(d => d.bankroll));
  
  // Dynamic padding to ensure dots/labels aren't cut off
  const range = maxVal - minVal;
  const padding = range === 0 ? (initialBalance || 100) * 0.1 : range * 0.15;

  // Find High and Low Points
  const maxPoint = chartData.reduce((prev, curr) => curr.bankroll >= prev.bankroll ? curr : prev, chartData[0]);
  const minPoint = chartData.reduce((prev, curr) => curr.bankroll <= prev.bankroll ? curr : prev, chartData[0]);

  // Last Data Point for Live Display
  const lastStep = data.length > 0 ? data[data.length - 1] : null;

  const containerClass = isFullScreen 
    ? "fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md p-6 flex flex-col shadow-2xl transition-all duration-300" 
    : `w-full bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col ${className || 'h-72'} transition-all duration-300`;

  const lastColor = lastStep ? getNumberColor(lastStep.result.number) : 'green';
  const lastColorClass = lastColor === 'red' ? 'bg-red-600 shadow-red-900/50' : lastColor === 'black' ? 'bg-slate-900 shadow-black/50' : 'bg-green-600 shadow-green-900/50';

  // Disable animation if running or if large dataset to improve performance/stability
  const isAnimating = simStatus === 'RUNNING' || data.length > 100;

  if (data.length === 0 && !isFullScreen) return (
    <div className={`flex flex-col items-center justify-center gap-3 text-slate-500 border border-dashed border-slate-700 rounded-xl bg-slate-800/50 ${className || 'h-72'}`}>
      <span className="italic">No simulation data available.</span>
      {onRunSimulation && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onRunSimulation();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg hover:shadow-emerald-500/20 transition-all"
        >
           <PlayCircle size={16} />
           Run Simulation
        </button>
      )}
    </div>
  );

  return (
    <div className={containerClass}>
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2 min-h-[40px] shrink-0">
        <div className="flex items-center gap-4">
            <h3 className={`font-semibold text-slate-300 ${isFullScreen ? 'text-lg' : 'text-sm'}`}>
                Bankroll Progression
            </h3>
            
            {/* Live Result Indicator */}
            {lastStep && (
                <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-900/80 rounded-lg border border-slate-700 shadow-inner animate-in fade-in slide-in-from-left-2 duration-300">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden md:inline">Last Spin:</span>
                    <div className={`w-8 h-8 sm:w-7 sm:h-7 flex items-center justify-center rounded-full text-sm font-bold text-white border-2 border-white/10 shadow-lg ${lastColorClass}`}>
                        {lastStep.result.number}
                    </div>
                    <div className="flex flex-col leading-none">
                        <span className={`text-sm font-bold ${lastStep.outcome > 0 ? 'text-green-400' : lastStep.outcome < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                            {lastStep.outcome > 0 ? '+' : ''}{lastStep.outcome}
                        </span>
                    </div>
                </div>
            )}
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
            
            {/* Active Simulation Controls */}
            {simStatus !== 'IDLE' && (
              <div className="flex items-center gap-2 bg-slate-900/60 rounded-lg p-1 border border-slate-700/60 mr-2">
                 
                 {/* Speed Selector */}
                 {onSpeedChange && (
                   <div className="flex items-center bg-slate-800 rounded border border-slate-700 mr-2">
                      <button 
                        onClick={() => onSpeedChange('SLOW')}
                        className={`p-1.5 rounded-l transition-colors ${speed === 'SLOW' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        title="Slow"
                      >
                        <MousePointerClick size={14} />
                      </button>
                      <button 
                        onClick={() => onSpeedChange('MEDIUM')}
                        className={`p-1.5 border-l border-r border-slate-700 transition-colors ${speed === 'MEDIUM' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        title="Medium"
                      >
                        <Clock size={14} />
                      </button>
                      <button 
                        onClick={() => onSpeedChange('FAST')}
                        className={`p-1.5 rounded-r transition-colors ${speed === 'FAST' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        title="Fast"
                      >
                        <Zap size={14} />
                      </button>
                   </div>
                 )}

                 {/* Stop Button */}
                 {onStop && (
                   <button 
                      onClick={onStop}
                      className="p-1.5 text-red-400 hover:text-white hover:bg-red-500 rounded transition-colors"
                      title="Stop Simulation"
                   >
                      <Square size={16} fill="currentColor" />
                   </button>
                 )}

                 {/* Pause/Resume Button */}
                 {simStatus === 'RUNNING' && onPause && (
                    <button 
                      onClick={onPause}
                      className="p-1.5 text-amber-400 hover:text-white hover:bg-amber-500 rounded transition-colors"
                      title="Pause"
                    >
                      <Pause size={18} fill="currentColor" />
                    </button>
                 )}
                 {simStatus === 'PAUSED' && onResume && (
                    <button 
                      onClick={onResume}
                      className="p-1.5 text-green-400 hover:text-white hover:bg-green-500 rounded transition-colors"
                      title="Resume"
                    >
                      <Play size={18} fill="currentColor" />
                    </button>
                 )}
              </div>
            )}

            {/* Run Button (Only if IDLE) */}
            {simStatus === 'IDLE' && onRunSimulation && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onRunSimulation();
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded shadow-lg shadow-emerald-900/20 hover:shadow-emerald-500/30 transition-all ${isFullScreen ? 'px-4 py-2 text-sm' : ''}`}
                    title="Run Simulation"
                >
                    <PlayCircle size={isFullScreen ? 16 : 14} />
                    <span>Run Sim</span>
                </button>
            )}

            {/* Fullscreen Toggle */}
            <button
                onClick={toggleFullScreen}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
            >
                {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={18} />}
            </button>
        </div>
      </div>

      {/* Full Screen Settings Bar */}
      {isFullScreen && settings && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 animate-in fade-in slide-in-from-top-2 shrink-0">
             {/* Spins Per Sim */}
             <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <RotateCcw size={12} className="text-indigo-400" /> Spins / Sim
                </label>
                <input 
                    type="number" 
                    className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                    value={settings.spinsPerSimulation}
                    disabled={simStatus !== 'IDLE'}
                    onChange={(e) => onUpdateSettings?.({...settings, spinsPerSimulation: Math.max(1, Number(e.target.value))})}
                />
             </div>
             
             {/* Num Simulations */}
             <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers size={12} className="text-indigo-400" /> Batch Count
                </label>
                <input 
                    type="number" 
                    className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                    value={settings.numberOfSimulations}
                    disabled={simStatus !== 'IDLE'}
                    onChange={(e) => onUpdateSettings?.({...settings, numberOfSimulations: Math.max(1, Number(e.target.value))})}
                />
             </div>

             {/* Stop Loss (Display Only) */}
             {strategyConfig && (
                 <>
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldAlert size={12} className="text-red-400" /> Max Loss Limit
                        </label>
                         <div className="bg-slate-800/50 border border-slate-700/50 rounded px-3 py-1.5 text-sm text-slate-300 cursor-default select-none">
                            ${strategyConfig.stopLoss}
                         </div>
                     </div>
                     
                     {/* Profit Goal (Display Only) */}
                     <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Target size={12} className="text-green-400" /> Profit Goal
                        </label>
                         <div className={`bg-slate-800/50 border border-slate-700/50 rounded px-3 py-1.5 text-sm cursor-default select-none ${strategyConfig.useTotalProfitGoal ? 'text-green-400 font-bold' : 'text-slate-500 italic'}`}>
                            {strategyConfig.useTotalProfitGoal ? `$${strategyConfig.totalProfitGoal}` : 'Disabled'}
                         </div>
                     </div>
                 </>
             )}
          </div>
      )}
      
      {/* Chart Area */}
      <div className="flex-1 min-h-0 relative w-full h-full">
        <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
            <defs>
                <linearGradient id="colorBankroll" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis 
                dataKey="spinIndex" 
                stroke="#94a3b8" 
                fontSize={12} 
                tickLine={false} 
                axisLine={{ stroke: '#475569' }}
            />
            <YAxis 
                domain={[minVal - padding, maxVal + padding]} 
                stroke="#94a3b8" 
                fontSize={12} 
                tickLine={false} 
                axisLine={false}
                tickFormatter={(val) => `$${Math.round(val)}`} 
            />
            <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }}
                itemStyle={{ color: '#34d399', fontWeight: 'bold' }}
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Bankroll']}
                labelStyle={{ color: '#94a3b8', marginBottom: '0.25rem' }}
            />
            <ReferenceLine y={initialBalance} stroke="#64748b" strokeDasharray="3 3" />
            
            <Area 
                type="monotone" 
                dataKey="bankroll" 
                stroke="#34d399" 
                fillOpacity={1} 
                fill="url(#colorBankroll)" 
                strokeWidth={2} 
                isAnimationActive={!isAnimating}
                animationDuration={300}
            />

            {/* Highest Bankroll Point - Only show if we have data */}
            {data.length > 0 && (
                <ReferenceDot x={maxPoint.spinIndex} y={maxPoint.bankroll} r={4} fill="#10b981" stroke="#fff" strokeWidth={2} isFront={true}>
                    <Label value={`High: $${maxPoint.bankroll}`} position="top" fill="#10b981" fontSize={11} fontWeight="bold" offset={10} />
                </ReferenceDot>
            )}

            {/* Lowest Bankroll Point */}
            {data.length > 0 && (
                <ReferenceDot x={minPoint.spinIndex} y={minPoint.bankroll} r={4} fill="#ef4444" stroke="#fff" strokeWidth={2} isFront={true}>
                    <Label value={`Low: $${minPoint.bankroll}`} position="bottom" fill="#ef4444" fontSize={11} fontWeight="bold" offset={10} />
                </ReferenceDot>
            )}

            </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StatsChart;