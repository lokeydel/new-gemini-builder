
import React, { useState } from 'react';
import { ProgressionConfig, ProgressionAction, SimulationSettings, SimulationSpeed, SimulationStatus, TriggerBet, TriggerRule, BetPlacement, Lane, SavedStrategy, SavedLayout } from '../core/types';
import { Brain, Save, FolderOpen, Plus, Trash2, Zap, Pencil, RotateCw, Layers, FilePlus, ChevronDown, Folder, X, AlertTriangle, Upload, Link2, ArrowRight, CornerDownLeft, FastForward, Play, ArrowDown, Edit3, Download } from 'lucide-react';
import TriggerSetupModal from './TriggerSetupModal';

interface StrategyPanelProps {
  // Strategy Management
  savedStrategies: SavedStrategy[];
  currentStrategyName: string;
  onRenameStrategy: (name: string) => void;
  onSaveStrategy: () => void;
  onLoadStrategy: (strategy: SavedStrategy) => void;
  onNewStrategy: () => void;
  onDeleteStrategy: (id: string) => void;
  onImportStrategy?: (strategy: SavedStrategy) => void;

  // Lane Props
  lanes: Lane[];
  activeLaneId: string;
  onSelectLane: (id: string) => void;
  onAddLane: () => void;
  onDeleteLane: (id: string) => void;
  onRenameLane: (id: string, newName: string) => void;
  onToggleLane?: (id: string) => void;

  config: ProgressionConfig;
  setConfig: (config: ProgressionConfig) => void;
  
  settings: SimulationSettings;
  setSettings: (settings: SimulationSettings) => void;
  onSimulate: () => void;
  
  speed: SimulationSpeed;
  setSpeed: (speed: SimulationSpeed) => void;
  simStatus: SimulationStatus;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onNextSpin: () => void;
  
  triggerBets: TriggerBet[];
  setTriggerBets: (bets: TriggerBet[] | ((prev: TriggerBet[]) => TriggerBet[])) => void;

  // Layouts for Chain Mode
  savedLayouts?: SavedLayout[]; 
  // Function to save current board as layout (passed from parent)
  onSaveCurrentLayout?: () => void;

  children?: React.ReactNode;
}

