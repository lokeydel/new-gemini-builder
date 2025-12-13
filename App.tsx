import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Bet, BetPlacement, ProgressionConfig, ProgressionAction, 
  SimulationSettings, SimulationStep, SimulationSpeed, SimulationStatus, 
  BatchStats
} from './types';
import { spinWheel, calculateWinnings } from './services/rouletteLogic';
import { analyzeSimulationResults, analyzeBatchResults } from './services/geminiService';
import { getPlacementIdentifier } from './utils/placements';
import RouletteTable from './components/RouletteBoard';
import StrategyPanel from './components/StrategyPanel';
import ChipSelector from './components/ChipSelector';
import StatsChart from './components/StatsChart';
import { RotateCcw, Trash2 } from 'lucide-react';

const App: React.FC = () => {
  // --- State ---
  const [bankroll, setBankroll] = useState(1000);
  const [currentBets, setCurrentBets] = useState<Bet[]>([]);
  const [history, setHistory] = useState<SimulationStep[]>([]);
  const [selectedChip, setSelectedChip] = useState(5);
  
  // Strategy Config
  const [strategyConfig, setStrategyConfig] = useState<ProgressionConfig>({
    onWinAction: ProgressionAction.RESET,
    onWinValue: 0,
    onLossAction: ProgressionAction.MULTIPLY,
    onLossValue: 2,
    stopLoss: 500,
    totalProfitGoal: 500,
    useTotalProfitGoal: false,
    resetOnSessionProfit: 150,
    useResetOnSessionProfit: false,
    baseUnit: 5,
  });

  // Simulation Settings
  const [settings, setSettings] = useState<SimulationSettings>({
    startingBankroll: 1000,
    tableMin: 1,
    tableMax: 5000,
    spinsPerSimulation: 100,
    numberOfSimulations: 1,
  });

  const [speed, setSpeed] = useState<SimulationSpeed>('MEDIUM');
  const [simStatus, setSimStatus] = useState<SimulationStatus>('IDLE');
  const [batchStats, setBatchStats] = useState<BatchStats | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');

  // Refs for accessing latest state inside async loops
  const simStatusRef = useRef<SimulationStatus>('IDLE');
  const speedRef = useRef<SimulationSpeed>('MEDIUM');
  const pauseResolverRef = useRef<((value: void | PromiseLike<void>) => void) | null>(null);
  const nextSpinResolverRef = useRef<((value: void | PromiseLike<void>) => void) | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const analysisIdRef = useRef<number>(0);

  // Sync refs with state
  useEffect(() => { simStatusRef.current = simStatus; }, [simStatus]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => {
      return () => { isMountedRef.current = false; };
  }, []);

  // --- Helpers ---

  const handleBetSelect = (placement: BetPlacement) => {
    if (simStatus !== 'IDLE') return;

    setCurrentBets(prev => {
      const existingBetIndex = prev.findIndex(b => getPlacementIdentifier(b.placement) === getPlacementIdentifier(placement));
      
      if (existingBetIndex >= 0) {
        // Update existing bet
        const updated = [...prev];
        updated[existingBetIndex] = {
          ...updated[existingBetIndex],
          amount: updated[existingBetIndex].amount + selectedChip
        };
        return updated;
      } else {
        // Add new bet
        return [...prev, {
          id: Date.now().toString() + Math.random(),
          placement,
          amount: selectedChip
        }];
      }
    });
  };

  const handleClearBets = () => {
    if (simStatus === 'IDLE') setCurrentBets([]);
  };
  
  const handleRemoveBet = (placement: BetPlacement, removeAll: boolean) => {
    if (simStatus !== 'IDLE') return;
    
    setCurrentBets(prev => {
        const id = getPlacementIdentifier(placement);
        const index = prev.findIndex(b => getPlacementIdentifier(b.placement) === id);
        if (index === -1) return prev;

        if (removeAll) {
            return prev.filter((_, i) => i !== index);
        } else {
            const bet = prev[index];
            if (bet.amount <= selectedChip) {
                return prev.filter((_, i) => i !== index);
            }
            const updated = [...prev];
            updated[index] = { ...bet, amount: bet.amount - selectedChip };
            return updated;
        }
    });
  };

  // --- Simulation Logic ---

  const waitForSignal = async (signal: AbortSignal) => {
    if (signal.aborted) throw new Error('Aborted');

    // Handle Pause loop
    while (simStatusRef.current === 'PAUSED') {
        if (signal.aborted) throw new Error('Aborted');
        await new Promise<void>(resolve => {
            pauseResolverRef.current = resolve;
        });
        pauseResolverRef.current = null;
    }

    if (signal.aborted) throw new Error('Aborted');

    // Handle Speed
    const currentSpeed = speedRef.current;
    if (currentSpeed === 'SLOW') {
        await new Promise<void>(resolve => {
            nextSpinResolverRef.current = resolve;
        });
        nextSpinResolverRef.current = null;
    } else if (currentSpeed === 'MEDIUM') {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    // FAST: no delay
    
    if (signal.aborted) throw new Error('Aborted');
  };

  const generateStats = (
      numSims: number, 
      wins: number, 
      losses: number, 
      finalBankrolls: number[], 
      totalSpins: number, 
      lastHistory: SimulationStep[],
      runId: number
    ) => {
      if (!isMountedRef.current) return;

      const avgFinalBankroll = finalBankrolls.reduce((a, b) => a + b, 0) / numSims;
      const bestRun = Math.max(...finalBankrolls);
      const worstRun = Math.min(...finalBankrolls);
      const avgSpins = totalSpins / numSims;

      const stats: BatchStats = {
          totalSimulations: numSims,
          wins,
          losses,
          avgFinalBankroll,
          bestRun,
          worstRun,
          avgSpinsToFinish: avgSpins
      };

      setBatchStats(stats);
      setSimStatus('IDLE');

      // Trigger AI Analysis
      // Use detailed analysis for single sim, batch analysis for multiple
      const analysisPromise = (numSims === 1 && lastHistory.length > 0)
        ? analyzeSimulationResults(settings.startingBankroll, finalBankrolls[0], lastHistory.length, lastHistory)
        : analyzeBatchResults(stats);

      analysisPromise.then(analysis => {
         // Only update if mounted and this analysis corresponds to the latest run
         if(isMountedRef.current && analysisIdRef.current === runId) {
             setAiAnalysis(analysis);
         }
      });
  };

  const runInteractiveSimulation = async (signal: AbortSignal) => {
    const numSims = settings.numberOfSimulations;
    const spinsPerSim = settings.spinsPerSimulation;
    
    // Calculate total base bet amount
    const baseBetAmount = currentBets.reduce((sum, b) => sum + b.amount, 0);
    if (baseBetAmount === 0) {
        alert("Please place bets first!");
        setSimStatus('IDLE');
        return;
    }

    // Mark current run ID for AI Analysis validity
    const runId = Date.now();
    analysisIdRef.current = runId;

    let allFinalBankrolls: number[] = [];
    let wins = 0;
    let losses = 0;
    let totalSpinsToFinish = 0;
    
    // We maintain a separate array for the *final* run's history to update the graph at the end
    let lastSimHistory: SimulationStep[] = [];
    let lastFinalBankroll = settings.startingBankroll;

    // UI Throttling: Track last update time to prevent render flooding
    let lastUiUpdateTime = 0;
    const UI_UPDATE_INTERVAL_MS = 50; // Max 20fps updates during fast runs

    try {
        for (let s = 0; s < numSims; s++) {
            if (signal.aborted) break;

            // Reset visual state for new simulation
            if (isMountedRef.current) {
                setHistory([]);
                setBankroll(settings.startingBankroll);
            }

            let currentBankroll = settings.startingBankroll; 
            let currentMultiplier = 1;
            let sessionBaselineBankroll = currentBankroll; // For reset on profit logic
            
            let simHistory: SimulationStep[] = [];
            // Buffer for throttling UI updates
            let historyBuffer: SimulationStep[] = [];
            let simSpins = 0;

            for (let i = 0; i < spinsPerSim; i++) {
                // WAIT logic (pause/speed control)
                await waitForSignal(signal);

                simSpins++;
                
                // Check limits (Stop Loss)
                if (currentBankroll <= settings.startingBankroll - strategyConfig.stopLoss) break;
                
                // Check Profit Goal if enabled
                if (strategyConfig.useTotalProfitGoal && currentBankroll >= settings.startingBankroll + strategyConfig.totalProfitGoal) break;
                
                // Bust
                if (currentBankroll <= 0) break;
                
                // Reset on Session Profit
                if (strategyConfig.useResetOnSessionProfit && strategyConfig.resetOnSessionProfit > 0) {
                    const currentSessionProfit = currentBankroll - sessionBaselineBankroll;
                    if (currentSessionProfit >= strategyConfig.resetOnSessionProfit) {
                        currentMultiplier = 1;
                        sessionBaselineBankroll = currentBankroll; 
                    }
                }

                // --- Calculate Effective Multiplier & Spin Bets ---
                let effectiveMultiplier = currentMultiplier;

                // Use pre-calculated baseBetAmount
                const totalBaseWager = baseBetAmount;

                // Safety: Avoid division by zero
                if (totalBaseWager === 0) break; 

                let projectedWager = totalBaseWager * effectiveMultiplier;

                // Cap by table max
                if (projectedWager > settings.tableMax) {
                    effectiveMultiplier = settings.tableMax / totalBaseWager;
                    projectedWager = totalBaseWager * effectiveMultiplier;
                }

                // Cap by bankroll (all-in)
                if (projectedWager > currentBankroll) {
                    effectiveMultiplier = currentBankroll / totalBaseWager;
                    projectedWager = totalBaseWager * effectiveMultiplier;
                }

                // Enforce table minimum if affordable
                if (projectedWager < settings.tableMin && currentBankroll >= settings.tableMin) {
                    effectiveMultiplier = settings.tableMin / totalBaseWager;
                    projectedWager = totalBaseWager * effectiveMultiplier;
                }

                // Final safety: if projected wager < 1, skip spin (can't bet less than 1 unit)
                if (projectedWager < 1) break;

                // Create actual bets for this spin
                const spinBets = currentBets.map(b => ({
                    ...b,
                    amount: Math.max(1, Math.floor(b.amount * effectiveMultiplier)) // ensure at least 1 chip
                }));

                // Recompute total wager (for consistency)
                const totalWager = spinBets.reduce((sum, b) => sum + b.amount, 0);

                // If total wager somehow 0, break
                if (totalWager <= 0) break;
                // Safety: If forcing 1 chip per bet caused total to exceed bankroll, bust/break
                if (totalWager > currentBankroll) break;

                const result = spinWheel();
                const winnings = calculateWinnings(spinBets, result);
                const profit = winnings - totalWager;
                
                currentBankroll += profit;

                const newStep: SimulationStep = {
                  spinIndex: i + 1,
                  result,
                  betAmount: totalWager,
                  outcome: profit,
                  bankroll: currentBankroll
                };

                simHistory.push(newStep);
                historyBuffer.push(newStep);
                
                // --- OPTIMIZED UI UPDATES ---
                // Only update React state if:
                // 1. It's not FAST mode (update every spin)
                // 2. OR enough time has passed (throttling for FAST mode)
                // 3. OR it's the very last spin of the simulation
                const now = Date.now();
                const isFast = speedRef.current === 'FAST';
                const shouldUpdate = !isFast || (now - lastUiUpdateTime > UI_UPDATE_INTERVAL_MS) || (i === spinsPerSim - 1);

                if (shouldUpdate && isMountedRef.current) {
                    // Flush buffer to state
                    const bufferedSteps = [...historyBuffer];
                    setHistory(prev => [...prev, ...bufferedSteps]); 
                    setBankroll(currentBankroll);
                    
                    historyBuffer = []; // Clear buffer
                    lastUiUpdateTime = now;
                }

                // Strategy Logic for Next Spin
                if (profit > 0) {
                  // Win
                  switch (strategyConfig.onWinAction) {
                    case ProgressionAction.RESET: currentMultiplier = 1; break;
                    case ProgressionAction.MULTIPLY: currentMultiplier *= strategyConfig.onWinValue; break;
                    case ProgressionAction.ADD_UNITS: currentMultiplier += strategyConfig.onWinValue; break;
                    case ProgressionAction.SUBTRACT_UNITS: currentMultiplier = Math.max(1, currentMultiplier - strategyConfig.onWinValue); break;
                    case ProgressionAction.DO_NOTHING: break;
                  }
                } else {
                  // Loss
                  switch (strategyConfig.onLossAction) {
                    case ProgressionAction.RESET: currentMultiplier = 1; break;
                    case ProgressionAction.MULTIPLY: currentMultiplier *= strategyConfig.onLossValue; break;
                    case ProgressionAction.ADD_UNITS: currentMultiplier += strategyConfig.onLossValue; break;
                    case ProgressionAction.SUBTRACT_UNITS: currentMultiplier = Math.max(1, currentMultiplier - strategyConfig.onLossValue); break;
                    case ProgressionAction.DO_NOTHING: break;
                  }
                }
            } // End Spin Loop

            allFinalBankrolls.push(currentBankroll);
            totalSpinsToFinish += simSpins;
            
            if (currentBankroll > settings.startingBankroll) wins++;
            else if (currentBankroll < settings.startingBankroll) losses++;
            // Break-even is neither win nor loss in this stat tracking

            lastSimHistory = simHistory;
            lastFinalBankroll = currentBankroll;

            // Small delay between simulations if running batch interactively
            // If FAST, no artificial delay between batch items
            if (s < numSims - 1 && speedRef.current !== 'FAST') {
                await new Promise(r => setTimeout(r, 500));
            }
        } // End Sim Loop

        // Final Synchronization: Ensure the UI matches the absolute end state
        if (isMountedRef.current) {
            setBankroll(lastFinalBankroll);
            // In case any buffered steps were left (though should be flushed by last spin check, safe to ensure)
            // Ideally setHistory should be exactly lastSimHistory at end of single run.
            // For batch, we probably want to see the last one.
            setHistory(lastSimHistory);
        }

        generateStats(numSims, wins, losses, allFinalBankrolls, totalSpinsToFinish, lastSimHistory, runId); 

    } catch (e: any) {
        if (e.message !== 'Aborted') {
            console.error(e);
        }
    }
  };

  const handleStartSimulation = () => {
    if (currentBets.length === 0) {
        alert("Place bets first!");
        return;
    }
    setSimStatus('RUNNING');
    setBatchStats(null);
    setAiAnalysis('');
    
    // Abort previous
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    const ac = new AbortController();
    abortControllerRef.current = ac;

    runInteractiveSimulation(ac.signal);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
    }
    // Wake up any waiting promises so they can process the abort
    if (pauseResolverRef.current) {
        pauseResolverRef.current();
        pauseResolverRef.current = null;
    }
    if (nextSpinResolverRef.current) {
        nextSpinResolverRef.current();
        nextSpinResolverRef.current = null;
    }
    setSimStatus('IDLE');
  };

  const handlePause = () => {
    setSimStatus('PAUSED');
  };

  const handleResume = () => {
    setSimStatus('RUNNING');
    if (pauseResolverRef.current) {
        pauseResolverRef.current();
        pauseResolverRef.current = null;
    }
  };

  const handleNextSpin = () => {
    if (nextSpinResolverRef.current) {
        nextSpinResolverRef.current();
        nextSpinResolverRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30">
      <div className="max-w-[1600px] mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Panel: Strategy & Controls */}
        <div className="lg:col-span-4 space-y-6">
            <header className="mb-6">
                <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300">
                    Roulette AI
                </h1>
                <p className="text-slate-500 text-sm">Strategy Simulation & Analysis</p>
            </header>

            <StrategyPanel 
                config={strategyConfig}
                setConfig={setStrategyConfig}
                settings={settings}
                setSettings={setSettings}
                onSimulate={handleStartSimulation}
                speed={speed}
                setSpeed={setSpeed}
                simStatus={simStatus}
                onPause={handlePause}
                onResume={handleResume}
                onStop={handleStop}
                onNextSpin={handleNextSpin}
            />

            {batchStats && (
                <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3 animate-in fade-in slide-in-from-bottom-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Results</h3>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Win Rate:</span>
                            <span className={batchStats.wins > batchStats.losses ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                                {((batchStats.wins / batchStats.totalSimulations) * 100).toFixed(1)}%
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Avg Result:</span>
                            <span className={batchStats.avgFinalBankroll >= settings.startingBankroll ? "text-green-400" : "text-red-400"}>
                                ${batchStats.avgFinalBankroll.toFixed(0)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Best Run:</span>
                            <span className="text-emerald-400">${batchStats.bestRun.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Worst Run:</span>
                            <span className="text-rose-400">${batchStats.worstRun.toFixed(0)}</span>
                        </div>
                    </div>
                    {aiAnalysis && (
                        <div className="mt-4 pt-4 border-t border-slate-800 text-xs leading-relaxed text-indigo-200/80 italic">
                             {aiAnalysis}
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Center/Right: Table & Viz */}
        <div className="lg:col-span-8 space-y-6">
            
            {/* Bankroll & Status Bar */}
            <div className="flex items-center justify-between bg-slate-900/80 backdrop-blur rounded-xl p-4 border border-slate-800 shadow-xl">
                 <div className="flex items-center gap-6">
                    <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Bankroll</div>
                        <div className="text-2xl font-mono text-white flex items-baseline gap-1">
                            ${bankroll.toFixed(0)}
                            {bankroll > settings.startingBankroll && <span className="text-xs text-green-400 font-bold">(+${(bankroll - settings.startingBankroll).toFixed(0)})</span>}
                            {bankroll < settings.startingBankroll && <span className="text-xs text-red-400 font-bold">(-${(settings.startingBankroll - bankroll).toFixed(0)})</span>}
                        </div>
                    </div>
                    <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Current Bet</div>
                        <div className="text-xl font-mono text-yellow-400">${currentBets.reduce((a,b)=>a+b.amount,0)}</div>
                    </div>
                 </div>

                 <div className="flex items-center gap-3">
                    <button 
                        onClick={handleClearBets}
                        disabled={simStatus !== 'IDLE' || currentBets.length === 0}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                        <Trash2 size={16} /> Clear
                    </button>
                    <button 
                        onClick={() => {
                            setBankroll(settings.startingBankroll);
                            setHistory([]);
                        }}
                        disabled={simStatus !== 'IDLE'}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-30"
                    >
                        <RotateCcw size={16} /> Reset
                    </button>
                 </div>
            </div>

            {/* Roulette Board */}
            <div className="relative overflow-x-auto pb-4 custom-scrollbar flex justify-center bg-slate-900/50 p-6 rounded-2xl border border-slate-800 shadow-inner">
                <RouletteTable 
                    bets={currentBets}
                    onBetSelect={handleBetSelect}
                    onStackDelete={handleRemoveBet}
                    triggerMode={false}
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="text-sm font-bold text-slate-400 uppercase">Chip Selection</h3>
                    <ChipSelector 
                        selectedChip={selectedChip} 
                        onSelectChip={setSelectedChip} 
                    />
                </div>
                <div className="space-y-4 h-64">
                    <h3 className="text-sm font-bold text-slate-400 uppercase">Live Graph</h3>
                    <StatsChart 
                        data={history} 
                        initialBalance={settings.startingBankroll}
                        className="h-full"
                    />
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default App;