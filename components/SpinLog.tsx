import React, { useState } from 'react';
import { SimulationStep } from '../types';
import { getNumberColor } from '../constants';
import { ArrowDown, ArrowUp, Minus, History, Maximize2, Minimize2 } from 'lucide-react';

interface SpinLogProps {
  history: SimulationStep[];
  className?: string;
}

const SpinLog: React.FC<SpinLogProps> = ({ history, className }) => {
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Show newest spins first
  const reversedHistory = [...history].reverse();

  const containerClass = isFullScreen 
    ? "fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md p-6 flex flex-col shadow-2xl transition-all duration-300" 
    : `flex flex-col bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg ${className || 'h-96'}`;

  const HeaderContent = () => (
     <div className="flex items-center justify-between px-4 py-3 bg-slate-900/50 border-b border-slate-700 shrink-0">
         <div className="flex items-center gap-2">
            <History size={16} className="text-indigo-400" />
            <h3 className={`font-bold text-slate-300 uppercase tracking-wider ${isFullScreen ? 'text-lg' : 'text-sm'}`}>Spin Log</h3>
         </div>
         <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                {history.length} Total
            </span>
            <button
                onClick={() => setIsFullScreen(!isFullScreen)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors ml-2"
                title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
            >
                {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={16} />}
            </button>
         </div>
      </div>
  );

  return (
    <div className={containerClass}>
      <HeaderContent />
      
      <div className="flex-1 overflow-y-auto custom-scrollbar p-0 bg-slate-900/20">
        <table className="w-full text-left text-sm border-collapse table-fixed">
            <thead className="sticky top-0 bg-slate-900 z-10 shadow-sm border-b border-slate-700">
                <tr>
                    <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-12 text-center">#</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-20 text-center">Result</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-20">Bet</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-20">P/L</th>
                    <th className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right">Balance</th>
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
                    reversedHistory.map((step) => {
                        const color = getNumberColor(step.result.number);
                        const bgResultClass = color === 'red' ? 'bg-red-600' : color === 'black' ? 'bg-slate-800' : 'bg-green-600';
                        
                        const isWin = step.outcome > 0;
                        const isLoss = step.outcome < 0;

                        return (
                            <tr key={step.spinIndex} className="hover:bg-slate-700/30 transition-colors group">
                                <td className="px-3 py-1.5 text-center text-slate-600 font-mono text-xs group-hover:text-slate-400">
                                    {step.spinIndex}
                                </td>
                                <td className="px-3 py-1.5 text-center">
                                    <div className={`inline-flex items-center justify-center w-6 h-6 rounded font-bold text-xs text-white shadow-sm ${bgResultClass}`}>
                                        {step.result.number}
                                    </div>
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono text-slate-400 text-xs">
                                    ${step.betAmount}
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono text-xs">
                                    <div className={`flex items-center justify-end gap-1 ${isWin ? 'text-green-400' : isLoss ? 'text-red-400' : 'text-slate-500'}`}>
                                        {isWin ? <ArrowUp size={10} strokeWidth={3} /> : isLoss ? <ArrowDown size={10} strokeWidth={3} /> : <Minus size={10} />}
                                        <span className="font-bold">{step.outcome > 0 ? '+' : ''}{step.outcome}</span>
                                    </div>
                                </td>
                                <td className="px-3 py-1.5 text-right font-mono text-indigo-300 font-medium text-xs">
                                    ${step.bankroll}
                                </td>
                            </tr>
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