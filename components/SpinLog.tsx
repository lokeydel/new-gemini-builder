
import React, { useState, useMemo } from 'react';
import { SimulationStep, Lane, BetType, EvaluatedBet } from '../core/types';
import { getNumberColor, PAYOUTS } from '../core/constants';
import { ArrowDown, ArrowUp, Minus, History, Maximize2, Minimize2, Zap, Download, ChevronDown, FileText, CheckCircle2, LogOut, ArrowLeft, XCircle, RotateCcw, Calculator, Search, Filter, Link, Layers } from 'lucide-react';

interface SpinLogProps {
  history: SimulationStep[];
  lanes: Lane[];
  activeLaneId?: string; // Optional prop to default or highlight active lane
  className?: string;
}

const SpinLog: React.FC<SpinLogProps> = ({ history, lanes, activeLaneId, className }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [expandedSpinIndex, setExpandedSpinIndex] = useState<number | null>(null);
  
  // Filter state: 'ALL' or specific laneId
  const [filterLaneId, setFilterLaneId] = useState<string>('ALL');

  // Display reverse chronologically (Newest/Last Spin at top)
  const displayHistory = [...history].reverse(); 
  const activeLanes = lanes.filter(l => l.enabled);

  const containerClass = isFullScreen 
    ? "fixed inset-0 z-[9999] bg-slate-950 flex flex-col shadow-2xl transition-all duration-300 animate-in fade-in" 
    : `flex flex-col bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg ${className || 'h-96'}`;

  const toggleExpand = (index: number) => {
      setExpandedSpinIndex(expandedSpinIndex === index ? null : index);
  };

  // Helper to extract data based on filter
  const getStepData = (step: SimulationStep) => {
      if (filterLaneId === 'ALL') {
          return {
              start: step.startingBankroll,
              net: step.outcome,
              end: step.bankroll,
              bets: step.bets || [],
              triggers: step.activeTriggers || []
          };
      } else {
          // Specific Lane Data
          const laneDetail = step.laneDetails?.find(d => d.laneId === filterLaneId);
          const currentLaneBalance = step.laneBankrolls[filterLaneId] || 0;
          const profit = laneDetail?.profit || 0;
          const start = currentLaneBalance - profit;
          
          const relevantBets = (step.bets || []).filter(b => b.laneId === filterLaneId);
          // Filter triggers that look like they belong to this lane (if naming convention holds) 
          // or just show all triggers as they are informational
          // For strictness, we might want to tag triggers with laneIds in the future, but for now show all or filter by string check if possible.
          
          return {
              start,
              net: profit,
              end: currentLaneBalance,
              bets: relevantBets,
              triggers: step.activeTriggers || []
          };
      }
  };

  // Format bets into a readable string
  const formatBets = (bets: EvaluatedBet[], descriptions: string[] | undefined): string => {
      if (bets && bets.length > 0) {
          // If filtering by ALL, maybe group by lane? For now just list them.
          if (bets.length > 5) return `${bets.length} bets ($${bets.reduce((a,b)=>a+b.amount,0)})`;
          return bets.map(b => {
              const prefix = filterLaneId === 'ALL' && lanes.length > 1 ? `[${lanes.find(l=>l.id===b.laneId)?.name.substring(0,1)}] ` : '';
              return `${prefix}${b.placement.displayName} $${b.amount}`;
          }).join(', ');
      }
      // Fallback for legacy
      if (descriptions && filterLaneId === 'ALL') {
          return descriptions.join(', ').replace(/Lane \d+: /g, '');
      }
      return '-';
  };

  const handleExportCSV = () => {
      if (history.length === 0) return;

      let headers = ['Spin', 'Number', 'Result_Color', 'Selected_Lane', 'TotalBet', 'NetPL', 'StartBalance', 'EndBalance', 'Bets_Detail'];
      let filename = `roulette_sim_${filterLaneId === 'ALL' ? 'global' : 'lane'}_${Date.now()}`;

      const rowMapper = (step: SimulationStep) => {
          const data = getStepData(step);
          const betStr = data.bets.map(b => `[${b.placement.displayName}: $${b.amount}]`).join(' ');
          
          return [
              step.spinIndex,
              step.result.display,
              step.result.color,
              filterLaneId === 'ALL' ? 'GLOBAL' : lanes.find(l=>l.id===filterLaneId)?.name || filterLaneId,
              data.bets.reduce((sum, b) => sum + b.amount, 0),
              data.net,
              data.start,
              data.end,
              `"${betStr}"`
          ];
      };

      const rows = history.map(step => rowMapper(step).join(','));
      const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\n" + rows.join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${filename}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const HeaderContent = () => (
     <div className={`flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700 shrink-0 ${isFullScreen ? 'h-16 shadow-md' : ''}`}>
         <div className="flex items-center gap-4">
            {isFullScreen && (
                <button 
                    onClick={() => setIsFullScreen(false)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg transition-all text-xs font-bold"
                >
                    <ArrowLeft size={16} /> BACK
                </button>
            )}

            <div className="flex items-center gap-3">
                {!isFullScreen && <History size={16} className="text-indigo-400" />}
                <h3 className={`font-bold text-slate-300 uppercase tracking-wider ${isFullScreen ? 'text-lg' : 'text-sm'}`}>
                    Spin Log
                </h3>
                
                {/* Lane Filter Dropdown */}
                <div className="relative group">
                    <button className="flex items-center gap-1.5 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-white font-bold hover:border-indigo-500 transition-colors">
                        <Layers size={12} className="text-slate-400" />
                        {filterLaneId === 'ALL' ? 'Global Portfolio' : lanes.find(l => l.id === filterLaneId)?.name || 'Unknown Lane'}
                        <ChevronDown size={10} />
                    </button>
                    <div className="absolute top-full left-0 mt-1 w-40 bg-slate-800 border border-slate-700 rounded shadow-xl z-50 hidden group-hover:block">
                        <div 
                            className={`px-3 py-2 text-xs cursor-pointer hover:bg-slate-700 ${filterLaneId === 'ALL' ? 'text-indigo-400 font-bold' : 'text-slate-300'}`}
                            onClick={() => setFilterLaneId('ALL')}
                        >
                            Global Portfolio
                        </div>
                        <div className="h-px bg-slate-700 mx-2"></div>
                        {lanes.map(l => (
                            <div 
                                key={l.id}
                                className={`px-3 py-2 text-xs cursor-pointer hover:bg-slate-700 flex items-center gap-2 ${filterLaneId === l.id ? 'text-white font-bold bg-slate-700' : 'text-slate-300'}`}
                                onClick={() => setFilterLaneId(l.id)}
                            >
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }}></div>
                                {l.name}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
         </div>

         <div className="flex items-center gap-2">
            <button
                onClick={handleExportCSV}
                disabled={history.length === 0}
                className="flex items-center gap-1 px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30 rounded text-xs font-bold transition-colors disabled:opacity-30"
            >
                <Download size={12} /> CSV
            </button>

            {isFullScreen ? (
                <button
                    onClick={() => setIsFullScreen(false)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-all"
                >
                    <Minimize2 size={18} />
                </button>
            ) : (
                <button
                    onClick={() => setIsFullScreen(true)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-all"
                    title="Fullscreen"
                >
                    <Maximize2 size={16} />
                </button>
            )}
         </div>
      </div>
  );

  return (
    <div className={containerClass}>
      <HeaderContent />
      
      <div className={`flex-1 overflow-y-auto custom-scrollbar p-0 ${isFullScreen ? 'bg-slate-950 p-6' : 'bg-slate-900/20'}`}>
        <table className="w-full text-left text-sm border-collapse table-fixed">
            <thead className="sticky top-0 z-10 bg-slate-900 shadow-sm border-b border-slate-700">
                <tr>
                    <th className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-10 text-center">#</th>
                    <th className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-12 text-center">Res</th>
                    <th className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-auto">Bets {filterLaneId !== 'ALL' && <span className="text-[9px] font-normal text-slate-600">({lanes.find(l=>l.id===filterLaneId)?.name})</span>}</th>
                    <th className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-16 text-right">Start</th>
                    <th className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-16 text-right">Net</th>
                    <th className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-16 text-right">End</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
                {history.length === 0 ? (
                    <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-slate-500 italic text-xs">
                            No spins recorded.
                        </td>
                    </tr>
                ) : (
                    displayHistory.map((step, idx) => {
                        const data = getStepData(step);
                        const color = getNumberColor(step.result.value); // Use value for color check
                        const numBg = color === 'red' ? 'bg-red-600' : color === 'black' ? 'bg-slate-800' : 'bg-green-600';
                        const plClass = data.net > 0 ? 'text-emerald-400' : data.net < 0 ? 'text-red-400' : 'text-slate-500';
                        const betsString = formatBets(data.bets, step.betDescriptions);
                        const isExpanded = expandedSpinIndex === step.spinIndex;
                        
                        // Check for gap (audit check)
                        const prevStep = displayHistory[idx + 1];
                        let isContinuityBroken = false;
                        if (prevStep) {
                            const prevData = getStepData(prevStep);
                            if (Math.abs(prevData.end - data.start) > 0.01) isContinuityBroken = true;
                        }

                        return (
                            <React.Fragment key={step.spinIndex}>
                                <tr 
                                    onClick={() => toggleExpand(step.spinIndex)}
                                    className={`group cursor-pointer transition-colors border-none ${isExpanded ? 'bg-slate-800' : 'hover:bg-slate-800/50'}`}
                                >
                                    {/* Spin Index */}
                                    <td className="px-2 py-2 text-center text-slate-500 font-mono text-xs">
                                        {step.spinIndex}
                                    </td>

                                    {/* Result Number */}
                                    <td className="px-2 py-2 text-center">
                                        <div className={`inline-flex items-center justify-center w-6 h-6 rounded font-bold text-xs text-white shadow-sm ${numBg}`}>
                                            {step.result.display}
                                        </div>
                                    </td>

                                    {/* Bets String */}
                                    <td className="px-2 py-2 text-xs text-slate-400 truncate font-mono" title={betsString}>
                                        {betsString || <span className="opacity-50">-</span>}
                                    </td>

                                    {/* Start Balance */}
                                    <td className="px-2 py-2 text-right font-mono text-xs text-slate-500 relative">
                                        {isContinuityBroken && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 text-red-500" title="Balance Discontinuity Detected">
                                                <Link size={10} />
                                            </div>
                                        )}
                                        ${data.start.toFixed(0)}
                                    </td>

                                    {/* Net P/L */}
                                    <td className={`px-2 py-2 text-right font-mono text-xs font-bold ${plClass}`}>
                                        {data.net > 0 ? '+' : ''}{data.net}
                                    </td>

                                    {/* End Balance */}
                                    <td className="px-2 py-2 text-right font-mono text-xs text-indigo-300 font-bold">
                                        ${data.end.toFixed(0)}
                                    </td>
                                </tr>

                                {/* Detail View (Math Proof) */}
                                {isExpanded && (
                                    <tr className="bg-slate-900/50 shadow-inner">
                                        <td colSpan={6} className="p-0">
                                            <div className="border-t border-slate-700/50 p-3 flex flex-col gap-2">
                                                
                                                {/* Logic Proof */}
                                                <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-mono bg-slate-950/50 p-2 rounded border border-slate-800">
                                                    <span className="text-slate-400">START</span>
                                                    <span className="text-white font-bold">${data.start.toFixed(0)}</span>
                                                    <span className="text-slate-600">+</span>
                                                    <span className="text-slate-400">NET</span>
                                                    <span className={`font-bold ${plClass}`}>${data.net}</span>
                                                    <span className="text-slate-600">=</span>
                                                    <span className="text-slate-400">END</span>
                                                    <span className="text-indigo-300 font-bold">${data.end.toFixed(0)}</span>
                                                </div>

                                                {/* Detailed Bet Breakdown */}
                                                {data.bets.length > 0 && (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                                                        {data.bets.map((b, i) => (
                                                            <div key={i} className="flex justify-between bg-slate-800/50 px-2 py-1 rounded text-[10px]">
                                                                <span className="text-slate-300">{b.placement.displayName}</span>
                                                                <div className="flex gap-2">
                                                                    <span className="text-slate-500">Bet: ${b.amount}</span>
                                                                    <span className={b.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}>
                                                                        {b.netProfit >= 0 ? '+' : ''}{b.netProfit}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Triggers */}
                                                {data.triggers.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                        {data.triggers.map((t, i) => (
                                                            <span key={i} className="px-2 py-0.5 bg-orange-900/20 text-orange-300 text-[9px] rounded border border-orange-500/20 flex items-center gap-1">
                                                                <Zap size={8} /> {t}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}

                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        );
                    })
                )}
            </tbody>
        </table>
      </div>
    </div>
  );
};

export default SpinLog;
