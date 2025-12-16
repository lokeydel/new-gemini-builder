
import React, { useMemo } from 'react';
import { BatchSession } from '../core/types';
import { X, Trash2, Calendar, TrendingUp, DollarSign, ArrowRight, Play, History, CheckCircle2, Clock } from 'lucide-react';

interface SimulationHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  batches: BatchSession[];
  activeBatchId: string | null;
  onSelectBatch: (id: string) => void;
  onDeleteBatch: (id: string) => void;
  onClearHistory: () => void;
}

const SimulationHistory: React.FC<SimulationHistoryProps> = ({
  isOpen,
  onClose,
  batches,
  activeBatchId,
  onSelectBatch,
  onDeleteBatch,
  onClearHistory
}) => {
  // Sort batches by timestamp descending (newest first)
  const sortedBatches = useMemo(() => {
    return [...batches].sort((a, b) => b.timestamp - a.timestamp);
  }, [batches]);

  const activeBatch = batches.find(b => b.id === activeBatchId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 w-full max-w-5xl h-[85vh] rounded-2xl border border-slate-700 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
               <History size={24} className="text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Simulation Archive</h2>
              <p className="text-xs text-slate-500 font-medium">
                {batches.length} Saved {batches.length === 1 ? 'Session' : 'Sessions'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {batches.length > 0 && (
                <button 
                    onClick={() => { if(window.confirm("Clear all history?")) onClearHistory(); }}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-900/20 border border-transparent hover:border-red-900/30 rounded transition-colors"
                >
                    <Trash2 size={14} /> Clear All
                </button>
            )}
            <button 
                onClick={onClose} 
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
                <X size={20} />
            </button>
          </div>
        </div>

        {/* Content: Split View */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* LEFT: Scrollable List */}
          <div className="w-full md:w-5/12 lg:w-4/12 border-r border-slate-800 overflow-y-auto custom-scrollbar bg-slate-900/50">
             {sortedBatches.length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
                     <History size={48} className="opacity-20 mb-4" />
                     <p className="text-sm">No simulations saved yet.</p>
                     <p className="text-xs mt-2 opacity-60">Run a simulation to see it appear here.</p>
                 </div>
             ) : (
                 <div className="divide-y divide-slate-800/50">
                     {sortedBatches.map((batch) => {
                         const isActive = batch.id === activeBatchId;
                         const profit = batch.stats.avgFinalBankroll - batch.settings.startingBankroll;
                         const isProfit = profit >= 0;
                         
                         return (
                             <button
                                 key={batch.id}
                                 onClick={() => onSelectBatch(batch.id)}
                                 className={`w-full text-left p-4 hover:bg-slate-800/50 transition-all group relative ${
                                     isActive ? 'bg-indigo-900/10' : ''
                                 }`}
                             >
                                 {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />}
                                 
                                 <div className="flex justify-between items-start mb-1">
                                     <span className={`text-sm font-bold truncate ${isActive ? 'text-indigo-300' : 'text-slate-200 group-hover:text-white'}`}>
                                         {batch.label || 'Untitled Run'}
                                     </span>
                                     <span className="text-[10px] text-slate-500 font-mono shrink-0 flex items-center gap-1">
                                        <Clock size={10} />
                                        {new Date(batch.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                     </span>
                                 </div>
                                 
                                 <div className="flex justify-between items-center mt-2">
                                     <div className={`text-xs font-mono font-bold flex items-center gap-1 ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                                         {isProfit ? <TrendingUp size={12} /> : <TrendingUp size={12} className="rotate-180" />}
                                         {isProfit ? '+' : ''}{profit.toFixed(0)}
                                     </div>
                                     <div className="text-[10px] text-slate-500 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                         {batch.stats.totalSimulations} Sim{batch.stats.totalSimulations > 1 ? 's' : ''}
                                     </div>
                                 </div>
                             </button>
                         );
                     })}
                 </div>
             )}
          </div>

          {/* RIGHT: Detailed Preview */}
          <div className="hidden md:flex flex-1 bg-slate-950 p-8 flex-col overflow-y-auto">
              {activeBatch ? (
                  <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-8">
                      {/* Title Section */}
                      <div>
                          <div className="flex items-center gap-3 mb-2">
                              <h1 className="text-3xl font-black text-white">{activeBatch.label}</h1>
                              {activeBatch.stats.avgFinalBankroll >= activeBatch.settings.startingBankroll ? (
                                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-bold flex items-center gap-1">
                                      <CheckCircle2 size={12} /> Profitable
                                  </span>
                              ) : (
                                  <span className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-xs font-bold">
                                      Loss
                                  </span>
                              )}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-500">
                              <span className="flex items-center gap-1.5"><Calendar size={14} /> {new Date(activeBatch.timestamp).toLocaleDateString()}</span>
                              <span className="flex items-center gap-1.5"><Clock size={14} /> {new Date(activeBatch.timestamp).toLocaleTimeString()}</span>
                              <span className="font-mono text-slate-600">ID: {activeBatch.id}</span>
                          </div>
                      </div>

                      {/* Key Metrics Grid */}
                      <div className="grid grid-cols-3 gap-4">
                          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 relative overflow-hidden group">
                              <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                  <DollarSign size={40} />
                              </div>
                              <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Net Result</div>
                              <div className={`text-2xl font-mono font-bold ${activeBatch.stats.avgFinalBankroll >= activeBatch.settings.startingBankroll ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {activeBatch.stats.avgFinalBankroll - activeBatch.settings.startingBankroll >= 0 ? '+' : ''}
                                  {(activeBatch.stats.avgFinalBankroll - activeBatch.settings.startingBankroll).toFixed(0)}
                              </div>
                          </div>

                          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 relative overflow-hidden group">
                               <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                  <TrendingUp size={40} />
                              </div>
                              <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Win Rate</div>
                              <div className="text-2xl font-mono font-bold text-white">
                                  {activeBatch.stats.totalSimulations > 0 
                                    ? ((activeBatch.stats.wins / activeBatch.stats.totalSimulations) * 100).toFixed(1) 
                                    : 0}%
                              </div>
                          </div>

                          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 relative overflow-hidden group">
                               <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                  <History size={40} />
                              </div>
                              <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Simulations</div>
                              <div className="text-2xl font-mono font-bold text-indigo-300">
                                  {activeBatch.stats.totalSimulations}
                              </div>
                          </div>
                      </div>

                      {/* Detailed Stats Table */}
                      <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                          <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/50 text-xs font-bold text-slate-400 uppercase tracking-wider">
                              Run Details
                          </div>
                          <div className="grid grid-cols-2 text-sm divide-x divide-slate-800">
                              <div className="p-4 space-y-3">
                                  <div className="flex justify-between">
                                      <span className="text-slate-500">Starting Bankroll</span>
                                      <span className="font-mono text-slate-300">${activeBatch.settings.startingBankroll}</span>
                                  </div>
                                  <div className="flex justify-between">
                                      <span className="text-slate-500">Best Run</span>
                                      <span className="font-mono text-emerald-400">${activeBatch.stats.bestRun}</span>
                                  </div>
                                  <div className="flex justify-between">
                                      <span className="text-slate-500">Worst Run</span>
                                      <span className="font-mono text-red-400">${activeBatch.stats.worstRun}</span>
                                  </div>
                              </div>
                              <div className="p-4 space-y-3">
                                  <div className="flex justify-between">
                                      <span className="text-slate-500">Spins per Sim</span>
                                      <span className="font-mono text-slate-300">{activeBatch.settings.spinsPerSimulation}</span>
                                  </div>
                                  <div className="flex justify-between">
                                      <span className="text-slate-500">Avg. End Balance</span>
                                      <span className="font-mono text-white">${activeBatch.stats.avgFinalBankroll.toFixed(0)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                      <span className="text-slate-500">Wins / Losses</span>
                                      <span className="font-mono text-slate-300">{activeBatch.stats.wins} / {activeBatch.stats.losses}</span>
                                  </div>
                              </div>
                          </div>
                      </div>

                      {/* Action Bar */}
                      <div className="flex items-center gap-3 pt-4 border-t border-slate-800/50">
                          <button 
                              onClick={onClose}
                              className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 group"
                          >
                              <Play size={18} className="fill-current" />
                              Load & View Analysis
                              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                          </button>
                          
                          <button 
                              onClick={() => onDeleteBatch(activeBatch.id)}
                              className="px-4 py-3 bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/30 rounded-xl transition-all font-bold flex items-center gap-2"
                              title="Delete this run"
                          >
                              <Trash2 size={18} />
                          </button>
                      </div>

                  </div>
              ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-600">
                      <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mb-4 border border-slate-800">
                          <History size={32} />
                      </div>
                      <p className="text-lg font-medium text-slate-500">Select a simulation run to view details</p>
                  </div>
              )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default SimulationHistory;
