import React, { useState, useEffect, useRef } from 'react';
import { ProgressionConfig, ProgressionAction, SimulationSettings, SimulationSpeed, SimulationStatus, StrategyMode } from '../types';
import { generateStrategyFromDescription } from '../services/geminiService';
import { Brain, Loader2, Settings, PlayCircle, Target, ShieldAlert, Save, FolderOpen, Plus, Trash2, Zap, Clock, MousePointerClick, Pause, Square, SkipForward, Play, ChevronDown, Pencil, RotateCw } from 'lucide-react';

interface StrategyPanelProps {
  config: ProgressionConfig;
  setConfig: (config: ProgressionConfig) => void;
  settings: SimulationSettings;
  setSettings: (settings: SimulationSettings) => void;
  onSimulate: () => void;
  
  // Speed & Control Props
  speed: SimulationSpeed;
  setSpeed: (speed: SimulationSpeed) => void;
  simStatus: SimulationStatus;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onNextSpin: () => void;
}

interface SavedStrategy {
  id: string;
  name: string;
  config: ProgressionConfig;
}

const StrategyPanel: React.FC<StrategyPanelProps> = ({ 
  config, setConfig, settings, setSettings, onSimulate,
  speed, setSpeed, simStatus, onPause, onResume, onStop, onNextSpin
}) => {
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Strategy Management State
  const [strategyName, setStrategyName] = useState("My Strategy");
  const [showLoadMenu, setShowLoadMenu] = useState(false);
  const loadMenuRef = useRef<HTMLDivElement>(null);

  const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>(() => {
    try {
      const saved = localStorage.getItem('roulette_strategies');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist strategies when changed
  useEffect(() => {
    localStorage.setItem('roulette_strategies', JSON.stringify(savedStrategies));
  }, [savedStrategies]);

  // Click outside to close load menu
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (loadMenuRef.current && !loadMenuRef.current.contains(event.target as Node)) {
              setShowLoadMenu(false);
          }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    try {
      const newConfig = await generateStrategyFromDescription(aiPrompt);
      if (newConfig) {
        setConfig({ ...config, ...newConfig });
      } else {
        alert("Could not generate strategy. Please try a clearer description.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiLoading(false);
    }
  };

  const updateSetting = (key: keyof SimulationSettings, value: number) => {
    setSettings({ ...settings, [key]: value });
  };

  // Strategy CRUD Actions
  const handleSaveStrategy = () => {
    if (!strategyName.trim()) {
        alert("Please enter a strategy name");
        return;
    }

    const existingIndex = savedStrategies.findIndex(s => s.name.toLowerCase() === strategyName.toLowerCase());
    
    if (existingIndex >= 0) {
        if (!window.confirm(`Overwrite existing strategy "${savedStrategies[existingIndex].name}"?`)) return;
        const updated = [...savedStrategies];
        updated[existingIndex] = { ...updated[existingIndex], config: { ...config } };
        setSavedStrategies(updated);
    } else {
        const newStrategy: SavedStrategy = {
            id: Date.now().toString(),
            name: strategyName,
            config: { ...config }
        };
        setSavedStrategies(prev => [...prev, newStrategy]);
    }
  };

  const handleLoadStrategy = (strategy: SavedStrategy) => {
    setConfig({
        ...strategy.config,
        // Ensure backward compatibility
        strategyMode: strategy.config.strategyMode || 'STATIC',
        sequence: strategy.config.sequence || "red, black",
        onWinUnits: strategy.config.onWinUnits ?? -1,
        onLossUnits: strategy.config.onLossUnits ?? 1,
        minUnits: strategy.config.minUnits ?? 1,
        rotateOnWin: strategy.config.rotateOnWin ?? true,
        rotateOnLoss: strategy.config.rotateOnLoss ?? true,
        useTotalProfitGoal: strategy.config.useTotalProfitGoal ?? false,
        useResetOnSessionProfit: strategy.config.useResetOnSessionProfit ?? false
    });
    setStrategyName(strategy.name);
    setShowLoadMenu(false);
  };

  const handleDeleteStrategy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this strategy?")) {
      setSavedStrategies(prev => prev.filter(s => s.id !== id));
    }
  };

  const handleNewStrategy = () => {
    if (window.confirm("Start new strategy? Unsaved changes will be lost.")) {
      setConfig({
        strategyMode: 'STATIC',
        onWinAction: ProgressionAction.RESET,
        onWinValue: 0,
        onLossAction: ProgressionAction.MULTIPLY,
        onLossValue: 2,
        stopLoss: 1000,
        totalProfitGoal: 1000,
        useTotalProfitGoal: false,
        resetOnSessionProfit: 150,
        useResetOnSessionProfit: false,
        baseUnit: 5,
        sequence: "red, black",
        onWinUnits: -1,
        onLossUnits: 1,
        minUnits: 1,
        rotateOnWin: true,
        rotateOnLoss: true
      });
      setStrategyName("New Strategy");
    }
  };

  const handleChangeAction = (type: 'win' | 'loss', value: string) => {
      const action = value as ProgressionAction;
      if (type === 'win') {
          let newVal = config.onWinValue;
          // Set sensible defaults when switching
          if (action === ProgressionAction.FIBONACCI && newVal === 0) newVal = 2; // Default step back
          setConfig({ ...config, onWinAction: action, onWinValue: newVal });
      } else {
          let newVal = config.onLossValue;
          if (action === ProgressionAction.FIBONACCI && newVal === 0) newVal = 1; // Default step forward
          setConfig({ ...config, onLossAction: action, onLossValue: newVal });
      }
  };

  return (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-8">
      
      {/* 1. Global Simulation Settings */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-700 pb-2">
          <Settings size={18} className="text-blue-400" />
          <h2 className="text-lg font-bold text-white">Table & Bankroll</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
           <div>
              <label className="text-xs text-slate-400 font-semibold uppercase">Start Bankroll ($)</label>
              <input 
                type="number" 
                value={settings.startingBankroll}
                onChange={(e) => updateSetting('startingBankroll', Number(e.target.value))}
                disabled={simStatus !== 'IDLE'}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none disabled:opacity-50"
              />
           </div>
           <div>
              <label className="text-xs text-slate-400 font-semibold uppercase">Table Min ($)</label>
              <input 
                type="number" 
                value={settings.tableMin}
                onChange={(e) => updateSetting('tableMin', Number(e.target.value))}
                disabled={simStatus !== 'IDLE'}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none disabled:opacity-50"
              />
           </div>
           <div>
              <label className="text-xs text-slate-400 font-semibold uppercase">Table Max ($)</label>
              <input 
                type="number" 
                value={settings.tableMax}
                onChange={(e) => updateSetting('tableMax', Number(e.target.value))}
                disabled={simStatus !== 'IDLE'}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-blue-500 outline-none disabled:opacity-50"
              />
           </div>
        </div>
      </div>

      {/* 2. Progression Strategy */}
      <div className="space-y-4">
        {/* Strategy Toolbar - CENTERED HEADER */}
        <div className="flex flex-col gap-4 border-b border-slate-700 pb-6">
            <div className="flex items-center justify-center gap-2 text-indigo-300">
                <Brain size={18} />
                <span className="text-xs font-bold uppercase tracking-wider">Strategy Logic</span>
            </div>

            <div className="flex flex-col xl:flex-row items-center justify-center gap-3">
                {/* Editable Name Input */}
                <div className="relative w-full xl:w-auto flex-1 max-w-md group order-2 xl:order-1">
                    <input 
                        type="text"
                        value={strategyName}
                        onChange={(e) => setStrategyName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 focus:border-indigo-500 rounded-lg px-4 py-2 font-bold text-lg text-white text-center outline-none transition-colors shadow-sm focus:shadow-indigo-500/20"
                        placeholder="Strategy Name"
                        disabled={simStatus !== 'IDLE'}
                    />
                    <Pencil size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-hover:text-slate-300 transition-colors opacity-0 group-hover:opacity-100" />
                </div>

                {/* Toolbar Buttons */}
                <div className="flex gap-2 shrink-0 order-1 xl:order-2">
                    <button 
                        onClick={handleNewStrategy} 
                        className="p-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
                        title="New Strategy"
                        disabled={simStatus !== 'IDLE'}
                    >
                        <Plus size={18} />
                    </button>

                    <div className="relative" ref={loadMenuRef}>
                        <button 
                            onClick={() => setShowLoadMenu(!showLoadMenu)} 
                            className={`flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${showLoadMenu ? 'bg-slate-600 ring-2 ring-slate-500' : ''}`}
                            title="Load Strategy"
                            disabled={simStatus !== 'IDLE'}
                        >
                            <FolderOpen size={18} /> <span className="hidden sm:inline">Load</span>
                        </button>

                        {/* Load Dropdown */}
                        {showLoadMenu && (
                            <div className="absolute top-full right-0 mt-1 w-64 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                {savedStrategies.length === 0 ? (
                                    <div className="p-4 text-center text-slate-500 text-xs italic">No saved strategies</div>
                                ) : (
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                        {savedStrategies.map(s => (
                                            <div key={s.id} className="flex items-center justify-between p-2 hover:bg-slate-700 border-b border-slate-700/50 last:border-0 group">
                                                <button 
                                                    onClick={() => handleLoadStrategy(s)}
                                                    className="flex-1 text-left text-sm text-slate-200 truncate pr-2"
                                                >
                                                    {s.name}
                                                </button>
                                                <button 
                                                    onClick={(e) => handleDeleteStrategy(s.id, e)}
                                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-all"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={handleSaveStrategy} 
                        className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40"
                        title="Save Strategy"
                        disabled={simStatus !== 'IDLE'}
                    >
                        <Save size={18} /> <span className="hidden sm:inline">Save</span>
                    </button>
                </div>
            </div>
        </div>

        {/* AI Assistant */}
        <div className="bg-indigo-900/20 p-3 rounded-lg border border-indigo-500/20">
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder='AI Helper: e.g. "Fibonacci on loss, step back 2 on win"' 
              className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              disabled={simStatus !== 'IDLE'}
            />
            <button 
              onClick={handleAiGenerate}
              disabled={isAiLoading || simStatus !== 'IDLE'}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1 rounded text-xs font-medium flex items-center gap-1 whitespace-nowrap"
            >
              {isAiLoading ? <Loader2 className="animate-spin" size={12} /> : 'Ask AI'}
            </button>
          </div>
        </div>

        {/* MODE TOGGLE */}
        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
            <button
                onClick={() => setConfig({ ...config, strategyMode: 'STATIC' })}
                disabled={simStatus !== 'IDLE'}
                className={`flex-1 py-2 text-xs font-bold rounded transition-all disabled:opacity-70 ${config.strategyMode === 'STATIC' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-300'}`}
            >
                STATIC BETS
            </button>
            <button
                onClick={() => setConfig({ ...config, strategyMode: 'ROTATING' })}
                disabled={simStatus !== 'IDLE'}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded transition-all disabled:opacity-70 ${config.strategyMode === 'ROTATING' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-300'}`}
            >
                <RotateCw size={12} />
                ROTATING
            </button>
        </div>

        {/* STATIC MODE SETTINGS */}
        {config.strategyMode === 'STATIC' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in zoom-in-95">
            {/* On Win */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-green-400 uppercase">On Win</label>
              <select 
                value={config.onWinAction}
                onChange={(e) => handleChangeAction('win', e.target.value)}
                disabled={simStatus !== 'IDLE'}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                <option value={ProgressionAction.RESET}>Reset to Base</option>
                <option value={ProgressionAction.MULTIPLY}>Multiply Bet</option>
                <option value={ProgressionAction.ADD_UNITS}>Add Units</option>
                <option value={ProgressionAction.SUBTRACT_UNITS}>Subtract Units</option>
                <option value={ProgressionAction.FIBONACCI}>Fibonacci (Step Back)</option>
                <option value={ProgressionAction.DO_NOTHING}>Same Bet</option>
              </select>
              
              {config.onWinAction !== ProgressionAction.RESET && config.onWinAction !== ProgressionAction.DO_NOTHING && (
                 <div className="relative">
                    <input 
                      type="number" 
                      placeholder="Value"
                      value={config.onWinValue}
                      onChange={(e) => setConfig({ ...config, onWinValue: parseFloat(e.target.value) })}
                      disabled={simStatus !== 'IDLE'}
                      className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white disabled:opacity-50"
                    />
                    {config.onWinAction === ProgressionAction.FIBONACCI && (
                       <span className="absolute right-3 top-2 text-xs text-slate-500 pointer-events-none">Steps Back</span>
                    )}
                 </div>
              )}
            </div>

            {/* On Loss */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-red-400 uppercase">On Loss</label>
              <select 
                value={config.onLossAction}
                onChange={(e) => handleChangeAction('loss', e.target.value)}
                disabled={simStatus !== 'IDLE'}
                className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                <option value={ProgressionAction.RESET}>Reset to Base</option>
                <option value={ProgressionAction.MULTIPLY}>Multiply Bet</option>
                <option value={ProgressionAction.ADD_UNITS}>Add Units</option>
                <option value={ProgressionAction.SUBTRACT_UNITS}>Subtract Units</option>
                <option value={ProgressionAction.FIBONACCI}>Fibonacci Sequence</option>
                <option value={ProgressionAction.DO_NOTHING}>Same Bet</option>
              </select>

               {config.onLossAction !== ProgressionAction.RESET && config.onLossAction !== ProgressionAction.DO_NOTHING && (
                 <div className="relative">
                   <input 
                      type="number" 
                      placeholder="Value"
                      value={config.onLossValue}
                      onChange={(e) => setConfig({ ...config, onLossValue: parseFloat(e.target.value) })}
                      disabled={simStatus !== 'IDLE'}
                      className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white disabled:opacity-50"
                   />
                    {config.onLossAction === ProgressionAction.FIBONACCI && (
                       <span className="absolute right-3 top-2 text-xs text-slate-500 pointer-events-none">Steps Fwd</span>
                    )}
                 </div>
              )}
            </div>
          </div>
        )}

        {/* ROTATING MODE SETTINGS */}
        {config.strategyMode === 'ROTATING' && (
          <div className="space-y-4 animate-in fade-in zoom-in-95">
             <div className="space-y-2">
                <label className="block text-xs font-bold text-indigo-400 uppercase">Bet Sequence</label>
                <textarea 
                    value={config.sequence}
                    onChange={(e) => setConfig({ ...config, sequence: e.target.value })}
                    disabled={simStatus !== 'IDLE'}
                    placeholder="e.g. red, black, even, odd, 1-18"
                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white disabled:opacity-50 min-h-[60px]"
                />
                <p className="text-[10px] text-slate-500">Allowed: red, black, even, odd, 1-18, 19-36</p>
             </div>
             
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase">Base Unit ($)</label>
                    <input 
                      type="number" 
                      value={config.baseUnit}
                      onChange={(e) => setConfig({ ...config, baseUnit: Number(e.target.value) })}
                      disabled={simStatus !== 'IDLE'}
                      className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white disabled:opacity-50"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-green-400 uppercase">On Win (Units)</label>
                    <input 
                      type="number" 
                      value={config.onWinUnits}
                      onChange={(e) => setConfig({ ...config, onWinUnits: Number(e.target.value) })}
                      disabled={simStatus !== 'IDLE'}
                      className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white disabled:opacity-50"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-red-400 uppercase">On Loss (Units)</label>
                    <input 
                      type="number" 
                      value={config.onLossUnits}
                      onChange={(e) => setConfig({ ...config, onLossUnits: Number(e.target.value) })}
                      disabled={simStatus !== 'IDLE'}
                      className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white disabled:opacity-50"
                    />
                 </div>
                 <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase">Min Units</label>
                    <input 
                      type="number" 
                      value={config.minUnits}
                      min="1"
                      onChange={(e) => setConfig({ ...config, minUnits: Number(e.target.value) })}
                      disabled={simStatus !== 'IDLE'}
                      className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white disabled:opacity-50"
                    />
                 </div>
             </div>

             <div className="flex gap-6 pt-2">
                <div className="flex items-center gap-2">
                    <input 
                        id="cbRotateWin"
                        type="checkbox"
                        checked={config.rotateOnWin}
                        onChange={(e) => setConfig({ ...config, rotateOnWin: e.target.checked })}
                        disabled={simStatus !== 'IDLE'}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="cbRotateWin" className="text-xs font-semibold text-slate-300 cursor-pointer select-none">Rotate on Win</label>
                </div>
                <div className="flex items-center gap-2">
                    <input 
                        id="cbRotateLoss"
                        type="checkbox"
                        checked={config.rotateOnLoss}
                        onChange={(e) => setConfig({ ...config, rotateOnLoss: e.target.checked })}
                        disabled={simStatus !== 'IDLE'}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="cbRotateLoss" className="text-xs font-semibold text-slate-300 cursor-pointer select-none">Rotate on Loss</label>
                </div>
             </div>
          </div>
        )}
        
        {/* Goals & Limits */}
        <div className="border-t border-slate-700 pt-4 space-y-4">
           <div className="flex items-center gap-2">
             <Target size={18} className="text-yellow-400" />
             <h3 className="text-sm font-bold text-white uppercase tracking-wider">Goals & Safety</h3>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Reset Session Profit */}
              <div className={`bg-slate-900/50 p-3 rounded border border-slate-700 transition-opacity ${!config.useResetOnSessionProfit ? 'opacity-80' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-400 font-semibold cursor-pointer" htmlFor="cbResetProfit">Reset at Profit ($)</label>
                      <input 
                          id="cbResetProfit"
                          type="checkbox"
                          checked={config.useResetOnSessionProfit}
                          onChange={(e) => setConfig({ ...config, useResetOnSessionProfit: e.target.checked })}
                          disabled={simStatus !== 'IDLE'}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer"
                      />
                  </div>
                  <div className="text-[10px] text-slate-500 mb-2">Resets bets to base when this amount is won in a sequence (e.g. 150).</div>
                  <input 
                    type="number" 
                    value={config.resetOnSessionProfit}
                    onChange={(e) => setConfig({ ...config, resetOnSessionProfit: Number(e.target.value) })}
                    disabled={simStatus !== 'IDLE' || !config.useResetOnSessionProfit}
                    className={`w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-yellow-400 font-bold disabled:opacity-50 transition-colors ${!config.useResetOnSessionProfit ? 'text-slate-500' : ''}`}
                  />
              </div>

              {/* Total Profit Goal */}
              <div className={`bg-slate-900/50 p-3 rounded border border-slate-700 transition-opacity ${!config.useTotalProfitGoal ? 'opacity-80' : ''}`}>
                  <div className="flex items-center justify-between mb-1">
                      <label className="text-xs text-slate-400 font-semibold cursor-pointer" htmlFor="cbProfitGoal">Total Profit Goal ($)</label>
                      <input 
                          id="cbProfitGoal"
                          type="checkbox"
                          checked={config.useTotalProfitGoal}
                          onChange={(e) => setConfig({ ...config, useTotalProfitGoal: e.target.checked })}
                          disabled={simStatus !== 'IDLE'}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer"
                      />
                  </div>
                   <div className="text-[10px] text-slate-500 mb-2">Stop simulation when bankroll increases by this amount (e.g. 1000).</div>
                  <input 
                    type="number" 
                    value={config.totalProfitGoal}
                    onChange={(e) => setConfig({ ...config, totalProfitGoal: Number(e.target.value) })}
                    disabled={simStatus !== 'IDLE' || !config.useTotalProfitGoal}
                    className={`w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-green-400 font-bold disabled:opacity-50 transition-colors ${!config.useTotalProfitGoal ? 'text-slate-500' : ''}`}
                  />
              </div>

              <div className="bg-slate-900/50 p-3 rounded border border-slate-700 col-span-1 md:col-span-2">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert size={12} className="text-red-400"/>
                    <label className="text-xs text-slate-400 font-semibold">Max Loss Limit ($)</label>
                  </div>
                  <input 
                    type="number" 
                    value={config.stopLoss}
                    onChange={(e) => setConfig({ ...config, stopLoss: Number(e.target.value) })}
                    disabled={simStatus !== 'IDLE'}
                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white disabled:opacity-50"
                  />
              </div>
           </div>
        </div>
      </div>

      {/* 3. Run Controls */}
      <div className="pt-4 border-t border-slate-700 space-y-4">
        <div className="grid grid-cols-2 gap-4">
           <div>
               <label className="text-xs text-slate-400 font-semibold uppercase">Spins per Sim</label>
               <input 
                 type="number"
                 min="1"
                 max="10000"
                 value={settings.spinsPerSimulation}
                 onChange={(e) => updateSetting('spinsPerSimulation', Number(e.target.value))}
                 disabled={simStatus !== 'IDLE'}
                 className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white disabled:opacity-50"
               />
           </div>
           <div>
               <label className="text-xs text-slate-400 font-semibold uppercase"># of Simulations</label>
               <input 
                 type="number"
                 min="1"
                 max="1000"
                 value={settings.numberOfSimulations}
                 onChange={(e) => updateSetting('numberOfSimulations', Number(e.target.value))}
                 disabled={simStatus !== 'IDLE'}
                 className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-white disabled:opacity-50"
               />
           </div>
        </div>

        {/* Speed Selection */}
        <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-700">
             <button 
                onClick={() => setSpeed('SLOW')}
                disabled={simStatus !== 'IDLE'}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded transition-all disabled:opacity-70 ${speed === 'SLOW' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
             >
                <MousePointerClick size={14} /> Slow (Manual)
             </button>
             <button 
                onClick={() => setSpeed('MEDIUM')}
                disabled={simStatus !== 'IDLE'}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded transition-all disabled:opacity-70 ${speed === 'MEDIUM' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
             >
                <Clock size={14} /> Medium (1s)
             </button>
             <button 
                onClick={() => setSpeed('FAST')}
                disabled={simStatus !== 'IDLE'}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded transition-all disabled:opacity-70 ${speed === 'FAST' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
             >
                <Zap size={14} /> Fast (Instant)
             </button>
        </div>

        {/* Action Buttons */}
        {simStatus === 'IDLE' ? (
            <button 
            onClick={onSimulate}
            className="w-full flex justify-center items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold py-4 rounded-lg shadow-lg transform transition active:scale-95 uppercase tracking-wide"
            >
            <PlayCircle size={20} />
            {settings.numberOfSimulations > 1 ? `Run Batch (${settings.numberOfSimulations})` : 'Run Simulation'}
            </button>
        ) : (
            <div className="grid grid-cols-4 gap-2">
                <button 
                   onClick={onStop}
                   className="col-span-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-1"
                   title="Stop Simulation"
                >
                    <Square size={16} fill="currentColor" />
                    Stop
                </button>
                
                {simStatus === 'RUNNING' ? (
                     <button 
                        onClick={onPause}
                        className="col-span-1 bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-lg flex items-center justify-center gap-1"
                        title="Pause"
                     >
                        <Pause size={18} fill="currentColor" />
                     </button>
                ) : (
                     <button 
                        onClick={onResume}
                        className="col-span-1 bg-green-500 hover:bg-green-400 text-black font-bold py-3 rounded-lg flex items-center justify-center gap-1"
                        title="Resume"
                     >
                        <Play size={18} fill="currentColor" />
                     </button>
                )}
                
                <button 
                   onClick={onNextSpin}
                   disabled={speed === 'FAST' || simStatus === 'PAUSED'}
                   className="col-span-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2"
                   title={speed === 'SLOW' ? "Next Spin (Spacebar)" : "Next Spin"}
                >
                   <SkipForward size={18} />
                   Next Spin
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

export default StrategyPanel;