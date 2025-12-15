
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot, Label } from 'recharts';
import { SimulationStep, SimulationStatus, SimulationSpeed, SimulationSettings, ProgressionConfig, Lane } from '../core/types';
import { PlayCircle, Maximize2, Minimize2, Pause, Play, Square, Zap, Clock, MousePointerClick, Settings, Target, ShieldAlert, RotateCcw, Layers, X, ChevronDown, ArrowUp, ArrowDown, Minus, Download, LogOut, ArrowLeft, XCircle } from 'lucide-react';
import { getNumberColor } from '../core/constants';

interface StatsChartProps {
  data: SimulationStep[];
  initialBalance: number;
  lanes?: Lane[]; 
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
  lanes = [], 
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
  const [localIsFullScreen, setLocalIsFullScreen] = useState(false);
  const isFullScreen = propIsFullScreen !== undefined ? propIsFullScreen : localIsFullScreen;
  const toggleFullScreen = onToggleFullScreen || (() => setLocalIsFullScreen(prev => !prev));
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll spin log in fullscreen
  useEffect(() => {
    if (isFullScreen && scrollRef.current) {
        scrollRef.current.scrollTop = 0; // Keep top (newest) visible
    }
  }, [data.length, isFullScreen]);

  const activeLanes = lanes.filter(l => l.enabled);

  // --- STATS CALCULATION ---
  const { chartData, minVal, maxVal, minStep, maxStep, stats } = useMemo(() => {
    const initialLaneBankrolls: Record<string, number> = {};
    const startPerLane = activeLanes.length > 0 ? initialBalance / activeLanes.length : initialBalance;
    activeLanes.forEach(l => { initialLaneBankrolls[l.id] = startPerLane; });

    const cData = [
      { spinIndex: 0, bankroll: initialBalance, outcome: 0, laneBankrolls: initialLaneBankrolls },
      ...data
    ];

    let min = initialBalance;
    let max = initialBalance;
    let minS = cData[0];
    let maxS = cData[0];

    let wins = 0;
    let losses = 0;
    let currentWinStreak = 0;
    let maxWinStreak = 0;
    let currentLossStreak = 0;
    let maxLossStreak = 0;
    let peak = initialBalance;
    let maxDrawdown = 0;
    let maxUpside = 0;

    for (let i = 0; i < cData.length; i++) {
        const step = cData[i];
        
        // Min/Max for Graph
        if (step.bankroll < min) { min = step.bankroll; minS = step; }
        if (step.bankroll > max) { max = step.bankroll; maxS = step; }

        // Stats Logic (Skip index 0 which is seed)
        if (i > 0) {
            if (step.outcome > 0) {
                wins++;
                currentWinStreak++;
                currentLossStreak = 0;
                maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
            } else if (step.outcome < 0) {
                losses++;
                currentLossStreak++;
                currentWinStreak = 0;
                maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
            } else {
                // Push/Zero
                currentWinStreak = 0;
                currentLossStreak = 0;
            }

            if (step.bankroll > peak) peak = step.bankroll;
            const dd = peak - step.bankroll;
            if (dd > maxDrawdown) maxDrawdown = dd;

            const up = step.bankroll - initialBalance;
            if (up > maxUpside) maxUpside = up;
        }
    }

    return { 
        chartData: cData, 
        minVal: min, 
        maxVal: max, 
        minStep: minS, 
        maxStep: maxS,
        stats: { wins, losses, maxWinStreak, maxLossStreak, maxDrawdown, maxUpside }
    };
  }, [data, initialBalance, activeLanes]);

  const range = maxVal - minVal;
  // Dynamic Range Scaling: Minimal padding to ensure the graph touches (or nearly touches) the edges
  // 1% padding prevents stroke clipping while keeping peaks at the top/bottom
  const padding = range === 0 ? (initialBalance || 100) * 0.05 : range * 0.01;
  
  const isAnimating = simStatus === 'RUNNING' || data.length > 100;

