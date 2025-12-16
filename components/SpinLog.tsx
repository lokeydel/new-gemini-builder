
import React, { useState } from 'react';
import { SimulationStep, Lane } from '../core/types';
import { getNumberColor } from '../core/constants';
import { History, Maximize2, Minimize2, Download, ArrowLeft, CornerDownRight, AlertTriangle } from 'lucide-react';

interface SpinLogProps {
  history: SimulationStep[];
  lanes: Lane[];
  activeLaneId?: string; // Optional prop to default or highlight active lane
  className?: string;
}

const SpinLog: React.FC<SpinLogProps> = ({ history, lanes, activeLaneId, className }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [expandedSpinIndex, setExpandedSpinIndex] = useState<number | null>(null);
  
  // Display chronologically (Spin 1 at top)
  const displayHistory = history; 

  const containerClass = isFullScreen 
    ? "fixed inset-0 z-[9999] bg-slate-950 flex flex-col shadow-2xl transition-all duration-300 animate-in fade-in" 
    : `flex flex-col bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg ${className || 'h-96'}`;

  const toggleExpand = (index: number) => {
      setExpandedSpinIndex(expandedSpinIndex === index ? null : index);
  };

  const handleExportCSV = () => {
      if (history.length === 0) return;

      let headers = ['Spin', 'Number', 'Result_Color', 'Lane', 'Progression', 'Wager', 'Lane_PL', 'Lane_Balance_After', 'Global_Balance_After'];
      let filename = `roulette_sim_detailed_${Date.now()}`;

      // Flat map so each lane gets a row
      const rows: string[] = [];
      
      history.forEach(step => {
          if (!step.laneDetails || step.laneDetails.length === 0) {
              // Fallback for empty/bankruptcy rows
              const reason = step.activeTriggers?.join(' | ') || step.betDescriptions?.join(' | ') || 'BLOCKED';
              rows.push([
                  step.spinIndex, step.result.display, step.result.color, 'GLOBAL', `"${reason}"`, step.betAmount, step.outcome, step.bankroll, step.bankroll
              ].join(','));
          } else {
              step.laneDetails.forEach(d => {
                  rows.push([
                      step.spinIndex,
                      step.result.display,
                      step.result.color,
                      d.laneName,
                      `"${d.progressionLabel}"`,
                      d.wager,
                      d.profit,
                      d.balanceAfter,
                      step.bankroll
                  ].join(','));
              });
          }
      });

      const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\n" + rows.join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${filename}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // Helper to format the Lane Delta string: "L1-2(Fib0)/L2+5(reset)"
  const getLaneDeltaString = (step: SimulationStep) => {
      if (!step.laneDetails || step.laneDetails.length === 0) {
          // Handle Bankruptcy / Stops
          if (step.activeTriggers?.some(t => t.includes('Insufficient'))) {
              return <span className="text-red-400 font-bold flex items-center gap-1"><AlertTriangle size={10}/> BLOCKED: Insufficient Funds</span>;
          }
          if (step.betDescriptions?.some(d => d.includes('Bankruptcy'))) {
              return <span className="text-red-400 font-bold flex items-center gap-1"><AlertTriangle size={10}/> BLOCKED: Bankruptcy</span>;
          }
          return <span className="text-slate-500">-</span>;
      }

      return step.laneDetails.map((d, i) => {
          const plSign = d.profit > 0 ? '+' : ''; 
          
          let meta = '';
          if (d.wasReset) {
              meta = '(reset)';
          } else if (d.progressionLabel) {
             meta = `(${d.progressionLabel})`;
          }

          // Abbreviate Lane Name: "Lane 1" -> "L1"
          // Match digits at end of name
          const match = d.laneName.match(/(\d+)$/);
          const shortName = match ? `L${match[1]}` : d.laneName.substring(0, 2).toUpperCase();
          
          return (
              <span key={i} className="whitespace-nowrap inline-block">
                  <span className="text-slate-400 font-bold text-[10px]">{shortName}</span>
                  <span className={`font-mono font-bold text-xs ${d.profit > 0 ? 'text-emerald-400' : d.profit < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                      {plSign}{d.profit}
                  </span>
                  {meta && (
                      <span className={`ml-0.5 text-[9px] ${d.wasReset ? 'text-purple-400 font-bold uppercase' : 'text-slate-500'}`}>
                          {meta}
                      </span>
                  )}
                  {i < step.laneDetails.length - 1 && <span className="mx-1.5 text-slate-600">/</span>}
              </span>
          );
      });
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

            <div className="flex items-center gap-2">
                {!isFullScreen && <History size={16} className="text-indigo-400" />}
                <h3 className={`font-bold text-slate-300 uppercase tracking-wider ${isFullScreen ? 'text-lg' : 'text-sm'}`}>
                    Spin Log
                </h3>
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
                    <th className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-20 text-center">Lanes</th>
                    <th className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-16 text-right">Start $</th>
                    <th className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-14 text-right">Net $</th>
                    <th className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-16 text-right">End $</th>
                    <th className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider pl-4">Lane Δ</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
                {history.length === 0 ? (
                    <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-slate-500 italic text-xs">
                            No spins recorded.
                        </td>
                    </tr>
                ) : (
                    displayHistory.map((step, idx) => {
                        const color = getNumberColor(step.result.value); 
                        const numBg = color === 'red' ? 'bg-red-600' : color === 'black' ? 'bg-slate-800' : 'bg-green-600';
                        const plClass = step.outcome > 0 ? 'text-emerald-400' : step.outcome < 0 ? 'text-red-400' : 'text-slate-500';
                        const isExpanded = expandedSpinIndex === step.spinIndex;
                        
                        // Active Lanes Summary
                        const activeLanesStr = (step.laneDetails || []).map(l => {
                            const match = l.laneName.match(/(\d+)$/);
                            return match ? `L${match[1]}` : 'Lx';
                        }).join(',');

                        return (
                            <React.Fragment key={step.spinIndex}>
                                <tr 
                                    onClick={() => toggleExpand(step.spinIndex)}
                                    className={`group cursor-pointer transition-colors border-none ${isExpanded ? 'bg-slate-800' : 'hover:bg-slate-800/50'}`}
                                >
                                    {/* Spin Index */}
                                    <td className="px-2 py-2 text-center text-slate-500 font-mono text-xs border-r border-slate-800/50">
                                        {step.spinIndex}
                                    </td>

                                    {/* Result Number */}
                                    <td className="px-2 py-2 text-center border-r border-slate-800/50">
                                        <div className={`inline-flex items-center justify-center w-6 h-6 rounded font-bold text-xs text-white shadow-sm ${numBg}`}>
                                            {step.result.display}
                                        </div>
                                    </td>

                                    {/* Active Lanes (L1,L2) */}
                                    <td className="px-2 py-2 text-xs text-slate-400 font-mono text-center truncate border-r border-slate-800/50">
                                        {activeLanesStr || '-'}
                                    </td>

                                    {/* Global Start Balance */}
                                    <td className="px-2 py-2 text-right font-mono text-xs text-slate-500 border-r border-slate-800/50">
                                        ${step.startingBankroll.toFixed(0)}
                                    </td>

                                    {/* Net P/L */}
                                    <td className={`px-2 py-2 text-right font-mono text-xs font-bold border-r border-slate-800/50 ${plClass}`}>
                                        {step.outcome > 0 ? '+' : ''}{step.outcome}
                                    </td>

                                    {/* End Balance */}
                                    <td className="px-2 py-2 text-right font-mono text-xs text-indigo-300 font-bold border-r border-slate-800/50">
                                        ${step.bankroll.toFixed(0)}
                                    </td>

                                    {/* Lane Delta String */}
                                    <td className="px-2 py-2 pl-4 text-xs font-mono whitespace-nowrap overflow-x-auto custom-scrollbar">
                                        {getLaneDeltaString(step)}
                                    </td>
                                </tr>

                                {/* Detail View (Lane Breakdown Table) */}
                                {isExpanded && step.laneDetails && step.laneDetails.length > 0 && (
                                    <tr className="bg-slate-900/50 shadow-inner">
                                        <td colSpan={7} className="p-0">
                                            <div className="border-t border-slate-700/50">
                                                <div className="bg-slate-950/30 px-3 py-2 border-b border-slate-800/50 flex items-center gap-2 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                                                    <CornerDownRight size={12} />
                                                    Detailed Breakdown
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left">
                                                        <thead className="text-[9px] text-slate-500 bg-slate-900/50 border-b border-slate-800 uppercase">
                                                            <tr>
                                                                <th className="px-3 py-1.5 font-bold">Lane Name</th>
                                                                <th className="px-3 py-1.5 font-bold">Progression State</th>
                                                                <th className="px-3 py-1.5 font-bold text-right">Wager</th>
                                                                <th className="px-3 py-1.5 font-bold text-center">Result</th>
                                                                <th className="px-3 py-1.5 font-bold text-right">P/L</th>
                                                                <th className="px-3 py-1.5 font-bold text-right">Balance</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-800/50">
                                                            {step.laneDetails.map((detail, dIdx) => {
                                                                const isWin = detail.profit >= 0;
                                                                const statusColor = detail.profit > 0 ? 'text-emerald-400' : detail.profit < 0 ? 'text-red-400' : 'text-slate-500';
                                                                const laneColor = lanes.find(l => l.id === detail.laneId)?.color || '#64748b';
                                                                
                                                                return (
                                                                    <tr key={dIdx} className="hover:bg-slate-800/30 transition-colors">
                                                                        <td className="px-3 py-2 text-xs font-bold text-white flex items-center gap-2">
                                                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: laneColor }} />
                                                                            {detail.laneName}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-[10px] font-mono text-slate-400">
                                                                            {detail.progressionLabel}
                                                                            {detail.wasReset && <span className="ml-2 text-purple-400 font-bold text-[9px] px-1 py-0.5 bg-purple-900/30 rounded border border-purple-500/20">RESET</span>}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-right text-xs font-mono text-slate-300">
                                                                            ${detail.wager}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-center">
                                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isWin ? (detail.profit === 0 ? 'bg-slate-700 text-slate-300' : 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/20') : 'bg-red-900/30 text-red-400 border border-red-500/20'}`}>
                                                                                {detail.profit > 0 ? 'WIN' : detail.profit < 0 ? 'LOSS' : 'PUSH'}
                                                                            </span>
                                                                        </td>
                                                                        <td className={`px-3 py-2 text-right text-xs font-mono font-bold ${statusColor}`}>
                                                                            {detail.profit > 0 ? '+' : ''}{detail.profit}
                                                                        </td>
                                                                        <td className="px-3 py-2 text-right text-xs font-mono text-indigo-200/70">
                                                                            ${detail.balanceAfter.toFixed(0)}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
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
