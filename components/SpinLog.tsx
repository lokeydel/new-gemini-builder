import React, { useState } from 'react';
import { SimulationStep, Lane } from '../core/types';
import { getNumberColor } from '../core/constants';
import { ArrowDown, ArrowUp, Minus, History, Maximize2, Minimize2, Zap, Download, ChevronDown, FileText, CheckCircle2, LogOut, ArrowLeft, XCircle } from 'lucide-react';

interface SpinLogProps {
  history: SimulationStep[];
  lanes: Lane[];
  className?: string;
}

const SpinLog: React.FC<SpinLogProps> = ({ history, lanes, className }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // Display reverse chronologically (Newest/Last Spin at top)
  const displayHistory = [...history].reverse(); 
  const activeLanes = lanes.filter(l => l.enabled);

  const containerClass = isFullScreen 
    ? "fixed inset-0 z-[9999] bg-slate-950 flex flex-col shadow-2xl transition-all duration-300 animate-in fade-in" 
    : `flex flex-col bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg ${className || 'h-96'}`;

  const handleExportCSV = (scope: 'FULL' | 'GLOBAL' | string) => {
      if (history.length === 0) return;

      let headers = ['Spin', 'Result', 'Color'];
      let filename = 'roulette_sim';
      let rowMapper: (step: SimulationStep) => (string | number)[];

      if (scope === 'FULL') {
          const laneHeaders = activeLanes.flatMap(l => [`${l.name} Profit`, `${l.name} Balance`]);
          headers = [...headers, 'Total Bet', 'Total P/L', 'Global Balance', 'Triggers', 'Bets', ...laneHeaders];
          filename += '_full';
          
          rowMapper = (step) => {
              const triggers = step.activeTriggers ? `"${step.activeTriggers.join('; ')}"` : '';
              const bets = step.betDescriptions ? `"${step.betDescriptions.join(' | ')}"` : '';
              const laneData = activeLanes.flatMap(l => {
                  const detail = step.laneDetails?.find(d => d.laneId === l.id);
                  const balance = step.laneBankrolls[l.id];
                  return [detail?.profit ?? 0, balance ?? 0];
              });
              return [
                  step.spinIndex, step.result.number, step.result.color,
                  step.betAmount, step.outcome, step.bankroll, triggers, bets, ...laneData
              ];
          };
      } else if (scope === 'GLOBAL') {
          headers = [...headers, 'Total Bet', 'Total P/L', 'Global Balance', 'Triggers', 'Bets'];
          filename += '_global';
          rowMapper = (step) => {
              const triggers = step.activeTriggers ? `"${step.activeTriggers.join('; ')}"` : '';
              const bets = step.betDescriptions ? `"${step.betDescriptions.join(' | ')}"` : '';
              return [
                  step.spinIndex, step.result.number, step.result.color,
                  step.betAmount, step.outcome, step.bankroll, triggers, bets
              ];
          };
      } else {
          // Lane ID
          const lane = activeLanes.find(l => l.id === scope);
          if (!lane) return;
          headers = [...headers, 'Profit', 'Running Balance', 'Triggers'];
          filename += `_${lane.name.replace(/\s+/g, '_').toLowerCase()}`;
          rowMapper = (step) => {
              const detail = step.laneDetails?.find(d => d.laneId === lane.id);
              const balance = step.laneBankrolls[lane.id];
              const triggers = step.activeTriggers ? `"${step.activeTriggers.join('; ')}"` : '';
              return [
                  step.spinIndex, step.result.number, step.result.color,
                  detail?.profit ?? 0,
                  balance ?? 0,
                  triggers
              ];
          };
      }

      const rows = history.map(step => rowMapper(step).join(','));
      const csvContent = "data:text/csv;charset=utf-8," + headers.join(',') + "\n" + rows.join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${filename}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setIsExportMenuOpen(false);
  };

  const HeaderContent = () => (
     <div className={`flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700 shrink-0 ${isFullScreen ? 'h-16 shadow-md' : ''}`}>
         <div className="flex items-center gap-4">
            {/* Back Button (Fullscreen Only) */}
            {isFullScreen && (
                <button 
                    onClick={() => setIsFullScreen(false)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-red-900/40 text-slate-300 hover:text-red-100 border border-slate-700 hover:border-red-500 rounded-lg transition-all text-xs font-bold group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    BACK
                </button>
            )}

            <div className="flex items-center gap-2">
                {!isFullScreen && <History size={16} className="text-indigo-400" />}
                <h3 className={`font-bold text-slate-300 uppercase tracking-wider ${isFullScreen ? 'text-lg' : 'text-sm'}`}>Spin History</h3>
            </div>
         </div>

         <div className="flex items-center gap-2">
            {!isFullScreen && (
                <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                    {history.length} Total
                </span>
            )}
            
            <div className="relative">
                <button
                    onClick={() => setIsExportMenuOpen(!isExportMenuOpen)}
                    disabled={history.length === 0}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-emerald-400 rounded-lg transition-colors ml-2 disabled:opacity-30 border border-slate-700"
                    title="Export Options"
                >
                    <Download size={14} />
                    <span className="text-[10px] font-bold hidden sm:inline">Export</span>
                    <ChevronDown size={12} />
                </button>

                {isExportMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsExportMenuOpen(false)} />
                        <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95">
                            <div className="py-1">
                                <button onClick={() => handleExportCSV('FULL')} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2">
                                    <FileText size={14} className="text-emerald-400" /> Full Report (All)
                                </button>
                                <button onClick={() => handleExportCSV('GLOBAL')} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2">
                                    <FileText size={14} className="text-blue-400" /> Global Stats Only
                                </button>
                                {activeLanes.length > 0 && (
                                    <div className="border-t border-slate-700 my-1 pt-1">
                                        <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase">Individual Lanes</div>
                                        {activeLanes.map(lane => (
                                            <button key={lane.id} onClick={() => handleExportCSV(lane.id)} className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: lane.color }} />
                                                {lane.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>

            {isFullScreen ? (
                /* Primary Exit Button for Fullscreen */
                <button
                    onClick={() => setIsFullScreen(false)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-red-900/40 text-slate-200 hover:text-red-100 border border-slate-600 hover:border-red-500 rounded transition-all text-xs font-bold whitespace-nowrap"
                >
                    <LogOut size={16} />
                    <span>EXIT</span>
                </button>
            ) : (
                /* Maximize Button for Mini View */
                <button
                    onClick={() => setIsFullScreen(true)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-all"
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
       {/* Floating Close Button in Fullscreen as backup */}
       {isFullScreen && (
          <button 
              onClick={() => setIsFullScreen(false)}
              className="absolute top-20 right-6 z-50 p-3 bg-slate-900/80 hover:bg-red-600 text-slate-400 hover:text-white rounded-full border border-slate-700 hover:border-red-400 backdrop-blur shadow-xl transition-all md:hidden"
              title="Close View"
          >
              <XCircle size={24} />
          </button>
      )}

      <HeaderContent />
      
      <div className={`flex-1 overflow-y-auto custom-scrollbar p-0 ${isFullScreen ? 'bg-slate-950 p-6' : 'bg-slate-900/20'}`}>
        <table className="w-full text-left text-sm border-collapse table-fixed">
            <thead className={`sticky top-0 z-10 shadow-sm border-b border-slate-700 ${isFullScreen ? 'bg-slate-900' : 'bg-slate-900'}`}>
                <tr>
                    <th className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-10 text-center">#</th>
                    <th className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-14 text-center">Res</th>
                    <th className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-16">Bet</th>
                    <th className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-16">P/L</th>
                    <th className="px-3 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Bal</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
                {history.length === 0 ? (
                    <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500 italic text-xs">
                            Waiting for simulation to start...
                        </td>
                    </tr>
                ) : (
                    displayHistory.map((step) => {
                        const color = getNumberColor(step.result.number);
                        const bgResultClass = color === 'red' ? 'bg-red-600' : color === 'black' ? 'bg-slate-800' : 'bg-green-600';
                        
                        const isWin = step.outcome > 0;
                        const isLoss = step.outcome < 0;
                        const hasTrigger = step.activeTriggers && step.activeTriggers.length > 0;
                        const hasLaneDetails = step.laneDetails && step.laneDetails.length > 0;
                        const hasBets = step.betDescriptions && step.betDescriptions.length > 0;

                        return (
                            <React.Fragment key={step.spinIndex}>
                                {/* Main Row */}
                                <tr className="hover:bg-slate-700/30 transition-colors group border-none bg-slate-900/10">
                                    <td className="px-3 py-1 text-center text-slate-500 font-mono text-xs group-hover:text-slate-400 align-top">
                                        {step.spinIndex}
                                    </td>
                                    <td className="px-3 py-1 text-center align-top">
                                        <div className={`inline-flex items-center justify-center w-5 h-5 rounded font-bold text-[10px] text-white shadow-sm ${bgResultClass}`}>
                                            {step.result.number}
                                        </div>
                                    </td>
                                    <td className="px-3 py-1 text-right font-mono text-slate-400 text-xs align-top">
                                        <div className="flex items-center justify-end gap-1">
                                           {hasTrigger && <Zap size={10} className="text-orange-400" fill="currentColor" />}
                                           ${step.betAmount}
                                        </div>
                                    </td>
                                    <td className="px-3 py-1 text-right font-mono text-xs align-top">
                                        <div className={`flex items-center justify-end gap-1 ${isWin ? 'text-green-400' : isLoss ? 'text-red-400' : 'text-slate-500'}`}>
                                            {isWin ? <ArrowUp size={10} strokeWidth={3} /> : isLoss ? <ArrowDown size={10} strokeWidth={3} /> : <Minus size={10} />}
                                            <span className="font-bold">{step.outcome > 0 ? '+' : ''}{step.outcome}</span>
                                        </div>
                                    </td>
                                    <td className="px-3 py-1 text-right font-mono text-indigo-300 font-medium text-xs align-top">
                                        ${step.bankroll}
                                    </td>
                                </tr>

                                {/* Detail Row */}
                                <tr className="border-b border-slate-700/50">
                                    <td colSpan={5} className="px-3 pb-1.5 pt-0">
                                        <div className="flex flex-col gap-1.5">
                                            {/* Triggers + Full Bet Descriptions */}
                                            {(hasTrigger || hasBets) && (
                                                <div className="flex flex-col gap-1 pl-2">
                                                    {/* Explicit Triggers */}
                                                    {step.activeTriggers?.filter(t => t.startsWith('Trigger:')).map((trig, i) => (
                                                        <div key={`trig-${i}`} className="flex items-center gap-1.5 text-[9px] text-orange-300 font-mono bg-orange-900/20 px-1.5 py-0.5 rounded border border-orange-500/20 w-fit">
                                                            <Zap size={8} /> {trig}
                                                        </div>
                                                    ))}
                                                    
                                                    {/* All Bet Descriptions (Now including the full 'Bets:' string from simulation.ts) */}
                                                    {step.betDescriptions?.map((desc, idx) => (
                                                       <div key={`desc-${idx}`} className="text-[9px] text-slate-400 font-mono leading-relaxed whitespace-normal break-words p-1 bg-slate-800/50 rounded">
                                                           {desc}
                                                       </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Lane Details */}
                                            {hasLaneDetails && (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pl-2">
                                                    {activeLanes.map(lane => {
                                                        const detail = step.laneDetails?.find(d => d.laneId === lane.id);
                                                        const balance = step.laneBankrolls[lane.id];
                                                        
                                                        // We show enabled lanes to track progress even if profit is 0 this spin
                                                        if (detail === undefined && balance === undefined) return null;

                                                        const profit = detail?.profit || 0;
                                                        const pClass = profit > 0 ? 'text-green-400' : profit < 0 ? 'text-red-400' : 'text-slate-500';

                                                        return (
                                                            <div key={lane.id} className="flex items-center justify-between gap-2 text-[9px] bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60" style={{ borderLeft: `2px solid ${lane.color}` }}>
                                                                <div className="font-bold truncate max-w-[60px]" style={{color: lane.color}} title={lane.name}>
                                                                    {lane.name}
                                                                </div>
                                                                <div className="flex items-center gap-2 font-mono">
                                                                    <div className={`flex items-center gap-0.5 ${pClass}`}>
                                                                         <span className="opacity-70">{profit > 0 ? '+' : ''}</span>{profit}
                                                                    </div>
                                                                    <div className="w-px h-2 bg-slate-700"></div>
                                                                    <div className="text-slate-300 font-medium">
                                                                        ${balance?.toFixed(0)}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
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