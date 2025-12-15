
import React, { useState } from 'react';
import { SimulationStep, Lane, BetType } from '../core/types';
import { getNumberColor, PAYOUTS } from '../core/constants';
import { ArrowDown, ArrowUp, Minus, History, Maximize2, Minimize2, Zap, Download, ChevronDown, FileText, CheckCircle2, LogOut, ArrowLeft, XCircle, RotateCcw, Calculator, Search, Filter, Link } from 'lucide-react';

interface SpinLogProps {
  history: SimulationStep[];
  lanes: Lane[];
  className?: string;
}

const SpinLog: React.FC<SpinLogProps> = ({ history, lanes, className }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [expandedSpinIndex, setExpandedSpinIndex] = useState<number | null>(null);

  // Display reverse chronologically (Newest/Last Spin at top)
  const displayHistory = [...history].reverse(); 
  const activeLanes = lanes.filter(l => l.enabled);

  const containerClass = isFullScreen 
    ? "fixed inset-0 z-[9999] bg-slate-950 flex flex-col shadow-2xl transition-all duration-300 animate-in fade-in" 
    : `flex flex-col bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg ${className || 'h-96'}`;

  const toggleExpand = (index: number) => {
      setExpandedSpinIndex(expandedSpinIndex === index ? null : index);
  };

  // Format bets into a readable string: "2nd 12 $100, Red $50"
  const formatBets = (step: SimulationStep): string => {
      if (step.bets && step.bets.length > 0) {
          return step.bets.map(b => `${b.placement.displayName} $${b.amount}`).join(', ');
      }
      return step.betDescriptions ? step.betDescriptions.join(', ').replace(/Lane \d+: /g, '') : '-';
  };

  // Structured breakdown for CSV (Gemini Friendly)
  const formatBetsDetailed = (step: SimulationStep): string => {
      if (step.bets && step.bets.length > 0) {
          const parts = step.bets.map(b => `[${b.placement.displayName}: ${b.amount}]`);
          return parts.join(' ');
      }
      return '[]';
  };

  const handleExportCSV = (scope: 'FULL' | 'GLOBAL' | string) => {
      if (history.length === 0) return;

      // Strict format as requested: Spin, Number, TotalBet, NetPL, StartBalance, EndBalance
      // Plus breakdown of bets
      let headers = ['Spin', 'Number', 'TotalBet', 'NetPL', 'StartBalance', 'EndBalance', 'Bets'];
      let filename = 'roulette_sim_gemini';

      const rowMapper = (step: SimulationStep) => {
          const startBal = step.startingBankroll;
          const betStr = formatBetsDetailed(step).replace(/"/g, '""'); // Escape quotes
          
          return [
              step.spinIndex,
              step.result.display, // Use display string
              step.betAmount,
              step.outcome,
              startBal,
              step.bankroll,
              `"${betStr}"`
          ];
      };

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
                    Spin Log <span className="text-emerald-500 font-bold ml-2 text-xs">● Strict Audit Mode</span>
                </h3>
            </div>
         </div>

         <div className="flex items-center gap-2">
            <button
                onClick={() => handleExportCSV('FULL')}
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
                    <th className="px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-auto">Bets</th>
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
                        const color = getNumberColor(step.result.value); // Use value for color check
                        const numBg = color === 'red' ? 'bg-red-600' : color === 'black' ? 'bg-slate-800' : 'bg-green-600';
                        const plClass = step.outcome > 0 ? 'text-emerald-400' : step.outcome < 0 ? 'text-red-400' : 'text-slate-500';
                        const betsString = formatBets(step);
                        const isExpanded = expandedSpinIndex === step.spinIndex;
                        
                        // Check for gap (audit check)
                        const prevStep = displayHistory[idx + 1];
                        const isContinuityBroken = prevStep && prevStep.bankroll !== step.startingBankroll;

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
                                        ${step.startingBankroll}
                                    </td>

                                    {/* Net P/L */}
                                    <td className={`px-2 py-2 text-right font-mono text-xs font-bold ${plClass}`}>
                                        {step.outcome > 0 ? '+' : ''}{step.outcome}
                                    </td>

                                    {/* End Balance */}
                                    <td className="px-2 py-2 text-right font-mono text-xs text-indigo-300 font-bold">
                                        ${step.bankroll}
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
                                                    <span className="text-white font-bold">${step.startingBankroll}</span>
                                                    <span className="text-slate-600">+</span>
                                                    <span className="text-slate-400">NET</span>
                                                    <span className={`font-bold ${plClass}`}>${step.outcome}</span>
                                                    <span className="text-slate-600">=</span>
                                                    <span className="text-slate-400">END</span>
                                                    <span className="text-indigo-300 font-bold">${step.bankroll}</span>
                                                </div>

                                                {/* Triggers */}
                                                {step.activeTriggers && step.activeTriggers.length > 0 && (
                                                    <div className="flex flex-wrap gap-2">
                                                        {step.activeTriggers.map((t, i) => (
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
