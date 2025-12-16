
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot, Label } from 'recharts';
import { SimulationStep, SimulationStatus, SimulationSpeed, SimulationSettings, ProgressionConfig, Lane } from '../core/types';
import { PlayCircle, Maximize2, Minimize2, Pause, Play, Square, Zap, Clock, MousePointerClick, RotateCcw, X, ChevronDown, Download, LogOut, ArrowLeft, XCircle, Trash2, AlertOctagon, Table, History, ChevronLeft, ChevronRight, Pencil, Check } from 'lucide-react';
import { getNumberColor } from '../core/constants';
import SpinLog from './SpinLog';

interface BatchSummary {
  id: string;
  label: string;
  timestamp: number;
  winRate: number;
  netProfit: number;
}

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

  // Sim Navigation (Within Batch)
  currentSimIndex?: number;
  totalSims?: number;
  onNextSim?: () => void;
  onPrevSim?: () => void;

  // Batch Navigation (Across Batches)
  currentBatchIndex?: number;
  totalBatches?: number;
  onNextBatch?: () => void;
  onPrevBatch?: () => void;
  onDeleteBatch?: () => void;
  
  // Batch History Dropdown
  batchList?: BatchSummary[];
  onSelectBatch?: (index: number) => void;
  onRenameBatch?: (id: string, newName: string) => void;
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
  currentSimIndex = 0,
  totalSims = 1,
  onNextSim,
  onPrevSim,
  currentBatchIndex = -1,
  totalBatches = 0,
  onNextBatch,
  onPrevBatch,
  onDeleteBatch,
  batchList = [],
  onSelectBatch,
  onRenameBatch
}) => {
  const [localIsFullScreen, setLocalIsFullScreen] = useState(false);
  const [isLogExpanded, setIsLogExpanded] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false); // Dropdown State
  
  // Renaming State
  const [isRenamingBatch, setIsRenamingBatch] = useState(false);
  const [tempBatchName, setTempBatchName] = useState("");
  
  const isFullScreen = propIsFullScreen !== undefined ? propIsFullScreen : localIsFullScreen;
  const toggleFullScreen = onToggleFullScreen || (() => setLocalIsFullScreen(prev => !prev));
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll spin log in fullscreen
  useEffect(() => {
    if (isFullScreen && scrollRef.current) {
        scrollRef.current.scrollTop = 0; 
    }
  }, [data.length, isFullScreen]);

  const activeLanes = lanes.filter(l => l.enabled);
  
  const currentBatch = batchList[currentBatchIndex];
  
  const handleStartRename = () => {
      if (currentBatch) {
          setTempBatchName(currentBatch.label);
          setIsRenamingBatch(true);
      }
  };
  
  const handleSaveRename = () => {
      if (currentBatch && onRenameBatch && tempBatchName.trim()) {
          onRenameBatch(currentBatch.id, tempBatchName.trim());
      }
      setIsRenamingBatch(false);
  };

  // --- STATS CALCULATION ---
  const { chartData, minVal, maxVal, minStep, maxStep, stats, isBust, lastStep } = useMemo(() => {
    const initialLaneBankrolls: Record<string, number> = {};
    // Start all lanes at the full initial balance for direct comparison
    const startPerLane = initialBalance; 
    activeLanes.forEach(l => { initialLaneBankrolls[l.id] = startPerLane; });

    // Explicitly type the seed step to match SimulationStep to avoid union type issues with optional properties like activeTriggers
    const seedStep: SimulationStep = {
        spinIndex: 0,
        bankroll: initialBalance,
        outcome: 0,
        laneBankrolls: initialLaneBankrolls,
        result: { value: 0, display: '-', color: 'green' },
        startingBankroll: initialBalance,
        betAmount: 0,
        laneDetails: [],
        activeTriggers: [],
        bets: [],
        betDescriptions: []
    };

    const cData = [
      seedStep,
      ...data
    ];

    // Ensure range always includes the initial balance line so gradient calc is correct
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

        // Also track lane extremes so they don't get clipped
        if (step.laneBankrolls) {
            Object.values(step.laneBankrolls).forEach(val => {
                if (val < min) min = val;
                if (val > max) max = val;
            });
        }

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
    
    // Check for premature stop
    const last = cData[cData.length - 1];
    const busted = last.activeTriggers?.some((t: string) => t.includes('Insufficient') || t.includes('STOPPED')) || false;

    return { 
        chartData: cData, 
        minVal: min, 
        maxVal: max, 
        minStep: minS, 
        maxStep: maxS, 
        stats: { wins, losses, maxWinStreak, maxLossStreak, maxDrawdown, maxUpside },
        isBust: busted,
        lastStep: last
    };
  }, [data, initialBalance, activeLanes]);

  const range = maxVal - minVal;
  // Use padding to prevent line from hugging top/bottom
  const padding = range === 0 ? (initialBalance || 100) * 0.05 : range * 0.05;
  
  // Disable animation during active simulation for instant updates
  const isAnimating = simStatus === 'RUNNING' || data.length > 100;

  // --- GRADIENT OFFSET CALCULATION ---
  const gradientOffset = () => {
    if (maxVal <= minVal) return 0;
    if (initialBalance >= maxVal) return 0; // Entire graph is below start -> All Red
    if (initialBalance <= minVal) return 1; // Entire graph is above start -> All Green
    
    // In SVG gradients for Area charts: 0 is Top, 1 is Bottom.
    // We want the area ABOVE the initialBalance line (which is visually higher, so closer to offset 0) to be Green.
    // We want the area BELOW the initialBalance line (closer to offset 1) to be Red.
    return (maxVal - initialBalance) / (maxVal - minVal);
  };
  
  const off = gradientOffset();

  // --- CUSTOM TOOLTIP ---
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const step = payload[0].payload as SimulationStep;
      const isProfit = step.bankroll >= initialBalance;
      const borderColor = isProfit ? '#4ade80' : '#ef4444'; // green-400 : red-400
      
      const isStopStep = step.activeTriggers?.some((t: string) => t.includes('STOPPED') || t.includes('Insufficient'));
      
      return (
        <div className="bg-slate-900/95 backdrop-blur p-3 rounded-lg border-2 shadow-2xl text-xs font-mono z-50 min-w-[140px]" style={{ borderColor }}>
           <div className="flex items-center justify-between gap-4 mb-2 pb-2 border-b border-slate-800">
               <span className="text-slate-300 font-bold">Spin {step.spinIndex}</span>
               {step.result && step.spinIndex > 0 && (
                   <div className={`px-2 py-0.5 rounded flex items-center justify-center font-bold text-white shadow-sm gap-1 min-w-[32px]
                       ${step.result.color === 'red' ? 'bg-red-600' : step.result.color === 'black' ? 'bg-slate-950 border border-slate-700' : 'bg-green-600'}
                   `}>
                       {step.result.display}
                   </div>
               )}
           </div>
           
           <div className="space-y-1">
               <div className="flex justify-between gap-6">
                   <span className="text-slate-500">Bankroll</span>
                   <span className={`font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                       ${step.bankroll}
                   </span>
               </div>
               {step.spinIndex > 0 && (
                   <div className="flex justify-between gap-6">
                       <span className="text-slate-500">Outcome</span>
                       <span className={step.outcome >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                           {step.outcome >= 0 ? '+' : ''}{step.outcome}
                       </span>
                   </div>
               )}
               {isStopStep && (
                   <div className="mt-2 pt-2 border-t border-red-500/30 text-red-400 font-bold flex items-center gap-1">
                       <AlertOctagon size={12} /> STOPPED
                   </div>
               )}
           </div>
        </div>
      );
    }
    return null;
  };

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
        <div className={`flex flex-col items-center justify-center gap-3 text-slate-500 border border-dashed border-slate-700 rounded-xl bg-black ${className || 'h-72'}`}>
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
        <div className={`w-full bg-black rounded-xl border border-slate-800 flex flex-col ${className || 'h-72'} transition-all duration-300 relative overflow-hidden group`}>
          
          {/* Header Overlays */}
          <div className="absolute top-0 left-0 right-0 p-3 flex items-start justify-between z-20 pointer-events-none">
             
             {/* Title with backdrop & Navigation */}
             <div className="bg-black/40 backdrop-blur-sm px-2 py-1 rounded border border-slate-800/50 pointer-events-auto flex items-center gap-2">
                 {totalBatches > 1 ? (
                    <>
                        <button onClick={(e) => { e.stopPropagation(); onPrevBatch?.(); }} disabled={currentBatchIndex === 0} className="text-slate-400 hover:text-white disabled:opacity-30"><ChevronLeft size={12} /></button>
                        <span className="font-semibold text-slate-300 text-xs uppercase tracking-wider">
                           {currentBatch?.label || `Batch ${currentBatchIndex + 1}`} <span className="text-slate-500">/ {totalBatches}</span>
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); onNextBatch?.(); }} disabled={currentBatchIndex === totalBatches - 1} className="text-slate-400 hover:text-white disabled:opacity-30"><ChevronRight size={12} /></button>
                    </>
                 ) : (
                    <h3 className="font-semibold text-slate-300 text-xs uppercase tracking-wider">Progression Lines</h3>
                 )}
             </div>
             
             {/* Controls Group */}
             <div className="flex items-center gap-2 pointer-events-auto">
                 {/* Run/Stop Button */}
                 {onRunSimulation && (
                     <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            if(simStatus === 'RUNNING' && onStop) onStop(); 
                            else if(simStatus === 'IDLE') onRunSimulation(); 
                        }} 
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded shadow-lg transition-all border backdrop-blur-sm ${
                            simStatus === 'RUNNING' 
                            ? 'bg-red-600/90 hover:bg-red-500 border-red-500 text-white' 
                            : 'bg-emerald-600/90 hover:bg-emerald-500 border-emerald-500 text-white'
                        }`}
                     >
                        {simStatus === 'RUNNING' ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                        {simStatus === 'RUNNING' ? 'STOP' : 'RUN'}
                     </button>
                 )}
                 
                 {/* Pause/Resume */}
                 {simStatus === 'RUNNING' && onPause && (
                     <button onClick={onPause} className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-amber-400 border border-slate-600 rounded backdrop-blur transition-colors"><Pause size={14}/></button>
                 )}
                 {simStatus === 'PAUSED' && onResume && (
                     <button onClick={onResume} className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-green-400 border border-slate-600 rounded backdrop-blur transition-colors"><Play size={14}/></button>
                 )}
                 
                 {/* Fullscreen */}
                 <button onClick={toggleFullScreen} className="p-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-600 rounded backdrop-blur transition-colors">
                    <Maximize2 size={14} />
                 </button>
             </div>
          </div>
          
          <div className="flex-1 w-full h-full pt-0">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} baseValue={initialBalance}>
                    <defs>
                        {activeLanes.map(lane => (
                            <linearGradient key={lane.id} id={`color-${lane.id}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={lane.color} stopOpacity={0.15}/>
                                <stop offset="95%" stopColor={lane.color} stopOpacity={0.05}/>
                            </linearGradient>
                        ))}
                        {/* Split Gradient for Total Bankroll with fading to black/transparent at the zero line */}
                        <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={0.7} /> {/* Peak: Vibrant Green */}
                          <stop offset={off} stopColor="#22c55e" stopOpacity={0.02} /> {/* Middle: Near Transparent */}
                          <stop offset={off} stopColor="#ef4444" stopOpacity={0.02} /> {/* Middle: Near Transparent */}
                          <stop offset="100%" stopColor="#ef4444" stopOpacity={0.7} /> {/* Bottom: Vibrant Red */}
                        </linearGradient>
                        
                        {/* Split Stroke Gradient */}
                        <linearGradient id="splitStroke" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4ade80" stopOpacity={1} /> {/* Green-400 */}
                          <stop offset={off} stopColor="#4ade80" stopOpacity={1} />
                          <stop offset={off} stopColor="#f87171" stopOpacity={1} /> {/* Red-400 */}
                          <stop offset="100%" stopColor="#f87171" stopOpacity={1} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <YAxis domain={[minVal - padding, maxVal + padding]} hide />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#64748b', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    <ReferenceLine y={initialBalance} stroke="#94a3b8" strokeDasharray="3 3" />
                    {/* Independent Lanes */}
                    {activeLanes.map(lane => (
                        <Area 
                            key={lane.id} 
                            type="monotone" 
                            dataKey={`laneBankrolls.${lane.id}`} 
                            stroke={lane.color} 
                            fill={`url(#color-${lane.id})`} 
                            fillOpacity={1} 
                            strokeWidth={2} 
                            isAnimationActive={!isAnimating} 
                            animationDuration={0}
                        />
                    ))}
                    {/* Main Bankroll Area with Fading Gradient */}
                    <Area 
                        type="monotone" 
                        dataKey="bankroll" 
                        baseValue={initialBalance}
                        stroke="url(#splitStroke)" 
                        fill="url(#splitColor)"
                        strokeWidth={2} 
                        isAnimationActive={!isAnimating}
                        animationDuration={0}
                        dot={renderResetDot}
                    />
                    {isBust && lastStep && (
                        <ReferenceDot x={lastStep.spinIndex} y={lastStep.bankroll} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2}>
                             <Label value="STOP" position="top" fill="#ef4444" fontSize={10} fontWeight="bold" dy={-5} />
                        </ReferenceDot>
                    )}
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

             {/* BATCH SELECTOR (With Dropdown) */}
             {totalBatches > 0 && (
               <div className="hidden lg:flex items-center gap-2 bg-slate-800 p-1 rounded-lg ml-4 border border-slate-700 relative">
                   <button 
                     onClick={onPrevBatch} 
                     disabled={currentBatchIndex <= 0}
                     className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                   >
                     <ChevronDown size={14} className="rotate-90" />
                   </button>
                   
                   <button 
                     onClick={() => setIsHistoryOpen(!isHistoryOpen)}
                     className="flex items-center gap-2 px-2 hover:bg-slate-700 rounded transition-colors group"
                   >
                       <div className="flex flex-col items-start min-w-[100px]">
                           <span className="text-[10px] text-slate-500 uppercase font-bold leading-tight flex items-center gap-1">
                               Batch
                               <span className="text-slate-600">|</span>
                               <span className="text-slate-400">{currentBatchIndex + 1}/{totalBatches}</span>
                           </span>
                           {isRenamingBatch ? (
                               <input 
                                   autoFocus
                                   value={tempBatchName}
                                   onChange={(e) => setTempBatchName(e.target.value)}
                                   onClick={(e) => e.stopPropagation()}
                                   onKeyDown={(e) => {
                                       if(e.key === 'Enter') handleSaveRename();
                                       e.stopPropagation();
                                   }}
                                   onBlur={handleSaveRename}
                                   className="bg-slate-950 text-indigo-300 font-bold text-xs border border-indigo-500/50 rounded px-1 w-full outline-none"
                               />
                           ) : (
                               <span className="text-xs font-bold text-indigo-300 leading-tight truncate max-w-[140px] text-left">
                                   {currentBatch?.label || 'Batch'}
                               </span>
                           )}
                       </div>
                       <ChevronDown size={12} className={`text-slate-500 transition-transform ${isHistoryOpen ? 'rotate-180' : ''}`} />
                   </button>

                   {/* Rename Trigger Button */}
                   {!isRenamingBatch && onRenameBatch && (
                       <button 
                           onClick={(e) => { e.stopPropagation(); handleStartRename(); }}
                           className="p-1 hover:bg-slate-700 rounded text-slate-500 hover:text-white"
                           title="Rename Batch"
                       >
                           <Pencil size={10} />
                       </button>
                   )}
                   
                   <button 
                     onClick={onNextBatch} 
                     disabled={currentBatchIndex >= totalBatches - 1}
                     className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                   >
                     <ChevronDown size={14} className="-rotate-90" />
                   </button>

                   {onDeleteBatch && (
                     <div className="w-px h-4 bg-slate-600 mx-1" />
                   )}

                   {onDeleteBatch && (
                     <button 
                       onClick={onDeleteBatch} 
                       className="p-1 hover:bg-red-900/50 rounded text-slate-500 hover:text-red-400"
                       title="Delete Batch"
                     >
                       <Trash2 size={12} />
                     </button>
                   )}

                   {/* DROPDOWN MENU */}
                   {isHistoryOpen && (
                       <>
                           <div className="fixed inset-0 z-40" onClick={() => setIsHistoryOpen(false)} />
                           <div className="absolute top-full left-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden flex flex-col max-h-[300px]">
                               <div className="px-3 py-2 bg-slate-950 border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                   <History size={12} /> Simulation History
                               </div>
                               <div className="overflow-y-auto custom-scrollbar flex-1">
                                   {batchList.slice().reverse().map((b, revIdx) => {
                                       // Reverse index calculation
                                       const actualIndex = batchList.length - 1 - revIdx;
                                       const isActive = actualIndex === currentBatchIndex;
                                       return (
                                           <button 
                                               key={b.id}
                                               onClick={() => { onSelectBatch?.(actualIndex); setIsHistoryOpen(false); }}
                                               className={`w-full text-left px-3 py-2 border-b border-slate-800 hover:bg-slate-800 transition-colors flex items-center justify-between group ${isActive ? 'bg-slate-800/50' : ''}`}
                                           >
                                               <div className="flex-1 min-w-0 pr-2">
                                                   <div className={`text-xs font-bold truncate ${isActive ? 'text-indigo-300' : 'text-slate-300'}`}>
                                                       {b.label}
                                                   </div>
                                                   <div className="text-[10px] text-slate-500">
                                                       {new Date(b.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                                                   </div>
                                               </div>
                                               <div className="text-right shrink-0">
                                                   <div className={`text-xs font-bold font-mono ${b.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                       {b.netProfit >= 0 ? '+' : ''}{b.netProfit.toFixed(0)}
                                                   </div>
                                                   <div className="text-[9px] text-slate-500">
                                                       Win Rate {(b.winRate * 100).toFixed(0)}%
                                                   </div>
                                               </div>
                                           </button>
                                       )
                                   })}
                               </div>
                           </div>
                       </>
                   )}
               </div>
             )}
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
          
          {/* LOG EXPANSION OVERLAY */}
          {isLogExpanded && (
              <div className="absolute inset-0 z-[60] bg-slate-950 flex flex-col animate-in fade-in duration-200">
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-700 shrink-0">
                       <div className="flex items-center gap-2">
                           <div className="p-1.5 bg-indigo-500/20 rounded text-indigo-400"><Table size={16} /></div>
                           <div>
                               <h3 className="font-bold text-slate-200 text-sm uppercase tracking-wider">Detailed Spin Log</h3>
                               <p className="text-[10px] text-slate-500">{data.length} Spins Recorded</p>
                           </div>
                       </div>
                       <button 
                           onClick={() => setIsLogExpanded(false)} 
                           className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded transition-all text-xs font-bold"
                       >
                           <Minimize2 size={14} /> EXIT VIEW
                       </button>
                  </div>
                  <div className="flex-1 overflow-hidden p-0 relative">
                       <SpinLog history={data} lanes={lanes} className="h-full w-full border-none rounded-none bg-slate-950" />
                  </div>
              </div>
          )}
          
          {/* FLOATING CLOSE BUTTON IN CHART AREA (Backup) */}
          <button 
              onClick={toggleFullScreen}
              className="absolute top-4 right-4 z-50 p-2 bg-slate-900/80 hover:bg-red-600 text-slate-400 hover:text-white rounded-full border border-slate-700 hover:border-red-400 backdrop-blur shadow-xl transition-all"
              title="Close View"
          >
              <XCircle size={24} />
          </button>

          {/* LEFT: CHART AREA */}
          <div className="flex-1 relative bg-black p-6 flex flex-col">
              {/* Chart Legend / Info Overlay */}
              <div className="absolute top-6 left-6 z-10 text-xs font-mono text-slate-500">
                   <div className="flex items-center gap-2 mb-1">
                       <div className="w-3 h-3 bg-emerald-500/30 border border-emerald-500 rounded-sm"></div>
                       <span>Profit</span>
                   </div>
                   <div className="flex items-center gap-2 mb-1">
                       <div className="w-3 h-3 bg-red-500/30 border border-red-500 rounded-sm"></div>
                       <span>Loss</span>
                   </div>
                   <div className="flex items-center gap-2">
                       <div className="w-3 h-0 border-t border-dashed border-slate-500"></div>
                       <span>Breakeven (${initialBalance})</span>
                   </div>
              </div>

              <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 0 }} baseValue={initialBalance}>
                        <defs>
                            {/* Lane Gradients */}
                            {activeLanes.map(lane => (
                                <linearGradient key={lane.id} id={`fs-gradient-${lane.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={lane.color} stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor={lane.color} stopOpacity={0.05}/>
                                </linearGradient>
                            ))}
                            {/* Split Gradient for Total Bankroll with fading to black/transparent at the zero line */}
                            <linearGradient id="fs-splitColor" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} /> {/* Peak: Vibrant Green */}
                              <stop offset={off} stopColor="#22c55e" stopOpacity={0.02} /> {/* Middle: Near Transparent */}
                              <stop offset={off} stopColor="#ef4444" stopOpacity={0.02} /> {/* Middle: Near Transparent */}
                              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.9} /> {/* Bottom: Vibrant Red */}
                            </linearGradient>
                            
                            {/* Split Stroke Gradient */}
                            <linearGradient id="fs-splitStroke" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#4ade80" stopOpacity={1} /> {/* Green-400 */}
                              <stop offset={off} stopColor="#4ade80" stopOpacity={1} />
                              <stop offset={off} stopColor="#f87171" stopOpacity={1} /> {/* Red-400 */}
                              <stop offset="100%" stopColor="#f87171" stopOpacity={1} />
                            </linearGradient>
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
                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#64748b', strokeWidth: 1, strokeDasharray: '4 4' }} />
                        <ReferenceLine y={initialBalance} stroke="#64748b" strokeDasharray="3 3" />
                        
                        {/* Stacked Lanes - No StackId */}
                        {activeLanes.map(lane => (
                            <Area 
                                key={lane.id}
                                name={lane.name}
                                type="monotone" 
                                dataKey={`laneBankrolls.${lane.id}`} 
                                stroke={lane.color} 
                                fill={`url(#fs-gradient-${lane.id})`}
                                strokeWidth={2}
                                fillOpacity={1}
                                isAnimationActive={!isAnimating} 
                                animationDuration={0}
                            />
                        ))}

                        {/* Total Bankroll Line Overlay - BaseValue creates the bidirectional fill */}
                        <Area 
                            name="Total Bankroll"
                            type="monotone" 
                            dataKey="bankroll" 
                            baseValue={initialBalance}
                            stroke="url(#fs-splitStroke)" 
                            fill="url(#fs-splitColor)"
                            strokeWidth={3}
                            isAnimationActive={!isAnimating}
                            animationDuration={0}
                            dot={renderResetDot}
                        />
                        
                        {/* High/Low Markers */}
                        <ReferenceDot x={maxStep.spinIndex} y={maxStep.bankroll} r={4} fill="#10b981" stroke="#064e3b" strokeWidth={2}>
                           <Label value={`$${maxStep.bankroll}`} position="top" fill="#10b981" fontSize={12} fontWeight="bold" dy={-10} />
                        </ReferenceDot>
                        <ReferenceDot x={minStep.spinIndex} y={minStep.bankroll} r={4} fill="#ef4444" stroke="#450a0a" strokeWidth={2}>
                           <Label value={`$${minStep.bankroll}`} position="bottom" fill="#ef4444" fontSize={12} fontWeight="bold" dy={10} />
                        </ReferenceDot>
                        
                        {/* Stop Indicator */}
                        {isBust && lastStep && (
                            <ReferenceDot x={lastStep.spinIndex} y={lastStep.bankroll} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2}>
                                 <Label value="STOP" position="top" fill="#ef4444" fontSize={10} fontWeight="bold" dy={-5} />
                            </ReferenceDot>
                        )}

                    </AreaChart>
                </ResponsiveContainer>
              </div>
              
              {/* Bottom Info Bar for Chart */}
              <div className="h-8 mt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500 font-mono px-2">
                  <div className="flex items-center gap-4">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onPrevSim?.(); }} 
                        disabled={!onPrevSim || currentSimIndex === 0}
                        className="flex items-center gap-1 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <ChevronDown size={14} className="rotate-90" /> PREV
                      </button>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                      <span>RUN {currentSimIndex + 1} <span className="text-slate-600">/</span> {totalSims}</span>
                  </div>
                  <div className="flex items-center gap-4">
                      {data.length > 0 && <span className={data[data.length-1].bankroll >= initialBalance ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>${data[data.length-1].bankroll} ({( (data[data.length-1].bankroll - initialBalance)/initialBalance * 100 ).toFixed(1)}% ROI)</span>}
                      <button 
                        onClick={(e) => { e.stopPropagation(); onNextSim?.(); }} 
                        disabled={!onNextSim || (currentSimIndex !== undefined && totalSims !== undefined && currentSimIndex >= totalSims - 1)}
                        className="flex items-center gap-1 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        NEXT <ChevronDown size={14} className="-rotate-90" />
                      </button>
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
                  <button 
                      onClick={() => setIsLogExpanded(true)} 
                      className="text-[10px] bg-indigo-900/50 hover:bg-indigo-600 px-2 py-0.5 rounded text-indigo-300 hover:text-white transition-colors font-bold uppercase flex items-center gap-1"
                  >
                      <Maximize2 size={10} /> Full Screen
                  </button>
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
                         {/* Render chronological so Spin 1 is top */}
                         {data.map(step => {
                             const color = getNumberColor(step.result.value);
                             const bg = color === 'red' ? 'bg-red-600' : color === 'black' ? 'bg-slate-800' : 'bg-green-600';
                             const isWin = step.outcome > 0;
                             return (
                                 <tr key={step.spinIndex} className="hover:bg-slate-900/50">
                                     <td className="px-3 py-2 text-slate-500">{step.spinIndex}</td>
                                     <td className="px-3 py-2 text-center">
                                         <div className={`w-6 h-6 rounded flex items-center justify-center text-white font-bold mx-auto shadow-sm ${bg}`}>
                                             {step.result.display}
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