export const StrategyPanel: React.FC<StrategyPanelProps> = ({ 
  savedStrategies, currentStrategyName, onRenameStrategy, onSaveStrategy, onLoadStrategy, onNewStrategy, onDeleteStrategy, onImportStrategy,
  lanes, activeLaneId, onSelectLane, onAddLane, onDeleteLane, onRenameLane, onToggleLane,
  config, setConfig, settings, setSettings, onSimulate,
  speed, setSpeed, simStatus, onPause, onResume, onStop, onNextSpin,
  triggerBets, setTriggerBets,
  savedLayouts = [],
  onSaveCurrentLayout,
  children
}) => {
  
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");
  
  // Strategy Name Editing
  const [isEditingStrategyName, setIsEditingStrategyName] = useState(false);
  const [tempStrategyName, setTempStrategyName] = useState("");

  // Load Dropdown
  const [isLoadOpen, setIsLoadOpen] = useState(false);
  
  // Trigger Modal State
  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<TriggerBet | undefined>(undefined);

  const handleChangeAction = (type: 'win' | 'loss', value: string) => {
      const action = value as ProgressionAction;
      if (type === 'win') {
          let newVal = config.onWinValue;
          if (action === ProgressionAction.FIBONACCI && newVal === 0) newVal = 2; 
          setConfig({ ...config, onWinAction: action, onWinValue: newVal });
      } else {
          let newVal = config.onLossValue;
          if (action === ProgressionAction.FIBONACCI && newVal === 0) newVal = 1; 
          setConfig({ ...config, onLossAction: action, onLossValue: newVal });
      }
  };

  const activeLane = lanes.find(l => l.id === activeLaneId) || lanes[0];

  // Lane renaming
  const handleStartRename = (lane: Lane) => {
      setEditingNameId(lane.id);
      setTempName(lane.name);
  };

  const handleFinishRename = () => {
      if (editingNameId && tempName.trim()) {
          onRenameLane(editingNameId, tempName.trim());
      }
      setEditingNameId(null);
  };

  // Strategy renaming
  const startStrategyRename = () => {
      setTempStrategyName(currentStrategyName);
      setIsEditingStrategyName(true);
  };
  const finishStrategyRename = () => {
      if (tempStrategyName.trim()) onRenameStrategy(tempStrategyName.trim());
      setIsEditingStrategyName(false);
  };

  // Trigger Handlers
  const handleOpenNewTrigger = () => {
    setEditingTrigger(undefined);
    setIsTriggerModalOpen(true);
  };

  const handleEditTrigger = (trigger: TriggerBet) => {
    setEditingTrigger(trigger);
    setIsTriggerModalOpen(true);
  };

  const handleSaveTrigger = (trigger: TriggerBet) => {
    setTriggerBets(prev => {
        const exists = prev.find(t => t.id === trigger.id);
        if (exists) {
            return prev.map(t => t.id === trigger.id ? trigger : t);
        } else {
            return [...prev, trigger];
        }
    });
  };
  
  // Chain Handlers
  const handleAddChainStep = (layout: SavedLayout) => {
    setConfig({
        ...config,
        chainSteps: [...(config.chainSteps || []), layout]
    });
  };

  const handleRemoveChainStep = (index: number) => {
    const newSteps = [...(config.chainSteps || [])];
    newSteps.splice(index, 1);
    setConfig({
        ...config,
        chainSteps: newSteps
    });
  };
  
  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const content = e.target?.result as string;
              const parsed = JSON.parse(content);
              
              // Basic validation check
              if (parsed && Array.isArray(parsed.lanes)) {
                  onImportStrategy?.(parsed);
                  setIsLoadOpen(false);
              } else {
                  alert("Invalid strategy file format.");
              }
          } catch (err) {
              console.error(err);
              alert("Failed to parse strategy file.");
          }
      };
      reader.readAsText(file);
      event.target.value = ''; // Reset
  };

  const hasBaseBets = activeLane.bets.length > 0;
  const hasTriggers = triggerBets.length > 0;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 flex flex-col overflow-hidden text-sm">
      
      {/* 0. STRATEGY MANAGEMENT HEADER */}
      <div className="bg-slate-900/50 px-3 py-2 border-b border-slate-700 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
              <Folder size={14} className="text-indigo-400 shrink-0" />
              {isEditingStrategyName ? (
                  <input 
                    autoFocus
                    value={tempStrategyName}
                    onChange={(e) => setTempStrategyName(e.target.value)}
                    onBlur={finishStrategyRename}
                    onKeyDown={(e) => e.key === 'Enter' && finishStrategyRename()}
                    className="bg-slate-800 text-white font-bold text-xs px-1 py-0.5 rounded border border-indigo-500 w-full outline-none"
                  />
              ) : (
                  <h2 
                    onClick={startStrategyRename}
                    className="text-white font-bold text-sm truncate cursor-pointer hover:text-indigo-300 transition-colors"
                    title="Click to rename strategy"
                  >
                    {currentStrategyName}
                  </h2>
              )}
          </div>

          <div className="flex items-center gap-1">
              <button onClick={onNewStrategy} disabled={simStatus !== 'IDLE'} className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded transition-colors" title="New Strategy"><FilePlus size={14} /></button>
              <button onClick={onSaveStrategy} disabled={simStatus !== 'IDLE'} className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded transition-colors" title="Save Strategy"><Save size={14} /></button>

              <div className="relative">
                  <button onClick={() => setIsLoadOpen(!isLoadOpen)} disabled={simStatus !== 'IDLE'} className="flex items-center gap-0.5 p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors" title="Load Strategy"><FolderOpen size={14} /><ChevronDown size={10} /></button>
                  {isLoadOpen && (
                      <div className="absolute right-0 top-full mt-1 w-52 bg-slate-800 border border-slate-700 rounded shadow-xl z-50">
                           {/* Import Button */}
                           {onImportStrategy && (
                               <div className="p-2 border-b border-slate-700 bg-slate-800/50">
                                   <label className="flex items-center justify-center gap-2 w-full px-2 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded cursor-pointer transition-colors">
                                       <Upload size={12} /> Import .json File
                                       <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
                                   </label>
                               </div>
                           )}
                           
                          <div className="max-h-48 overflow-y-auto custom-scrollbar">
                              {savedStrategies.length === 0 ? <div className="px-3 py-2 text-[10px] text-slate-500 italic text-center">No saved strategies</div> : (
                                  savedStrategies.map(s => (
                                      <div key={s.id} className="group flex items-center justify-between px-2 py-1.5 hover:bg-slate-700 cursor-pointer border-b border-slate-700/50 last:border-0">
                                          <span onClick={() => { onLoadStrategy(s); setIsLoadOpen(false); }} className="text-xs text-slate-300 group-hover:text-white truncate flex-1">{s.name}</span>
                                          <button onClick={(e) => { e.stopPropagation(); onDeleteStrategy(s.id); }} className="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"><X size={10} /></button>
                                      </div>
                                  ))
                              )}
                          </div>
                      </div>
                  )}
                  {isLoadOpen && <div className="fixed inset-0 z-40" onClick={() => setIsLoadOpen(false)} />}
              </div>
          </div>
      </div>

      <div className="p-3 space-y-3">
        {/* 1. LANE MANAGER - Horizontal Tabs */}
        <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-slate-700 pb-1">
                <div className="flex items-center gap-1.5">
                    <Layers size={14} className="text-indigo-400" />
                    <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Lanes</h2>
                </div>
                <div className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">{lanes.filter(l => l.enabled).length} Enabled</div>
            </div>
            
            {/* TAB BAR */}
            <div className="flex flex-wrap gap-1.5">
                {lanes.map(lane => {
                    const isActive = activeLaneId === lane.id;
                    const isEditing = editingNameId === lane.id;
                    return (
                        <div 
                            key={lane.id}
                            onClick={() => !isEditing && onSelectLane(lane.id)}
                            className={`group relative flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded border cursor-pointer select-none transition-all ${
                                isActive ? 'bg-slate-700 border-indigo-500/50 ring-1 ring-indigo-500/20' : 'bg-slate-900/40 border-slate-700 hover:bg-slate-700/50'
                            }`}
                            style={isActive ? { borderLeftColor: lane.color, borderLeftWidth: '3px' } : {}}
                        >
                            <div className={`w-1.5 h-1.5 rounded-full ${lane.enabled ? 'animate-pulse' : 'opacity-30'}`} style={{ backgroundColor: lane.color }} />
                            {isEditing ? (
                                <input 
                                    autoFocus
                                    value={tempName}
                                    onChange={(e) => setTempName(e.target.value)}
                                    onBlur={handleFinishRename}
                                    onKeyDown={(e) => e.key === 'Enter' && handleFinishRename()}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-16 bg-slate-900 text-white text-[10px] font-bold px-1 py-0 rounded outline-none border border-indigo-500"
                                />
                            ) : (
                                <span className={`text-[10px] font-bold ${isActive ? 'text-white' : 'text-slate-400'}`}>{lane.name}</span>
                            )}
                            <div className="flex items-center gap-0.5 ml-1">
                                {!isEditing && isActive && <button onClick={(e) => { e.stopPropagation(); handleStartRename(lane); }} className="p-0.5 text-slate-500 hover:text-white" title="Rename"><Pencil size={8} /></button>}
                                <input type="checkbox" checked={lane.enabled} onChange={(e) => { e.stopPropagation(); onToggleLane?.(lane.id); }} className="w-2.5 h-2.5 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-0 cursor-pointer ml-0.5" title="Toggle" />
                                {lanes.length > 1 && isActive && <button onClick={(e) => { e.stopPropagation(); onDeleteLane(lane.id); }} className="p-0.5 text-slate-600 hover:text-red-400 ml-0.5" title="Delete"><Trash2 size={8} /></button>}
                            </div>
                        </div>
                    );
                })}
                <button onClick={onAddLane} disabled={simStatus !== 'IDLE'} className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded shadow transition-colors disabled:opacity-50"><Plus size={10} /> Lane</button>
            </div>
        </div>

        {children && <div className="py-1">{children}</div>}

        {/* 2. Configuration for ACTIVE LANE */}
        <div className="pt-2 border-t border-slate-700 space-y-3">
            <div className="flex items-center gap-1.5">
                <Brain size={14} className="text-blue-400" />
                <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Strategy: <span style={{color: activeLane.color}}>{activeLane.name}</span></h2>
            </div>

            {/* MODE TOGGLE */}
            <div className="flex bg-slate-900 p-0.5 rounded border border-slate-700">
                <button onClick={() => setConfig({ ...config, strategyMode: 'STATIC' })} disabled={simStatus !== 'IDLE'} className={`flex-1 py-1 text-[10px] font-bold rounded transition-all disabled:opacity-70 ${config.strategyMode === 'STATIC' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-300'}`}>BOARD LAYOUT</button>
                <button onClick={() => setConfig({ ...config, strategyMode: 'ROTATING' })} disabled={simStatus !== 'IDLE'} className={`flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-bold rounded transition-all disabled:opacity-70 ${config.strategyMode === 'ROTATING' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-300'}`}><RotateCw size={10} />ROTATING</button>
                <button onClick={() => setConfig({ ...config, strategyMode: 'CHAIN' })} disabled={simStatus !== 'IDLE'} className={`flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-bold rounded transition-all disabled:opacity-70 ${config.strategyMode === 'CHAIN' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-300'}`}><Link2 size={10} />CHAIN</button>
            </div>

            {hasBaseBets && hasTriggers && config.strategyMode === 'STATIC' && (
                <div className="flex items-start gap-1 p-2 bg-amber-900/30 border border-amber-600/30 rounded text-[10px] text-amber-200">
                    <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                    <div><span className="font-bold">Warning:</span> Both Base Bets and Triggers active.</div>
                </div>
            )}

            {/* STATIC MODE SETTINGS */}
            {config.strategyMode === 'STATIC' && (
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-green-400 uppercase">On Win</label>
                    <select value={config.onWinAction} onChange={(e) => handleChangeAction('win', e.target.value)} disabled={simStatus !== 'IDLE'} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white disabled:opacity-50">
                        <option value={ProgressionAction.RESET}>Reset</option>
                        <option value={ProgressionAction.MULTIPLY}>Multiply</option>
                        <option value={ProgressionAction.ADD_UNITS}>Add Unit</option>
                        <option value={ProgressionAction.SUBTRACT_UNITS}>Sub Unit</option>
                        <option value={ProgressionAction.FIBONACCI}>Fibonacci</option>
                        <option value={ProgressionAction.DO_NOTHING}>Flat</option>
                    </select>
                    {config.onWinAction !== ProgressionAction.RESET && config.onWinAction !== ProgressionAction.DO_NOTHING && (
                        <input type="number" placeholder="Value" value={config.onWinValue} onChange={(e) => setConfig({ ...config, onWinValue: parseFloat(e.target.value) })} disabled={simStatus !== 'IDLE'} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white disabled:opacity-50"/>
                    )}
                </div>
                <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-red-400 uppercase">On Loss</label>
                    <select value={config.onLossAction} onChange={(e) => handleChangeAction('loss', e.target.value)} disabled={simStatus !== 'IDLE'} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white disabled:opacity-50">
                        <option value={ProgressionAction.RESET}>Reset</option>
                        <option value={ProgressionAction.MULTIPLY}>Multiply</option>
                        <option value={ProgressionAction.ADD_UNITS}>Add Unit</option>
                        <option value={ProgressionAction.SUBTRACT_UNITS}>Sub Unit</option>
                        <option value={ProgressionAction.FIBONACCI}>Fibonacci</option>
                        <option value={ProgressionAction.DO_NOTHING}>Flat</option>
                    </select>
                    {config.onLossAction !== ProgressionAction.RESET && config.onLossAction !== ProgressionAction.DO_NOTHING && (
                        <input type="number" placeholder="Value" value={config.onLossValue} onChange={(e) => setConfig({ ...config, onLossValue: parseFloat(e.target.value) })} disabled={simStatus !== 'IDLE'} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white disabled:opacity-50"/>
                    )}
                </div>
            </div>
            )}

            {/* CHAIN MODE SETTINGS */}
            {config.strategyMode === 'CHAIN' && (
                <div className="space-y-3">
                    {/* 1. Selector */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">Available Favorites</label>
                            {/* "Smart Save" - If list is empty but table has bets, show direct save option */}
                            {savedLayouts.length === 0 && activeLane.bets.length > 0 && onSaveCurrentLayout && (
                                <button 
                                    onClick={onSaveCurrentLayout}
                                    className="flex items-center gap-1 text-[9px] text-emerald-400 hover:text-emerald-300 bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-500/30 transition-colors"
                                >
                                    <Download size={10} /> Save Board as Favorite
                                </button>
                            )}
                        </div>
                        
                        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-900 rounded border border-slate-700 min-h-[40px] max-h-[120px] overflow-y-auto">
                            {savedLayouts.length === 0 ? (
                                <div className="w-full flex flex-col items-center justify-center gap-2 py-2">
                                    <span className="text-[10px] text-slate-500 italic text-center">
                                        No favorites found.
                                    </span>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setConfig({ ...config, strategyMode: 'STATIC' })}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded shadow transition-colors"
                                        >
                                            <Edit3 size={10} /> Go to Board
                                        </button>
                                        {activeLane.bets.length > 0 && onSaveCurrentLayout && (
                                            <button 
                                                onClick={onSaveCurrentLayout}
                                                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded shadow transition-colors"
                                            >
                                                <Save size={10} /> Save Board
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                savedLayouts.map(layout => (
                                    <button 
                                        key={layout.id} 
                                        onClick={() => handleAddChainStep(layout)}
                                        disabled={simStatus !== 'IDLE'}
                                        className="px-2 py-1 bg-slate-800 hover:bg-indigo-600 border border-slate-600 text-[10px] text-white rounded shadow transition-colors"
                                    >
                                        + {layout.name} <span className="text-slate-400 ml-1">(${layout.bets.reduce((a,b)=>a+b.amount,0)})</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 2. Chain Sequence Editor */}
                    <div className="space-y-1">
                         <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-indigo-400 uppercase">Progression Sequence</label>
                            <span className="text-[9px] font-mono text-slate-500">{config.chainSteps?.length || 0} Steps</span>
                         </div>
                         <div className="relative flex flex-col gap-1 p-2 bg-slate-900/50 rounded border border-slate-700 min-h-[100px] max-h-[200px] overflow-y-auto custom-scrollbar">
                             {(!config.chainSteps || config.chainSteps.length === 0) ? (
                                 <div className="flex flex-col items-center justify-center py-6 text-slate-600 text-[10px] italic">
                                     <Link2 size={16} className="mb-1 opacity-50" />
                                     Add favorites above to build sequence
                                 </div>
                             ) : (
                                 config.chainSteps.map((step, idx) => (
                                     <div key={idx} className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                                         <span className="font-mono text-[9px] text-slate-500 w-4 text-center">{idx+1}.</span>
                                         <div className="flex-1 flex items-center justify-between px-2 py-1.5 bg-slate-800 border border-slate-600 rounded">
                                             <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-white">{step.name}</span>
                                                <span className="text-[9px] text-slate-500 bg-slate-900 px-1 rounded">${step.bets.reduce((a,b)=>a+b.amount,0)}</span>
                                             </div>
                                             <button onClick={() => handleRemoveChainStep(idx)} disabled={simStatus !== 'IDLE'} className="text-slate-500 hover:text-red-400"><X size={12} /></button>
                                         </div>
                                         {idx < (config.chainSteps?.length || 0) - 1 && (
                                             <ArrowDown size={10} className="text-slate-600 mx-auto block md:hidden" />
                                         )}
                                     </div>
                                 ))
                             )}
                         </div>
                    </div>

                    {/* 3. Logic Controls */}
                    <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-700">
                        <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-green-400 uppercase">On Win</label>
                            <select value={config.chainOnWin} onChange={(e) => setConfig({...config, chainOnWin: e.target.value as ProgressionAction})} disabled={simStatus !== 'IDLE'} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white">
                                <option value={ProgressionAction.RESTART_CHAIN}>Restart Chain</option>
                                <option value={ProgressionAction.NEXT_CHAIN_STEP}>Next Step</option>
                                <option value={ProgressionAction.PREV_CHAIN_STEP}>Previous Step</option>
                                <option value={ProgressionAction.DO_NOTHING}>Stay on Step</option>
                            </select>
                        </div>
                        <div className="space-y-1">
                            <label className="block text-[10px] font-bold text-red-400 uppercase">On Loss</label>
                            <select value={config.chainOnLoss} onChange={(e) => setConfig({...config, chainOnLoss: e.target.value as ProgressionAction})} disabled={simStatus !== 'IDLE'} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white">
                                <option value={ProgressionAction.NEXT_CHAIN_STEP}>Next Step</option>
                                <option value={ProgressionAction.RESTART_CHAIN}>Restart Chain</option>
                                <option value={ProgressionAction.PREV_CHAIN_STEP}>Previous Step</option>
                                <option value={ProgressionAction.DO_NOTHING}>Stay on Step</option>
                            </select>
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-1">
                         <label className="flex items-center gap-1.5 text-[10px] text-slate-300 cursor-pointer select-none">
                             <input type="checkbox" checked={config.chainLoop} onChange={(e) => setConfig({ ...config, chainLoop: e.target.checked })} disabled={simStatus !== 'IDLE'} className="rounded bg-slate-900 border-slate-600 text-indigo-500 focus:ring-0"/>
                             Loop to Start after Last Step
                         </label>
                    </div>

                </div>
            )}

            {/* ROTATING MODE SETTINGS */}
            {config.strategyMode === 'ROTATING' && (
            <div className="space-y-2">
                <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-indigo-400 uppercase">Sequence</label>
                    <textarea value={config.sequence} onChange={(e) => setConfig({ ...config, sequence: e.target.value })} disabled={simStatus !== 'IDLE'} placeholder="red, black..." className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white disabled:opacity-50 min-h-[40px]"/>
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-0.5">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase">Base ($)</label>
                        <input type="number" value={config.baseUnit} onChange={(e) => setConfig({ ...config, baseUnit: Number(e.target.value) })} disabled={simStatus !== 'IDLE'} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white disabled:opacity-50"/>
                    </div>
                    <div className="space-y-0.5">
                        <label className="block text-[9px] font-bold text-green-400 uppercase">Win (U)</label>
                        <input type="number" value={config.onWinUnits} onChange={(e) => setConfig({ ...config, onWinUnits: Number(e.target.value) })} disabled={simStatus !== 'IDLE'} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white disabled:opacity-50"/>
                    </div>
                    <div className="space-y-0.5">
                        <label className="block text-[9px] font-bold text-red-400 uppercase">Loss (U)</label>
                        <input type="number" value={config.onLossUnits} onChange={(e) => setConfig({ ...config, onLossUnits: Number(e.target.value) })} disabled={simStatus !== 'IDLE'} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white disabled:opacity-50"/>
                    </div>
                    <div className="space-y-0.5">
                        <label className="block text-[9px] font-bold text-slate-400 uppercase">Min (U)</label>
                        <input type="number" value={config.minUnits} onChange={(e) => setConfig({ ...config, minUnits: Number(e.target.value) })} disabled={simStatus !== 'IDLE'} className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs text-white disabled:opacity-50"/>
                    </div>
                </div>
                <div className="flex gap-2 pt-1">
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-300 cursor-pointer select-none">
                        <input type="checkbox" checked={config.rotateOnWin} onChange={(e) => setConfig({ ...config, rotateOnWin: e.target.checked })} disabled={simStatus !== 'IDLE'} className="rounded bg-slate-900 border-slate-600 text-indigo-500 focus:ring-0"/>
                        Rotate on Win
                    </label>
                    <label className="flex items-center gap-1.5 text-[10px] text-slate-300 cursor-pointer select-none">
                        <input type="checkbox" checked={config.rotateOnLoss} onChange={(e) => setConfig({ ...config, rotateOnLoss: e.target.checked })} disabled={simStatus !== 'IDLE'} className="rounded bg-slate-900 border-slate-600 text-indigo-500 focus:ring-0"/>
                        Rotate on Loss
                    </label>
                </div>
            </div>
            )}

            {/* RESET ON SESSION PROFIT */}
            <div className="pt-2 border-t border-slate-700">
                <div className="flex items-center justify-between mb-1">
                    <label className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase cursor-pointer select-none">
                        <input type="checkbox" checked={config.useResetOnSessionProfit} onChange={(e) => setConfig({ ...config, useResetOnSessionProfit: e.target.checked })} disabled={simStatus !== 'IDLE'} className="rounded bg-slate-900 border-slate-600 text-emerald-500 focus:ring-0"/>
                        Reset on Profit
                    </label>
                </div>
                {config.useResetOnSessionProfit && (
                     <div className="flex items-center gap-2 bg-emerald-900/20 px-2 py-1 rounded border border-emerald-500/30">
                         <span className="text-xs text-emerald-200">Reset if Profit &ge;</span>
                         <input type="number" value={config.resetOnSessionProfit} onChange={(e) => setConfig({ ...config, resetOnSessionProfit: Number(e.target.value) })} disabled={simStatus !== 'IDLE'} className="w-16 bg-slate-900 border border-slate-600 rounded px-1 py-0.5 text-xs text-white disabled:opacity-50 font-mono text-center"/>
                     </div>
                )}
            </div>

            {/* 3. TRIGGER BETS */}
            <div className="pt-2 border-t border-slate-700 space-y-2">
                 <div className="flex items-center justify-between">
                     <div className="flex items-center gap-1.5">
                         <Zap size={14} className="text-orange-400" />
                         <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Triggers ({triggerBets.length})</h2>
                     </div>
                     <button onClick={handleOpenNewTrigger} disabled={simStatus !== 'IDLE'} className="p-1 text-slate-400 hover:text-orange-400 hover:bg-slate-800 rounded transition-colors" title="Add Trigger"><Plus size={14} /></button>
                 </div>
                 
                 <div className="space-y-1.5">
                     {triggerBets.length === 0 ? (
                         <div className="text-[10px] text-slate-500 italic text-center py-2 border border-dashed border-slate-700 rounded bg-slate-900/30">
                             No trigger bets active
                         </div>
                     ) : (
                         triggerBets.map((trigger, idx) => (
                             <div key={trigger.id} className="group flex items-center gap-2 bg-slate-900/60 p-1.5 rounded border border-slate-700 hover:border-orange-500/50 transition-colors cursor-pointer" onClick={() => handleEditTrigger(trigger)}>
                                 <div className={`w-1.5 h-full self-stretch rounded-full ${trigger.active ? 'bg-orange-500' : 'bg-slate-600'}`} />
                                 <div className="flex-1 min-w-0">
                                     <div className="flex items-center gap-1 text-[10px] text-slate-300">
                                         <span className="font-bold text-orange-200">{trigger.rule === 'MISS_STREAK' ? 'Miss' : 'Hit'} {trigger.threshold}x</span>
                                         <span className="text-slate-500">&rarr;</span>
                                         <span className="truncate" title={trigger.betPlacement.displayName}>{trigger.betPlacement.displayName}</span>
                                     </div>
                                     <div className="text-[9px] text-slate-500 font-mono">
                                         Bet: ${trigger.betAmount}
                                     </div>
                                 </div>
                                 <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <button onClick={(e) => { e.stopPropagation(); setTriggerBets(prev => prev.filter(t => t.id !== trigger.id)); }} className="text-slate-600 hover:text-red-400"><X size={12} /></button>
                                 </div>
                             </div>
                         ))
                     )}
                 </div>
            </div>

        </div>

        {/* TRIGGER MODAL */}
        <TriggerSetupModal 
            isOpen={isTriggerModalOpen}
            onClose={() => setIsTriggerModalOpen(false)}
            onSave={handleSaveTrigger}
            existingTrigger={editingTrigger}
            laneColor={activeLane.color}
        />

    </div>
  );
};
