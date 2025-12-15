
import React from 'react';
import { X, ArrowDown, Play, Zap, Calculator, TrendingUp, DollarSign, Wallet } from 'lucide-react';
import { Lane, BetType } from '../core/types';

interface LogicFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  lane: Lane;
}

const LogicFlowModal: React.FC<LogicFlowModalProps> = ({ isOpen, onClose, lane }) => {
  if (!isOpen) return null;

  const { config, bets, triggerBets } = lane;
  const totalBaseBet = bets.reduce((sum, b) => sum + b.amount, 0);

  // Helper for connecting lines
  const Connector = () => (
    <div className="flex justify-center py-1">
      <ArrowDown size={16} className="text-slate-600" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-indigo-500/10 rounded-lg">
                <Play size={18} className="text-indigo-400" />
             </div>
             <div>
                <h2 className="text-lg font-bold text-white leading-none">Logic Map</h2>
                <span className="text-[10px] text-slate-500 font-mono">Visualizing Execution Pipeline for {lane.name}</span>
             </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Flowchart */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-slate-950/50 relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-800 -translate-x-1/2 z-0" />

            <div className="relative z-10 flex flex-col gap-0 max-w-md mx-auto">
                
                {/* 1. START */}
                <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center shadow-lg mx-auto w-32 mb-1">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Start Spin</span>
                </div>
                
                <Connector />

                {/* 2. BASE BETS */}
                <div className="bg-slate-800 border-l-4 border-indigo-500 rounded-r-lg p-4 shadow-lg flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <Wallet size={16} className="text-indigo-400" />
                        <span className="text-sm font-bold text-white">1. Place Base Bets</span>
                    </div>
                    <div className="bg-slate-900/50 rounded border border-slate-700 p-2 text-xs">
                        {bets.length > 0 ? (
                            <div className="space-y-1">
                                {bets.slice(0, 3).map((b, i) => (
                                    <div key={i} className="flex justify-between text-slate-300">
                                        <span>{b.placement.displayName}</span>
                                        <span className="font-mono text-indigo-300">${b.amount}</span>
                                    </div>
                                ))}
                                {bets.length > 3 && <div className="text-slate-500 italic text-center text-[10px]">+ {bets.length - 3} more</div>}
                                <div className="border-t border-slate-700 mt-1 pt-1 flex justify-between font-bold text-indigo-400">
                                    <span>Base Total</span>
                                    <span>${totalBaseBet}</span>
                                </div>
                            </div>
                        ) : (
                            <span className="text-slate-500 italic">No base bets configured</span>
                        )}
                    </div>
                </div>

                <Connector />

                {/* 3. TRIGGERS */}
                <div className="bg-slate-800 border-l-4 border-orange-500 rounded-r-lg p-4 shadow-lg flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <Zap size={16} className="text-orange-400" />
                        <span className="text-sm font-bold text-white">2. Check Triggers</span>
                    </div>
                    <div className="bg-slate-900/50 rounded border border-slate-700 p-2 text-xs">
                        {triggerBets.length > 0 ? (
                            <div className="space-y-2">
                                {triggerBets.map((t, i) => (
                                    <div key={i} className="flex flex-col gap-1 p-1.5 bg-slate-800/80 rounded border border-slate-700/50">
                                        <div className="flex items-center gap-1.5 text-orange-200">
                                            <span className="font-mono font-bold uppercase text-[10px] bg-orange-900/40 px-1 rounded">
                                                IF {t.rule === 'HIT_STREAK' ? 'HIT' : 'MISS'} {t.threshold}x
                                            </span>
                                            <span className="text-[10px] text-slate-400">on {t.triggerPlacement.displayName}</span>
                                        </div>
                                        <div className="flex items-center gap-2 pl-2 border-l border-slate-600 ml-1">
                                            <span className="text-[10px] text-slate-400">Then Bet</span>
                                            <span className="font-mono text-emerald-400 font-bold">${t.betAmount}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <span className="text-slate-500 italic">No triggers active</span>
                        )}
                    </div>
                </div>

                <Connector />

                {/* 4. SPIN & RESOLVE */}
                <div className="bg-slate-800 border-l-4 border-emerald-500 rounded-r-lg p-4 shadow-lg flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <Calculator size={16} className="text-emerald-400" />
                        <span className="text-sm font-bold text-white">3. Spin & Resolve P/L</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="bg-slate-900/50 p-2 rounded text-center border border-slate-700">
                             <span className="block text-slate-500 font-bold uppercase mb-1">Calculation</span>
                             <div className="text-slate-300">Payout = Stake + (Stake × Odds)</div>
                             <div className="text-slate-300">Profit = Payout - Stake</div>
                        </div>
                        <div className="bg-slate-900/50 p-2 rounded text-center border border-slate-700">
                             <span className="block text-slate-500 font-bold uppercase mb-1">Logic</span>
                             <div className="text-emerald-400">Win = Profit &ge; 0</div>
                             <div className="text-red-400">Loss = Profit &lt; 0</div>
                        </div>
                    </div>
                </div>

                <Connector />

                {/* 5. PROGRESSION */}
                <div className="grid grid-cols-2 gap-4">
                    {/* WIN BRANCH */}
                    <div className="bg-slate-800/80 border border-emerald-500/30 rounded-lg p-3 flex flex-col gap-1 relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 px-2 text-[10px] font-bold text-emerald-500 uppercase">If Win</div>
                        <div className="text-center mt-1">
                             <div className="text-xs font-bold text-white">{config.onWinAction}</div>
                             {config.onWinValue !== 0 && <div className="text-[10px] font-mono text-emerald-300">Value: {config.onWinValue}</div>}
                        </div>
                    </div>
                    
                    {/* LOSS BRANCH */}
                    <div className="bg-slate-800/80 border border-red-500/30 rounded-lg p-3 flex flex-col gap-1 relative">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900 px-2 text-[10px] font-bold text-red-500 uppercase">If Loss</div>
                        <div className="text-center mt-1">
                             <div className="text-xs font-bold text-white">{config.onLossAction}</div>
                             {config.onLossValue !== 0 && <div className="text-[10px] font-mono text-red-300">Value: {config.onLossValue}</div>}
                        </div>
                    </div>
                </div>

                <Connector />

                {/* 6. END */}
                <div className="bg-slate-900 border border-slate-600 rounded-lg p-3 text-center shadow-lg mx-auto w-40 flex items-center justify-center gap-2">
                    <DollarSign size={14} className="text-yellow-400" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Update Bankroll</span>
                </div>

            </div>
        </div>
      </div>
    </div>
  );
};

export default LogicFlowModal;