  // --- CUSTOM AXIS TICKS ---
  const renderCustomYTick = (props: any) => {
      const { x, y, payload } = props;
      const val = payload.value;
      const color = val >= initialBalance ? '#4ade80' : '#f87171'; // green-400 : red-400
      return (
          <text x={x} y={y} dy={4} textAnchor="end" fill={color} fontSize={10} fontWeight="bold">
              ${Math.round(val)}
          </text>
      );
  };
  
  const renderCustomXTick = (props: any) => {
      const { x, y, payload } = props;
      return (
          <text x={x} y={y} dy={12} textAnchor="middle" fill="#facc15" fontSize={10} fontWeight="bold">
              {payload.value}
          </text>
      );
  };
  
  const renderResetDot = (props: any) => {
      const { cx, cy, payload } = props;
      const step = payload as SimulationStep;
      if (step.laneDetails?.some(d => d.wasReset)) {
          return (
              <circle cx={cx} cy={cy} r={3} fill="#a855f7" stroke="#ffffff" strokeWidth={1} />
          );
      }
      return null;
  };
  
  // --- MINI VIEW (DEFAULT) ---
  if (!isFullScreen) {
      if (data.length === 0) return (
        <div className={`flex flex-col items-center justify-center gap-3 text-slate-500 border border-dashed border-slate-700 rounded-xl bg-slate-800/50 ${className || 'h-72'}`}>
          <span className="italic">No simulation data available.</span>
          <div className="flex gap-4 items-center mt-2">
            {onSpeedChange && (
                <div className="flex items-center bg-slate-800 rounded border border-slate-700 shadow-sm">
                    <button onClick={(e) => { e.stopPropagation(); onSpeedChange('SLOW'); }} className={`p-1.5 rounded-l transition-colors ${speed === 'SLOW' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}><MousePointerClick size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onSpeedChange('MEDIUM'); }} className={`p-1.5 border-l border-r border-slate-700 transition-colors ${speed === 'MEDIUM' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}><Clock size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onSpeedChange('FAST'); }} className={`p-1.5 rounded-r transition-colors ${speed === 'FAST' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}><Zap size={14} /></button>
                </div>
            )}
            {onRunSimulation && (
                <button onClick={(e) => { e.stopPropagation(); onRunSimulation(); }} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg hover:shadow-emerald-500/20 transition-all">
                   <PlayCircle size={16} /> Run Simulation
                </button>
            )}
          </div>
        </div>
      );

      return (
        <div className={`w-full bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col ${className || 'h-72'} transition-all duration-300 relative`}>
          <div className="flex items-center justify-between gap-4 mb-2 min-h-[30px] shrink-0">
             <h3 className="font-semibold text-slate-300 text-sm">Progression Lines</h3>
             <div className="flex items-center gap-2">
                 {/* Mini Controls */}
                 {simStatus === 'RUNNING' && onPause && <button onClick={onPause} className="p-1 text-amber-400 hover:bg-slate-700 rounded"><Pause size={14}/></button>}
                 {simStatus === 'PAUSED' && onResume && <button onClick={onResume} className="p-1 text-green-400 hover:bg-slate-700 rounded"><Play size={14}/></button>}
                 {simStatus !== 'IDLE' && onStop && <button onClick={onStop} className="p-1 text-red-400 hover:bg-slate-700 rounded"><Square size={14}/></button>}
                 <button onClick={toggleFullScreen} className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded"><Maximize2 size={14} /></button>
             </div>
          </div>
          <div className="flex-1 min-h-0 relative w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                        {activeLanes.map(lane => (
                            <linearGradient key={lane.id} id={`color-${lane.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={lane.color} stopOpacity={0.8}/>
                                <stop offset="95%" stopColor={lane.color} stopOpacity={0.1}/>
                            </linearGradient>
                        ))}
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <YAxis domain={[minVal - padding, maxVal + padding]} hide />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }} />
                    <ReferenceLine y={initialBalance} stroke="#64748b" strokeDasharray="3 3" />
                    {activeLanes.map(lane => (
                        <Area key={lane.id} type="monotone" dataKey={`laneBankrolls.${lane.id}`} stackId="1" stroke={lane.color} fill={`url(#color-${lane.id})`} fillOpacity={1} strokeWidth={1} isAnimationActive={!isAnimating} />
                    ))}
                    <Area 
                        type="monotone" 
                        dataKey="bankroll" 
                        stroke="#e2e8f0" 
                        fill="none" 
                        strokeWidth={2} 
                        strokeDasharray="5 5" 
                        isAnimationActive={!isAnimating}
                        dot={renderResetDot}
                    />
                </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      );
  }

  // --- FULLSCREEN DASHBOARD VIEW ---
  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex flex-col text-slate-200 font-sans animate-in fade-in duration-300">
      
      {/* 1. DASHBOARD HEADER */}
      <div className="h-16 shrink-0 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-4 shadow-lg relative z-50">
         
         <div className="flex items-center gap-4">
             {/* LEFT EXIT BUTTON */}
             <button 
                onClick={toggleFullScreen}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-red-900/40 text-slate-300 hover:text-red-100 border border-slate-700 hover:border-red-500 rounded-lg transition-all text-xs font-bold group"
                title="Back to Dashboard"
             >
                 <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                 BACK
             </button>

             <div className="h-6 w-px bg-slate-800 mx-2 hidden sm:block"></div>

             <div className="flex items-center gap-2">
                 <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold px-2 py-1 rounded text-xs tracking-wider">PRO</div>
                 <h1 className="font-bold text-lg text-slate-100 tracking-tight hidden sm:block">Simulation Results</h1>
             </div>

             {/* Batch Tabs (Visual Only) */}
             <div className="hidden lg:flex items-center gap-1 bg-slate-800 p-1 rounded-lg ml-4">
                 <button className="px-3 py-1 bg-slate-700 text-white text-xs font-bold rounded shadow-sm border border-slate-600">Current Run</button>
                 <button className="px-3 py-1 text-slate-500 text-xs font-bold hover:text-slate-300 transition-colors">History</button>
             </div>
         </div>

         {/* Center Inputs */}
         {settings && onUpdateSettings && (
             <div className="hidden xl:flex items-center gap-4 text-xs">
                 {/* Sim Speed */}
                 <div className="flex flex-col gap-0.5">
                     <span className="text-[9px] uppercase font-bold text-slate-500">Sim Speed</span>
                     <div className="flex bg-slate-800 rounded border border-slate-700">
                        <button onClick={() => onSpeedChange?.('SLOW')} className={`px-2 py-0.5 rounded-l ${speed === 'SLOW' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Slow</button>
                        <button onClick={() => onSpeedChange?.('MEDIUM')} className={`px-2 py-0.5 border-l border-r border-slate-700 ${speed === 'MEDIUM' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Med</button>
                        <button onClick={() => onSpeedChange?.('FAST')} className={`px-2 py-0.5 rounded-r ${speed === 'FAST' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>Fast</button>
                     </div>
                 </div>

                 {/* Inputs Group */}
                 <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
                     <div>
                        <span className="block text-[9px] uppercase font-bold text-emerald-500 mb-0.5">Bankroll</span>
                        <div className="relative">
                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                            <input type="number" className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 pl-4 text-white font-mono focus:border-indigo-500 outline-none" 
                                value={settings.startingBankroll} onChange={e => onUpdateSettings({...settings, startingBankroll: +e.target.value})} disabled={simStatus !== 'IDLE'} />
                        </div>
                     </div>
                     <div>
                        <span className="block text-[9px] uppercase font-bold text-slate-500 mb-0.5">Table Min</span>
                        <div className="relative">
                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                            <input type="number" className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 pl-4 text-white font-mono focus:border-indigo-500 outline-none"
                                value={settings.tableMin} onChange={e => onUpdateSettings({...settings, tableMin: +e.target.value})} disabled={simStatus !== 'IDLE'} />
                        </div>
                     </div>
                     <div>
                        <span className="block text-[9px] uppercase font-bold text-slate-500 mb-0.5">Table Max</span>
                        <div className="relative">
                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                            <input type="number" className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 pl-4 text-white font-mono focus:border-indigo-500 outline-none"
                                value={settings.tableMax} onChange={e => onUpdateSettings({...settings, tableMax: +e.target.value})} disabled={simStatus !== 'IDLE'} />
                        </div>
                     </div>
                     <div>
                        <span className="block text-[9px] uppercase font-bold text-orange-400 mb-0.5"># Sims</span>
                        <input type="number" className="w-14 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white font-mono focus:border-indigo-500 outline-none"
                             value={settings.numberOfSimulations} onChange={e => onUpdateSettings({...settings, numberOfSimulations: +e.target.value})} disabled={simStatus !== 'IDLE'} />
                     </div>
                     <div>
                        <span className="block text-[9px] uppercase font-bold text-slate-500 mb-0.5">Max Spins</span>
                        <input type="number" className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white font-mono focus:border-indigo-500 outline-none"
                             value={settings.spinsPerSimulation} onChange={e => onUpdateSettings({...settings, spinsPerSimulation: +e.target.value})} disabled={simStatus !== 'IDLE'} />
                     </div>
                 </div>
             </div>
         )}

         {/* Right Actions */}
         <div className="flex items-center gap-3 ml-auto flex-shrink-0">
             {onRunSimulation && (
                 <button onClick={() => { if(simStatus === 'RUNNING' && onStop) onStop(); else onRunSimulation(); }} 
                    className={`flex items-center gap-2 px-4 sm:px-6 py-2 ${simStatus === 'RUNNING' ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white text-xs font-bold rounded shadow-lg transition-all`}>
                    {simStatus === 'RUNNING' ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                    <span className="hidden sm:inline">{simStatus === 'RUNNING' ? 'STOP' : 'RERUN SIMULATION'}</span>
                    <span className="sm:hidden">{simStatus === 'RUNNING' ? 'STOP' : 'RERUN'}</span>
                 </button>
             )}
             
             {/* Primary Toolbar Exit Button */}
             <button 
                onClick={toggleFullScreen} 
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-red-900/40 text-slate-200 hover:text-red-100 border border-slate-600 hover:border-red-500 rounded transition-all text-xs font-bold whitespace-nowrap"
                title="Close Simulation View"
             >
                 <LogOut size={16} />
                 <span>EXIT</span>
             </button>
         </div>
      </div>

      {/* 2. MAIN CONTENT GRID */}
      <div className="flex-1 overflow-hidden flex relative">
          
          {/* FLOATING CLOSE BUTTON IN CHART AREA (Backup) */}
          <button 
              onClick={toggleFullScreen}
              className="absolute top-4 right-4 z-50 p-2 bg-slate-900/80 hover:bg-red-600 text-slate-400 hover:text-white rounded-full border border-slate-700 hover:border-red-400 backdrop-blur shadow-xl transition-all"
              title="Close View"
          >
              <XCircle size={24} />
          </button>

          {/* LEFT: CHART AREA */}
          <div className="flex-1 relative bg-slate-950 p-6 flex flex-col">
              {/* Chart Legend / Info Overlay could go here */}
              <div className="absolute top-6 left-6 z-10 text-xs font-mono text-slate-500">
                   <div className="flex items-center gap-2 mb-1">
                       <div className="w-3 h-3 bg-emerald-500/20 border border-emerald-500 rounded-sm"></div>
                       <span>Bankroll Performance</span>
                   </div>
                   <div className="flex items-center gap-2">
                       <div className="w-3 h-0 border-t border-dashed border-slate-500"></div>
                       <span>Breakeven (${initialBalance})</span>
                   </div>
              </div>

              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 0 }}>
                        <defs>
                            {/* Lane Gradients */}
                            {activeLanes.map(lane => (
                                <linearGradient key={lane.id} id={`fs-gradient-${lane.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={lane.color} stopOpacity={0.6}/>
                                    <stop offset="95%" stopColor={lane.color} stopOpacity={0.1}/>
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={true} horizontal={true} />
                        <XAxis 
                            dataKey="spinIndex" 
                            type="number" 
                            domain={['dataMin', 'dataMax']} 
                            stroke="#475569" 
                            fontSize={10}
                            tickCount={20}
                            tick={renderCustomXTick}
                        />
                        <YAxis 
                            domain={[minVal - padding, maxVal + padding]} 
                            stroke="#475569" 
                            fontSize={10}
                            width={40}
                            tick={renderCustomYTick}
                        />
                        <Tooltip 
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc', borderRadius: '8px' }}
                            itemStyle={{ color: '#10b981' }}
                            formatter={(value: number, name: string) => [`$${value}`, name]}
                            labelFormatter={(label) => `Spin ${label}`}
                        />
                        <ReferenceLine y={initialBalance} stroke="#64748b" strokeDasharray="3 3" />
                        
                        {/* Stacked Lanes */}
                        {activeLanes.map(lane => (
                            <Area 
                                key={lane.id}
                                name={lane.name}
                                type="monotone" 
                                dataKey={`laneBankrolls.${lane.id}`} 
                                stackId="1" 
                                stroke={lane.color} 
                                fill={`url(#fs-gradient-${lane.id})`}
                                strokeWidth={1}
                                isAnimationActive={!isAnimating}
                            />
                        ))}

                        {/* Total Bankroll Line Overlay */}
                        <Area 
                            name="Total Bankroll"
                            type="monotone" 
                            dataKey="bankroll" 
                            stroke="#10b981" 
                            strokeWidth={3}
                            fill="none" 
                            isAnimationActive={!isAnimating}
                            dot={renderResetDot}
                        />
                        
                        {/* High/Low Markers */}
                        <ReferenceDot x={maxStep.spinIndex} y={maxStep.bankroll} r={4} fill="#10b981" stroke="#064e3b" strokeWidth={2}>
                           <Label value={`$${maxStep.bankroll}`} position="top" fill="#10b981" fontSize={12} fontWeight="bold" dy={-10} />
                        </ReferenceDot>
                        <ReferenceDot x={minStep.spinIndex} y={minStep.bankroll} r={4} fill="#ef4444" stroke="#450a0a" strokeWidth={2}>
                           <Label value={`$${minStep.bankroll}`} position="bottom" fill="#ef4444" fontSize={12} fontWeight="bold" dy={10} />
                        </ReferenceDot>

                    </AreaChart>
                </ResponsiveContainer>
              </div>
              
              {/* Bottom Info Bar for Chart */}
              <div className="h-8 mt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 font-mono px-2">
                  <div className="flex items-center gap-4">
                      <button className="flex items-center gap-1 hover:text-white"><ChevronDown size={14} /> PREV</button>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                      <span>BATCH 1 - RUN 1</span>
                      <X size={12} className="cursor-pointer hover:text-white" />
                  </div>
                  <div className="flex items-center gap-4">
                      {data.length > 0 && <span className="text-emerald-400 font-bold">${data[data.length-1].bankroll} ({( (data[data.length-1].bankroll - initialBalance)/initialBalance * 100 ).toFixed(1)}% ROI)</span>}
                      <button className="flex items-center gap-1 hover:text-white">NEXT <ChevronDown size={14} className="-rotate-90" /></button>
                  </div>
              </div>
          </div>

          {/* RIGHT: STATS & LOG SIDEBAR */}
          <div className="w-80 bg-slate-900 border-l border-slate-700 flex flex-col shadow-2xl relative z-40">
              
              {/* 1. Stats Grid */}
              <div className="p-4 grid grid-cols-2 gap-3 border-b border-slate-800 bg-slate-900/50">
                  <div className="bg-slate-800 p-2 rounded border border-slate-700">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Total Spins</div>
                      <div className="text-lg font-bold text-white font-mono">{data.length}</div>
                  </div>
                  <div className="bg-slate-800 p-2 rounded border border-slate-700">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Wins / Losses</div>
                      <div className="text-lg font-bold font-mono">
                          <span className="text-emerald-400">{stats.wins}</span> <span className="text-slate-600">/</span> <span className="text-red-400">{stats.losses}</span>
                      </div>
                  </div>
                  <div className="bg-slate-800 p-2 rounded border border-slate-700">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Max Drawdown</div>
                      <div className="text-lg font-bold text-red-400 font-mono">-${stats.maxDrawdown}</div>
                  </div>
                  <div className="bg-slate-800 p-2 rounded border border-slate-700">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Max Upside</div>
                      <div className="text-lg font-bold text-emerald-400 font-mono">${stats.maxUpside}</div>
                  </div>
                  <div className="bg-slate-800 p-2 rounded border border-slate-700">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Win Streak</div>
                      <div className="text-lg font-bold text-emerald-400 font-mono">{stats.maxWinStreak}</div>
                  </div>
                  <div className="bg-slate-800 p-2 rounded border border-slate-700">
                      <div className="text-[10px] text-slate-500 font-bold uppercase">Loss Streak</div>
                      <div className="text-lg font-bold text-red-400 font-mono">{stats.maxLossStreak}</div>
                  </div>
              </div>

              {/* 2. Compact Spin Log */}
              <div className="flex items-center justify-between px-3 py-2 bg-slate-800 border-b border-slate-700">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Spin Log</span>
                  <span className="text-[10px] bg-slate-900 px-2 py-0.5 rounded text-slate-500">FULL SCREEN</span>
              </div>
              <div className="flex-1 overflow-auto custom-scrollbar bg-slate-950 relative" ref={scrollRef}>
                 <table className="w-full text-left border-collapse">
                     <thead className="sticky top-0 bg-slate-900 text-[10px] uppercase text-slate-500 font-bold shadow-sm z-10">
                         <tr>
                             <th className="px-3 py-2 w-10">#</th>
                             <th className="px-3 py-2 w-12 text-center">Result</th>
                             <th className="px-3 py-2 text-right">Bet</th>
                             <th className="px-3 py-2 text-right">Bank</th>
                         </tr>
                     </thead>
                     <tbody className="text-xs font-mono divide-y divide-slate-800">
                         {/* Render reversed copy so newest is top */}
                         {[...data].reverse().map(step => {
                             const color = getNumberColor(step.result.number);
                             const bg = color === 'red' ? 'bg-red-600' : color === 'black' ? 'bg-slate-800' : 'bg-green-600';
                             const isWin = step.outcome > 0;
                             return (
                                 <tr key={step.spinIndex} className="hover:bg-slate-900/50">
                                     <td className="px-3 py-2 text-slate-500">{step.spinIndex}</td>
                                     <td className="px-3 py-2 text-center">
                                         <div className={`w-6 h-6 rounded flex items-center justify-center text-white font-bold mx-auto shadow-sm ${bg}`}>
                                             {step.result.number}
                                         </div>
                                     </td>
                                     <td className="px-3 py-2 text-right text-slate-400">
                                         ${step.betAmount}
                                     </td>
                                     <td className="px-3 py-2 text-right font-bold text-slate-200">
                                         ${step.bankroll}
                                     </td>
                                 </tr>
                             )
                         })}
                         {data.length === 0 && (
                             <tr><td colSpan={4} className="text-center py-8 text-slate-600 italic">No spins yet</td></tr>
                         )}
                     </tbody>
                 </table>
              </div>

              {/* Sidebar Footer */}
              <div className="p-3 bg-slate-900 border-t border-slate-700 flex gap-2">
                  {onRunSimulation && (
                      <button onClick={() => { if(simStatus === 'RUNNING' && onStop) onStop(); else onRunSimulation(); }} 
                        className={`flex-1 py-2 ${simStatus === 'RUNNING' ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'} text-white text-xs font-bold rounded shadow transition-colors uppercase flex items-center justify-center gap-2`}>
                          {simStatus === 'RUNNING' ? <Square size={12} /> : <RotateCcw size={12} />}
                          {simStatus === 'RUNNING' ? 'Stop' : 'Rerun'}
                      </button>
                  )}
                  <button className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded shadow transition-colors uppercase flex items-center justify-center gap-2">
                      <Download size={12} /> CSV
                  </button>
              </div>

          </div>
      </div>

    </div>
  );
};

export default StatsChart;
