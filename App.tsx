import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Bet, BetPlacement, ProgressionConfig, ProgressionAction, 
  SimulationSettings, SimulationStep, SimulationSpeed, SimulationStatus, 
  BatchStats
} from './types';
import { spinWheel, calculateWinnings, parseSequence } from './services/rouletteLogic';
import { analyzeSimulationResults, analyzeBatchResults } from './services/geminiService';
import { getPlacementIdentifier } from './utils/placements';
import RouletteTable from './components/RouletteBoard';
import StrategyPanel from './components/StrategyPanel';
import ChipSelector from './components/ChipSelector';
import StatsChart from './components/StatsChart';
import SpinLog from './components/SpinLog';
import { RotateCcw, Trash2 } from 'lucide-react';

const FIB_SEQUENCE = [1, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584, 4181, 6765, 10946, 17711];

const App: React.FC = () => {
  // --- State ---
  const [bankroll, setBankroll] = useState(1000);
  const [currentBets, setCurrentBets] = useState<Bet[]>([]);
  const [history, setHistory] = useState<SimulationStep[]>([]);
  const [selectedChip, setSelectedChip] = useState(5);
  
  // Strategy Config
  const [strategyConfig, setStrategyConfig] = useState<ProgressionConfig>({
    strategyMode: 'STATIC',
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
    sequence: "red, black",
    onWinUnits: -1,
    onLossUnits: 1,
    minUnits: 1,
    rotateOnWin: true,
    rotateOnLoss: true
  });

  // Simulation Settings
  const [settings, setSettings] = useState<SimulationSettings>({
    startingBankroll: 1000,
    tableMin: 1,
    tableMax: 1000,
    spinsPerSimulation: 100,
    numberOfSimulations: 1,
  });

  const [speed, setSpeed] = useState<SimulationSpeed>('FAST');
  const [simStatus, setSimStatus] = useState<SimulationStatus>('IDLE');
  const [batchStats, setBatchStats] = useState<BatchStats | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  
  // UI State
  const [isGraphFullScreen, setIsGraphFullScreen] = useState(false);

  // Refs for accessing latest state inside async loops
  const simStatusRef = useRef<SimulationStatus>('IDLE');
  const speedRef = useRef<SimulationSpeed>('FAST');
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
    
    // --- MODE CHECK: STATIC ---
    if (strategyConfig.strategyMode === 'STATIC') {
        if (currentBets.length === 0) {
            alert("Please place bets first for Static Mode!");
            setSimStatus('IDLE');
            return;
        }
    } 
    
    // --- MODE CHECK: ROTATING ---
    let parsedRotation: BetPlacement[] = [];
    if (strategyConfig.strategyMode === 'ROTATING') {
        try {
            parsedRotation = parseSequence(strategyConfig.sequence);
            if (parsedRotation.length === 0) {
                alert("Please enter a valid bet sequence for Rotating Mode (e.g., 'red, black')");
                setSimStatus('IDLE');
                return;
            }
        } catch (e: any) {
            alert(e.message);
            setSimStatus('IDLE');
            return;
        }
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
            
            // STATIC State
            let currentMultiplier = 1;
            let progressionIndex = 0; // Track Fibonacci step
            
            // ROTATING State
            let rotatingIndex = 0;
            let rotatingUnits = 1;

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
                        // Reset both modes
                        currentMultiplier = 1;
                        progressionIndex = 0;
                        rotatingUnits = 1; // Or minUnits? Assuming 1 for baseline reset.
                        rotatingIndex = 0;
                        sessionBaselineBankroll = currentBankroll; 
                    }
                }

                let spinBets: Bet[] = [];
                let totalWager = 0;

                // --- BUILD BETS BASED ON MODE ---
                if (strategyConfig.strategyMode === 'STATIC') {
                    // STATIC LOGIC
                    let effectiveMultiplier = currentMultiplier;
                    const totalBaseWager = currentBets.reduce((sum, b) => sum + b.amount, 0);

                    if (totalBaseWager === 0) break; 

                    let projectedWager = totalBaseWager * effectiveMultiplier;

                    // Cap by table max
                    if (projectedWager > settings.tableMax) {
                        effectiveMultiplier = settings.tableMax / totalBaseWager;
                        projectedWager = totalBaseWager * effectiveMultiplier;
                    }
                    // Cap by bankroll
                    if (projectedWager > currentBankroll) {
                        effectiveMultiplier = currentBankroll / totalBaseWager;
                        projectedWager = totalBaseWager * effectiveMultiplier;
                    }
                    // Table Min
                    if (projectedWager < settings.tableMin && currentBankroll >= settings.tableMin) {
                        effectiveMultiplier = settings.tableMin / totalBaseWager;
                        projectedWager = totalBaseWager * effectiveMultiplier;
                    }
                    // Min valid bet
                    if (projectedWager < 1) break;

                    spinBets = currentBets.map(b => ({
                        ...b,
                        amount: Math.max(1, Math.floor(b.amount * effectiveMultiplier)) 
                    }));

                    totalWager = spinBets.reduce((sum, b) => sum + b.amount, 0);

                } else {
                    // ROTATING LOGIC
                    const currentPlacement = parsedRotation[rotatingIndex];
                    
                    let wagerAmount = Math.floor(rotatingUnits * strategyConfig.baseUnit);
                    
                    // Table Limits
                    wagerAmount = Math.max(settings.tableMin, Math.min(settings.tableMax, wagerAmount));
                    
                    // Bankroll Limit
                    wagerAmount = Math.min(currentBankroll, wagerAmount);

                    if (wagerAmount < 1) break; // Cannot bet

                    spinBets = [{
                        id: `rot-${i}`,
                        placement: currentPlacement,
                        amount: wagerAmount
                    }];
                    
                    totalWager = wagerAmount;
                }

                // --- EXECUTE SPIN ---
                if (totalWager <= 0 || totalWager > currentBankroll) break;

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
                
                // --- UPDATE UI (THROTTLED) ---
                const now = Date.now();
                const isFast = speedRef.current === 'FAST';
                const shouldUpdate = !isFast || (now - lastUiUpdateTime > UI_UPDATE_INTERVAL_MS) || (i === spinsPerSim - 1);

                if (shouldUpdate && isMountedRef.current) {
                    const bufferedSteps = [...historyBuffer];
                    setHistory(prev => [...prev, ...bufferedSteps]); 
                    setBankroll(currentBankroll);
                    historyBuffer = []; 
                    lastUiUpdateTime = now;
                }

                // --- PROGRESSION LOGIC BASED ON MODE ---
                if (profit > 0) {
                  // WIN
                  if (strategyConfig.strategyMode === 'STATIC') {
                      switch (strategyConfig.onWinAction) {
                        case ProgressionAction.RESET: 
                            currentMultiplier = 1; 
                            progressionIndex = 0;
                            break;
                        case ProgressionAction.MULTIPLY: 
                            currentMultiplier *= strategyConfig.onWinValue; 
                            break;
                        case ProgressionAction.ADD_UNITS: 
                            currentMultiplier += strategyConfig.onWinValue; 
                            break;
                        case ProgressionAction.SUBTRACT_UNITS: 
                            currentMultiplier = Math.max(1, currentMultiplier - strategyConfig.onWinValue); 
                            break;
                        case ProgressionAction.FIBONACCI: {
                            const steps = strategyConfig.onWinValue || 2; 
                            progressionIndex = Math.max(0, progressionIndex - steps);
                            currentMultiplier = FIB_SEQUENCE[progressionIndex];
                            break;
                        }
                        case ProgressionAction.DO_NOTHING: 
                            break;
                      }
                      currentMultiplier = Math.max(1, Math.floor(currentMultiplier));
                  } else {
                      // ROTATING WIN
                      rotatingUnits += strategyConfig.onWinUnits;
                      // Clamp
                      rotatingUnits = Math.max(strategyConfig.minUnits, rotatingUnits);
                      
                      // Rotate sequence if enabled
                      if (strategyConfig.rotateOnWin) {
                        rotatingIndex = (rotatingIndex + 1) % parsedRotation.length;
                      }
                  }
                } else {
                  // LOSS
                  if (strategyConfig.strategyMode === 'STATIC') {
                      switch (strategyConfig.onLossAction) {
                        case ProgressionAction.RESET: 
                            currentMultiplier = 1; 
                            progressionIndex = 0;
                            break;
                        case ProgressionAction.MULTIPLY: 
                            currentMultiplier *= strategyConfig.onLossValue; 
                            break;
                        case ProgressionAction.ADD_UNITS: 
                            currentMultiplier += strategyConfig.onLossValue; 
                            break;
                        case ProgressionAction.SUBTRACT_UNITS: 
                            currentMultiplier = Math.max(1, currentMultiplier - strategyConfig.onLossValue); 
                            break;
                        case ProgressionAction.FIBONACCI: {
                            const steps = strategyConfig.onLossValue || 1; 
                            progressionIndex = Math.min(FIB_SEQUENCE.length - 1, progressionIndex + steps);
                            currentMultiplier = FIB_SEQUENCE[progressionIndex];
                            break;
                        }
                        case ProgressionAction.DO_NOTHING: 
                            break;
                      }
                      currentMultiplier = Math.max(1, Math.floor(currentMultiplier));
                  } else {
                      // ROTATING LOSS
                      rotatingUnits += strategyConfig.onLossUnits;
                      // Clamp
                      rotatingUnits = Math.max(strategyConfig.minUnits, rotatingUnits);
                      
                      // Rotate sequence if enabled
                      if (strategyConfig.rotateOnLoss) {
                        rotatingIndex = (rotatingIndex + 1) % parsedRotation.length;
                      }
                  }
                }
            } // End Spin Loop

            allFinalBankrolls.push(currentBankroll);
            totalSpinsToFinish += simSpins;
            
            if (currentBankroll > settings.startingBankroll) wins++;
            else if (currentBankroll < settings.startingBankroll) losses++;

            lastSimHistory = simHistory;
            lastFinalBankroll = currentBankroll;

            if (s < numSims - 1 && speedRef.current !== 'FAST') {
                await new Promise(r => setTimeout(r, 500));
            }
        } // End Sim Loop

        if (isMountedRef.current) {
            setBankroll(lastFinalBankroll);
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
    // Basic pre-checks
    if (strategyConfig.strategyMode === 'STATIC' && currentBets.length === 0) {
        alert("Place bets first!");
        return;
    }
    
    setSimStatus('RUNNING');
    setBatchStats(null);
    setAiAnalysis('');
    
    // Auto maximize the graph view on start
    setIsGraphFullScreen(true);
    
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
            
            {/* Chip Selector */}
            <div className="flex justify-center">
                 <ChipSelector 
                    selectedChip={selectedChip} 
                    onSelectChip={setSelectedChip} 
                />
            </div>

            {/* Data Visualization Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[26rem]">
                <div className="md:col-span-5 h-full">
                    <SpinLog history={history} className="h-full" />
                </div>
                <div className="md:col-span-7 h-full">
                    <StatsChart 
                        data={history} 
                        initialBalance={settings.startingBankroll}
                        className="h-full"
                        onRunSimulation={handleStartSimulation}
                        simStatus={simStatus}
                        onPause={handlePause}
                        onResume={handleResume}
                        onStop={handleStop}
                        speed={speed}
                        onSpeedChange={setSpeed}
                        isFullScreen={isGraphFullScreen}
                        onToggleFullScreen={() => setIsGraphFullScreen(!isGraphFullScreen)}
                        settings={settings}
                        onUpdateSettings={setSettings}
                        strategyConfig={strategyConfig}
                    />
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default App;