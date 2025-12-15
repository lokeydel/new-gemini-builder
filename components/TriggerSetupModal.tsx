import React, { useState, useEffect } from 'react';
import { X, Check, Target, AlertCircle } from 'lucide-react';
import RouletteTable from './RouletteBoard';
import { TriggerBet, BetPlacement, BetType, TriggerRule } from '../core/types';
import { getPlacementIdentifier } from '../utils/placements';

interface TriggerSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (trigger: TriggerBet) => void;
  existingTrigger?: TriggerBet;
  laneColor: string;
}

const TriggerSetupModal: React.FC<TriggerSetupModalProps> = ({ 
  isOpen, onClose, onSave, existingTrigger, laneColor 
}) => {
  // State
  const [selectedPlacement, setSelectedPlacement] = useState<BetPlacement | null>(null);
  const [rule, setRule] = useState<TriggerRule>('MISS_STREAK');
  const [threshold, setThreshold] = useState<number>(3);
  const [amount, setAmount] = useState<number>(5);

  useEffect(() => {
    if (isOpen) {
      if (existingTrigger) {
        setSelectedPlacement(existingTrigger.triggerPlacement);
        setRule(existingTrigger.rule);
        setThreshold(existingTrigger.threshold);
        setAmount(existingTrigger.betAmount);
      } else {
        // Defaults
        setSelectedPlacement(null);
        setRule('MISS_STREAK');
        setThreshold(3);
        setAmount(5);
      }
    }
  }, [isOpen, existingTrigger]);

  if (!isOpen) return null;

  const handleTableClick = (placement: BetPlacement) => {
    setSelectedPlacement(placement);
  };

  const handleSave = () => {
    if (!selectedPlacement) return;
    
    const newTrigger: TriggerBet = {
      id: existingTrigger?.id || Date.now().toString(),
      active: true,
      triggerPlacement: selectedPlacement,
      rule,
      threshold,
      betAmount: amount,
      betPlacement: selectedPlacement // Currently betting on the target itself
    };
    onSave(newTrigger);
    onClose();
  };

  // Preview Chip for Table
  const previewBets = selectedPlacement ? [{
    id: 'preview',
    placement: selectedPlacement,
    amount: amount
  }] : [];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
          <div className="flex items-center gap-3">
             <div className="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]" style={{ color: laneColor, backgroundColor: laneColor }} />
             <h2 className="text-lg font-bold text-white uppercase tracking-wide">
               {existingTrigger ? 'Edit Trigger' : 'New Trigger Bet'}
             </h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          
          {/* Left: Configuration Panel */}
          <div className="w-full lg:w-80 bg-slate-800/50 p-6 border-r border-slate-700 flex flex-col gap-6 overflow-y-auto">
             
             {/* 1. Target Selection Info */}
             <div className="space-y-2">
               <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                 <Target size={14} className="text-indigo-400" />
                 Target Selection
               </label>
               {selectedPlacement ? (
                 <div className="p-3 bg-indigo-900/20 border border-indigo-500/30 rounded-lg">
                    <div className="text-indigo-300 font-bold text-lg">{selectedPlacement.displayName}</div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Covers {selectedPlacement.numbers.length} numbers
                    </div>
                 </div>
               ) : (
                 <div className="p-4 bg-slate-800 border border-dashed border-slate-600 rounded-lg text-slate-500 text-sm italic text-center">
                   Click on the table to select a trigger target (e.g. Red, #17, 1st Dozen)
                 </div>
               )}
             </div>

             {/* 2. Logic Rules */}
             <div className="space-y-4">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Logic Condition</label>
                
                <div className="flex flex-col gap-3">
                   <div className="flex items-center gap-2">
                      <select 
                        value={rule} 
                        onChange={(e) => setRule(e.target.value as TriggerRule)}
                        className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:border-indigo-500 outline-none"
                      >
                        <option value="MISS_STREAK">Has Missed (Streak)</option>
                        <option value="HIT_STREAK">Has Hit (Streak)</option>
                      </select>
                   </div>
                   
                   <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-400">For</span>
                      <input 
                        type="number" 
                        value={threshold}
                        onChange={(e) => setThreshold(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm font-bold text-center"
                      />
                      <span className="text-sm text-slate-400">Times</span>
                   </div>
                </div>
             </div>

             {/* 3. Bet Action */}
             <div className="space-y-4 pt-4 border-t border-slate-700/50">
                <label className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Action: Place Bet</label>
                <div className="flex items-center gap-3 bg-slate-900 p-3 rounded-lg border border-slate-700">
                   <span className="text-sm text-slate-400">Bet Amount:</span>
                   <div className="flex items-center text-white font-mono">
                      <span className="text-emerald-500 mr-1">$</span>
                      <input 
                        type="number" 
                        value={amount}
                        onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-20 bg-transparent outline-none border-b border-slate-600 focus:border-emerald-500 text-center font-bold"
                      />
                   </div>
                </div>
                <div className="text-[10px] text-slate-500 text-center">
                   Bet will be placed on <strong>{selectedPlacement?.displayName || 'Target'}</strong>
                </div>
             </div>

             <div className="flex-1"></div>

             {/* Save Button */}
             <button 
               onClick={handleSave}
               disabled={!selectedPlacement}
               className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
             >
               <Check size={18} />
               Save Trigger
             </button>

          </div>

          {/* Right: Table Area */}
          <div className="flex-1 bg-slate-950 p-8 flex items-center justify-center relative overflow-hidden">
             <div className="scale-90 lg:scale-100 xl:scale-110 transition-transform origin-center">
                <RouletteTable 
                  bets={previewBets}
                  onBetSelect={handleTableClick}
                  triggerMode={true}
                  triggerHighlightIds={selectedPlacement ? [getPlacementIdentifier(selectedPlacement)] : []}
                />
             </div>
             
             {/* Instructions Overlay if empty */}
             {!selectedPlacement && (
               <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-slate-800/90 text-white px-4 py-2 rounded-full shadow-xl border border-slate-600 text-sm flex items-center gap-2 pointer-events-none animate-bounce">
                 <AlertCircle size={16} className="text-indigo-400" />
                 Select a spot on the table to start
               </div>
             )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default TriggerSetupModal;