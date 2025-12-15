
import React, { useState, useRef, useEffect } from 'react';
import { 
  Bet, BetPlacement, ProgressionConfig, ProgressionAction, 
  SimulationSettings, SimulationStep, SimulationSpeed, SimulationStatus, 
  BatchStats, TriggerBet, SavedLayout, Lane, SavedStrategy, RuntimeLane, EvaluatedBet, SpinResult
} from './core/types';
import { spinWheel, parseSequence, getSpinResult } from './core/game';
import { prepareLaneForSpin, updateLaneAfterSpin, resolveSpin } from './core/simulation';
import { analyzeSimulationResults, analyzeBatchResults } from './services/geminiService';
import { getPlacementIdentifier } from './utils/placements';
import RouletteTable from './components/RouletteBoard';
import { StrategyPanel } from './components/StrategyPanel';
import ChipSelector from './components/ChipSelector';
import StatsChart from './components/StatsChart';
import SpinLog from './components/SpinLog';
import { RotateCcw, Trash2, Undo2, Save, Download, Plus, X, Settings, ArrowDownToLine, Eraser, Edit3, Link2, FlaskConical } from 'lucide-react';

// Default Config Helper
const createDefaultConfig = (): ProgressionConfig => ({
    strategyMode: 'STATIC',
    baseUnit: 5,
    onWinAction: ProgressionAction.RESET,
    onWinValue: 0,
    onLossAction: ProgressionAction.MULTIPLY,
    onLossValue: 2,
    resetOnSessionProfit: 150,
    useResetOnSessionProfit: false,
    sequence: "red, black",
    onWinUnits: -1,
    onLossUnits: 1,
    minUnits: 1,
    rotateOnWin: true,
    rotateOnLoss: true,
    // Chain Defaults
    chainSteps: [],
    chainOnWin: ProgressionAction.RESTART_CHAIN,
    chainOnLoss: ProgressionAction.NEXT_CHAIN_STEP,
    chainLoop: true
});

// Vibrant colors for lanes
const LANE_COLORS = [
    '#6366f1', // Indigo
    '#ec4899', // Pink
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#0ea5e9', // Sky
    '#8b5cf6', // Violet
    '#f43f5e', // Rose
    '#84cc16', // Lime
];

const BinaryBackground = () => (
    <div className="absolute top-0 right-0 w-2/3 h-full overflow-hidden pointer-events-none z-0 opacity-40 select-none"
         style={{ 
             // Fade out on the left side before hitting the title
             maskImage: 'linear-gradient(to right, transparent 0%, transparent 10%, black 60%)', 
             WebkitMaskImage: 'linear-gradient(to right, transparent 0%, transparent 10%, black 60%)' 
         }}>
        <style>{`
            @keyframes scrollLeft {
                from { transform: translateX(0); }
                to { transform: translateX(-50%); }
            }
            .binary-row {
                white-space: nowrap;
                font-family: 'Courier New', monospace;
                position: absolute;
                right: 0;
                animation: scrollLeft linear infinite;
                line-height: 1;
            }
        `}</style>
        {/* 4 Lines of binary data running right to left */}
        <div className="binary-row text-[10px] text-indigo-500/60 top-1" style={{ animationDuration: '60s' }}>
            {Array(50).fill('01001011 01010010 10101110 10101010 10010110 ').join('')}
        </div>
        <div className="binary-row text-[10px] text-emerald-500/50 top-3.5" style={{ animationDuration: '75s' }}>
            {Array(50).fill('10110010 10111010 01010101 00101101 01011010 ').join('')}
        </div>
        <div className="binary-row text-[10px] text-cyan-500/50 top-6" style={{ animationDuration: '65s' }}>
            {Array(50).fill('00101010 11010101 00101011 01010101 00101010 ').join('')}
        </div>
        <div className="binary-row text-[10px] text-violet-500/50 top-8.5" style={{ animationDuration: '80s' }}>
            {Array(50).fill('11100010 10110101 11010101 00101011 01010101 ').join('')}
        </div>
    </div>
);

const App: React.FC = () => {
  // --- Global Settings ---
  const [settings, setSettings] = useState<SimulationSettings>({
    startingBankroll: 1000,
    tableMin: 1,
    tableMax: 1000,
    spinsPerSimulation: 100,
    numberOfSimulations: 1,
    stopLoss: 0, // Unused
    totalProfitGoal: 500,
    useTotalProfitGoal: false,
    fixedOutcomeSequence: ''
  });

  const [bankroll, setBankroll] = useState(1000);
  
  // --- Lane State ---
  const [lanes, setLanes] = useState<Lane[]>([
      {
          id: 'lane-1',
          name: 'Lane 1',
          color: LANE_COLORS[0],
          bets: [],
          triggerBets: [],
          config: createDefaultConfig(),
          enabled: true
      }
  ]);
  const [activeLaneId, setActiveLaneId] = useState<string>('lane-1');

  // --- Strategy Management State ---
  const [currentStrategyName, setCurrentStrategyName] = useState("My Strategy");
  const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>(() => {
    try {
      const saved = localStorage.getItem('roulette_strategies');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem('roulette_strategies', JSON.stringify(savedStrategies));
  }, [savedStrategies]);

  // --- Undo/History ---
  const [undoStack, setUndoStack] = useState<Lane[][]>([]);

  // --- Layouts (Just Bets) ---
  const [savedLayouts, setSavedLayouts] = useState<SavedLayout[]>(() => {
    try {
      const saved = localStorage.getItem('roulette_layouts');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => { localStorage.setItem('roulette_layouts', JSON.stringify(savedLayouts)); }, [savedLayouts]);
  
  // --- Sim State ---
  const [history, setHistory] = useState<SimulationStep[]>([]);
  const [selectedChip, setSelectedChip] = useState(5);
  const [speed, setSpeed] = useState<SimulationSpeed>('FAST');
  const [simStatus, setSimStatus] = useState<SimulationStatus>('IDLE');
  const [batchStats, setBatchStats] = useState<BatchStats | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isGraphFullScreen, setIsGraphFullScreen] = useState(false);
  const [isTestPanelOpen, setIsTestPanelOpen] = useState(false);

  // Refs
  const simStatusRef = useRef<SimulationStatus>('IDLE');
  const speedRef = useRef<SimulationSpeed>('FAST');
  const pauseResolverRef = useRef<((value: void | PromiseLike<void>) => void) | null>(null);
  const nextSpinResolverRef = useRef<((value: void | PromiseLike<void>) => void) | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const analysisIdRef = useRef<number>(0);

  useEffect(() => { simStatusRef.current = simStatus; }, [simStatus]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { return () => { isMountedRef.current = false; }; }, []);

  // --- Derived State Helpers ---
  const getActiveLane = () => lanes.find(l => l.id === activeLaneId) || lanes[0];
  
  const updateActiveLane = (updater: (lane: Lane) => Lane) => {
      setLanes(prev => {
          if(simStatus === 'IDLE') setUndoStack(s => [...s, prev]);
          return prev.map(l => l.id === activeLaneId ? updater(l) : l);
      });
  };

  // --- Helper to get the correct bets for display (fixing the visual bug) ---
  const getActiveChainIndex = (laneId: string) => {
      // If idle, show step 0 (editing)
      if (simStatus === 'IDLE' || history.length === 0) return 0;
      
      // If running/paused, show the 'next' step logic, which is stored in the last history update
      const lastStep = history[history.length - 1];
      const detail = lastStep.laneDetails?.find(d => d.laneId === laneId);
      return detail?.chainIndex ?? 0;
  };
  
  const activeChainIndex = getActiveChainIndex(activeLaneId);

  // --- Strategy Persistence Functions ---
  const handleSaveStrategy = () => {
      // IMPORTANT: Include savedLayouts (Favorites) in the strategy file
      const strategyConfig: SavedStrategy = {
          id: Date.now().toString(),
          name: currentStrategyName,
          lanes: lanes,
          settings: settings,
          savedLayouts: savedLayouts
      };

      const fullExport = {
          ...strategyConfig,
          history: history,
          exportedAt: new Date().toISOString(),
          app: "ProRoulette Sim"
      };

      let proceed = true;
      const existingIndex = savedStrategies.findIndex(s => s.name === currentStrategyName);
      
      if (existingIndex >= 0) {
          if (window.confirm(`Overwrite "${currentStrategyName}" in your saved list and download the full record to your computer?`)) {
              setSavedStrategies(prev => {
                  const copy = [...prev];
                  copy[existingIndex] = strategyConfig;
                  return copy;
              });
          } else {
              proceed = false;
          }
      } else {
          setSavedStrategies(prev => [...prev, strategyConfig]);
      }

      if (proceed) {
          try {
              const blob = new Blob([JSON.stringify(fullExport, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              const safeName = currentStrategyName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
              link.download = `${safeName}_${Date.now()}.json`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
          } catch (e) {
              console.error("Download failed:", e);
              alert("Strategy saved to app, but file download failed.");
          }
      }
  };

  const handleLoadStrategy = (strategy: SavedStrategy) => {
      if (simStatus !== 'IDLE') return;
      if (!window.confirm("Load strategy? Unsaved changes will be lost.")) return;
      
      const sanitizedLanes = strategy.lanes.map(l => ({
          ...l,
          config: {
              ...createDefaultConfig(),
              ...l.config,
              chainSteps: l.config.chainSteps || []
          }
      }));
      setLanes(sanitizedLanes);

      if (sanitizedLanes.length > 0) setActiveLaneId(sanitizedLanes[0].id);
      if (strategy.settings) setSettings(prev => ({...prev, ...strategy.settings}));
      
      // Load favorites from strategy, or clear if none (enforcing strict strategy ownership)
      setSavedLayouts(strategy.savedLayouts || []);
      
      setCurrentStrategyName(strategy.name);
      setHistory([]);
      setBankroll(strategy.settings.startingBankroll || 1000);
  };

  const handleImportStrategy = (imported: SavedStrategy) => {
      const exists = savedStrategies.find(s => s.id === imported.id || s.name === imported.name);
      if (!exists) {
          setSavedStrategies(prev => [...prev, imported]);
      }
      handleLoadStrategy(imported);
  };

  const handleDeleteStrategy = (id: string) => {
      if(window.confirm("Delete this strategy?")) {
          setSavedStrategies(prev => prev.filter(s => s.id !== id));
      }
  };

  const handleNewStrategy = () => {
      if (simStatus !== 'IDLE') return;
      if (!window.confirm("Create new strategy? Unsaved changes will be lost.")) return;
      
      setLanes([{
          id: `lane-${Date.now()}`,
          name: 'Lane 1',
          color: LANE_COLORS[0],
          bets: [],
          triggerBets: [],
          config: createDefaultConfig(),
          enabled: true
      }]);
      setActiveLaneId(`lane-${Date.now()}`); 
      setCurrentStrategyName("New Strategy");
      setHistory([]);
      setBankroll(settings.startingBankroll);

      // Start fresh with no favorites for a new strategy
      setSavedLayouts([]);
  };

  // --- Lane Management ---
  const handleAddLane = () => {
      const active = getActiveLane();
      const nextIndex = lanes.length;
      const color = LANE_COLORS[nextIndex % LANE_COLORS.length];
      
      const newLane: Lane = {
          ...active,
          id: `lane-${Date.now()}`,
          name: `Lane ${nextIndex + 1}`,
          bets: [],
          triggerBets: [],
          config: { ...active.config },
          color: color,
          enabled: true
      };
      setLanes(prev => [...prev, newLane]);
      setActiveLaneId(newLane.id);
  };

  const handleRenameLane = (id: string, newName: string) => {
      setLanes(prev => prev.map(l => l.id === id ? { ...l, name: newName } : l));
  };

  const handleDeleteLane = (id: string) => {
      if (lanes.length <= 1) return;
      if (!window.confirm("Delete this lane?")) return;
      
      const newLanes = lanes.filter(l => l.id !== id);
      setLanes(newLanes);
      if (activeLaneId === id) setActiveLaneId(newLanes[0].id);
  };

  const handleUpdateLaneConfig = (newConfig: ProgressionConfig) => {
      updateActiveLane(l => ({ ...l, config: newConfig }));
  };

  const handleUpdateTriggerBets = (newTriggers: TriggerBet[]) => {
      if (typeof newTriggers === 'function') {
          updateActiveLane(l => ({ ...l, triggerBets: (newTriggers as Function)(l.triggerBets) }));
      } else {
          updateActiveLane(l => ({ ...l, triggerBets: newTriggers }));
      }
  };

  // --- Undo/Bets Logic ---
  const handleUndo = () => {
    if (simStatus !== 'IDLE' || undoStack.length === 0) return;
    const previousLanes = undoStack[undoStack.length - 1];
    setUndoStack(prev => prev.slice(0, -1));
    setLanes(previousLanes);
    if (!previousLanes.find(l => l.id === activeLaneId)) {
        setActiveLaneId(previousLanes[0].id);
    }
  };

  const handleBetSelect = (placement: BetPlacement) => {
    if (simStatus !== 'IDLE') return;
    updateActiveLane(lane => {
        const existingBetIndex = lane.bets.findIndex(b => getPlacementIdentifier(b.placement) === getPlacementIdentifier(placement));
        let newBets = [...lane.bets];
        if (existingBetIndex >= 0) {
            newBets[existingBetIndex] = { ...newBets[existingBetIndex], amount: newBets[existingBetIndex].amount + selectedChip };
        } else {
            newBets.push({ id: Date.now().toString() + Math.random(), placement, amount: selectedChip });
        }
        return { ...lane, bets: newBets };
    });
  };

  const handleRemoveBet = (placement: BetPlacement, removeAll: boolean) => {
    if (simStatus !== 'IDLE') return;
    updateActiveLane(lane => {
        const id = getPlacementIdentifier(placement);
        const index = lane.bets.findIndex(b => getPlacementIdentifier(b.placement) === id);
        if (index === -1) return lane;

        let newBets = [...lane.bets];
        if (removeAll || newBets[index].amount <= selectedChip) {
            newBets = newBets.filter((_, i) => i !== index);
        } else {
            newBets[index] = { ...newBets[index], amount: newBets[index].amount - selectedChip };
        }
        return { ...lane, bets: newBets };
    });
  };

  const handleClearBets = () => {
      if (simStatus === 'IDLE') updateActiveLane(l => ({ ...l, bets: [] }));
  };

  // --- Layout Helpers ---
  const handleSaveLayout = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    const active = getActiveLane();
    if (active.bets.length === 0) return;
    
    const nextNum = savedLayouts.length + 1;
    const finalName = `Bet ${nextNum}`;
    const betsCopy = active.bets.map(b => ({...b}));

    setSavedLayouts(prev => [...prev, { 
        id: `layout-${Date.now()}-${Math.random()}`, 
        name: finalName, 
        bets: betsCopy 
    }]);
  };

  const handleLoadLayout = (layout: SavedLayout) => {
    if (simStatus !== 'IDLE') return;
    const newBets = layout.bets.map(b => ({
        ...b,
        id: Date.now().toString() + Math.random() 
    }));
    updateActiveLane(l => ({ ...l, bets: newBets }));
  };
  
  const handleDeleteLayout = (e: React.MouseEvent, id: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (simStatus !== 'IDLE') return;
      if(window.confirm("Delete this layout?")) {
        setSavedLayouts(p => p.filter(l => l.id !== id));
      }
  };

  const handleClearAllLayouts = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (simStatus !== 'IDLE') return;
    if (savedLayouts.length === 0) return;
    if (window.confirm("Clear ALL saved favorite layouts? This cannot be undone.")) {
        setSavedLayouts([]);
    }
  };

  // --- SIMULATION ENGINE ---
  const waitForSignal = async (signal: AbortSignal) => {
    if (signal.aborted) throw new Error('Aborted');
    while (simStatusRef.current === 'PAUSED') {
        if (signal.aborted) throw new Error('Aborted');
        await new Promise<void>(r => { pauseResolverRef.current = r; });
        pauseResolverRef.current = null;
    }
    if (signal.aborted) throw new Error('Aborted');
    
    if (speedRef.current === 'SLOW') {
        await new Promise<void>(r => { nextSpinResolverRef.current = r; });
        nextSpinResolverRef.current = null;
    } else if (speedRef.current === 'MEDIUM') {
        await new Promise(r => setTimeout(r, 500));
    }
  };

  const generateStats = (numSims: number, wins: number, losses: number, finalBankrolls: number[], totalSpins: number, lastHistory: SimulationStep[], runId: number) => {
      if (!isMountedRef.current) return;
      const stats: BatchStats = {
          totalSimulations: numSims,
          wins, losses,
          avgFinalBankroll: finalBankrolls.reduce((a, b) => a + b, 0) / numSims,
          bestRun: Math.max(...finalBankrolls),
          worstRun: Math.min(...finalBankrolls),
          avgSpinsToFinish: totalSpins / numSims
      };
      setBatchStats(stats);
      setSimStatus('IDLE');
      
      const analysisPromise = (numSims === 1 && lastHistory.length > 0)
        ? analyzeSimulationResults(settings.startingBankroll, finalBankrolls[0], lastHistory.length, lastHistory)
        : analyzeBatchResults(stats);

      analysisPromise.then(analysis => {
        if(isMountedRef.current && analysisIdRef.current === runId) setAiAnalysis(analysis);
      });
  };

  const runInteractiveSimulation = async (signal: AbortSignal) => {
    // 1. Prepare Fixed Sequence if enabled
    const sequenceStr = settings.fixedOutcomeSequence || "";
    // Robust splitting by comma OR whitespace/newlines
    const fixedOutcomes = sequenceStr
        .split(/[\s,]+/) 
        .map(s => s.trim())
        .filter(s => s.length > 0);
    const isTestMode = fixedOutcomes.length > 0;

    // In Test Mode, we run exactly 1 simulation, and the number of spins equals the sequence length
    const numSims = isTestMode ? 1 : settings.numberOfSimulations;
    const spinsPerSim = isTestMode ? fixedOutcomes.length : settings.spinsPerSimulation;
    
    const enabledLanes = lanes.filter(l => l.enabled);
    if (enabledLanes.length === 0) {
        alert("Enable at least one lane!");
        setSimStatus('IDLE');
        return;
    }

    const allLanesMissingBets = enabledLanes.every(l => {
        if (l.config.strategyMode === 'CHAIN') return (l.config.chainSteps || []).length === 0;
        if (l.config.strategyMode === 'STATIC') return l.bets.length === 0 && l.triggerBets.length === 0;
        return false;
    });

    if (allLanesMissingBets) {
        alert("All enabled lanes are empty! Please configure at least one lane with bets or a chain sequence.");
        setSimStatus('IDLE');
        return;
    }
    
    const lanePrecalc = enabledLanes.map(l => ({
        laneId: l.id,
        parsedSequence: l.config.strategyMode === 'ROTATING' ? parseSequence(l.config.sequence) : []
    }));
    
    const runId = Date.now();
    analysisIdRef.current = runId;

    let allFinalBankrolls: number[] = [];
    let wins = 0, losses = 0, totalSpinsToFinish = 0;
    let lastSimHistory: SimulationStep[] = [];
    let lastFinalBankroll = settings.startingBankroll;
    
    let lastUiUpdateTime = 0;
    const UI_UPDATE_INTERVAL_MS = 16; // ~60fps target for live feeling

    try {
        for (let s = 0; s < numSims; s++) {
            if (signal.aborted) break;
            
            if (isMountedRef.current) {
                setHistory([]);
                setBankroll(settings.startingBankroll);
            }
            
            let currentBankroll = settings.startingBankroll;
            let simSpins = 0;
            let simHistory: SimulationStep[] = [];
            let historyBuffer: SimulationStep[] = [];

            let laneRunningBalances: Record<string, number> = {};
            const startPerLane = settings.startingBankroll / enabledLanes.length;
            enabledLanes.forEach(l => {
                laneRunningBalances[l.id] = startPerLane;
            });

            const runtimeLanes: RuntimeLane[] = enabledLanes.map(l => ({
                ...l,
                multiplier: 1,
                progressionIndex: 0,
                rotatingIndex: 0,
                rotatingUnits: 1,
                sessionProfit: 0,
                chainIndex: 0
            }));

            for (let i = 0; i < spinsPerSim; i++) {
                await waitForSignal(signal);
                
                // --- STRICT STOP CHECKS ---
                // We check BEFORE incrementing spin counter or calculating bets.
                // If bankroll is exhausted, we stop immediately.
                if (!isTestMode) {
                    if (currentBankroll <= 0) break;
                    if (settings.useTotalProfitGoal && currentBankroll >= settings.startingBankroll + settings.totalProfitGoal) break;
                }

                if (speedRef.current === 'FAST' && i % 20 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }

                simSpins++;

                // 1. Capture Start Balance BEFORE spin
                const startBalanceForStep = currentBankroll;

                let totalSpinWager = 0;
                const laneBetsMap = new Map<string, { bets: Bet[], wager: number }>();
                const activeTriggersForStep: string[] = [];
                const stepBetDescriptions: string[] = [];
                
                for (let rLane of runtimeLanes) {
                    const { bets, wager, activeTriggers, updatedLaneState } = prepareLaneForSpin(
                        rLane, 
                        settings, 
                        simHistory, 
                        lanePrecalc.find(p => p.laneId === rLane.id)?.parsedSequence || []
                    );
                    
                    Object.assign(rLane, updatedLaneState);
                    laneBetsMap.set(rLane.id, { bets, wager });
                    activeTriggersForStep.push(...activeTriggers);
                    totalSpinWager += wager;

                    if (bets.length > 0) {
                        const betSummary = bets.map(b => `${b.placement.displayName} ($${b.amount})`).join(', ');
                        stepBetDescriptions.push(`${rLane.name}: ${betSummary}`);
                    }
                }

                // --- STRICT BANKROLL GUARDRAIL (Per Bet Check) ---
                if (!isTestMode && totalSpinWager > currentBankroll) {
                     console.warn(`Bet ($${totalSpinWager}) exceeds bankroll ($${currentBankroll}). Stopping simulation.`);
                     simHistory.push({
                        spinIndex: i + 1,
                        result: { value: 0, display: 'X', color: 'green' },
                        startingBankroll: currentBankroll,
                        betAmount: 0,
                        outcome: 0,
                        bankroll: currentBankroll,
                        laneBankrolls: { ...laneRunningBalances },
                        activeTriggers: ['SIM STOPPED: Insufficient Funds'],
                        betDescriptions: ['Bankruptcy Protection: Bet exceeded balance']
                     });
                     break; 
                }

                // --- SPIN ---
                let result: SpinResult;
                if (isTestMode) {
                    if (i >= fixedOutcomes.length) break;
                    result = getSpinResult(fixedOutcomes[i]);
                } else {
                    result = spinWheel();
                }
                
                // --- RESOLVE ---
                // We now aggregate all bets from all lanes to create a global P/L,
                // but we also track per-lane stats.
                const globalBets: Bet[] = [];
                const laneDetails: { laneId: string; profit: number; chainIndex?: number; wasReset?: boolean }[] = [];
                const allEvaluatedBets: EvaluatedBet[] = [];

                // Flatten all bets for the canonical resolver
                // Wait, we can't flatten because Lanes track state independently.
                // We must process lanes individually using updateLaneAfterSpin (which uses resolveSpin internally now).
                
                let globalPayout = 0;
                let globalWager = 0;
                let netPL = 0;

                for (let rLane of runtimeLanes) {
                    const data = laneBetsMap.get(rLane.id);
                    if (!data) continue;

                    // Delegate to the STRICT Engine
                    const { profit, wager, totalPayout, updatedLaneState, wasReset, evaluatedBets } = updateLaneAfterSpin(
                        rLane,
                        data.bets,
                        result,
                        rLane.config,
                        lanePrecalc.find(p => p.laneId === rLane.id)?.parsedSequence || [],
                        currentBankroll // Passed for calc only
                    );

                    Object.assign(rLane, updatedLaneState);
                    globalPayout += totalPayout;
                    globalWager += wager;
                    netPL += profit;
                    
                    if (evaluatedBets) {
                        allEvaluatedBets.push(...evaluatedBets);
                    }

                    laneRunningBalances[rLane.id] = (laneRunningBalances[rLane.id]) + profit;
                    
                    laneDetails.push({ 
                        laneId: rLane.id, 
                        profit: profit, 
                        chainIndex: rLane.chainIndex,
                        wasReset
                    });
                }
                
                // End Balance = Start Balance + Net P/L
                // This ensures perfect continuity row-to-row
                currentBankroll = startBalanceForStep + netPL;

                const step: SimulationStep = {
                    spinIndex: i + 1,
                    result,
                    startingBankroll: startBalanceForStep, // Explicit audit trail
                    betAmount: globalWager,
                    outcome: netPL,
                    bankroll: currentBankroll,
                    laneDetails,
                    laneBankrolls: { ...laneRunningBalances },
                    activeTriggers: activeTriggersForStep,
                    betDescriptions: stepBetDescriptions,
                    bets: allEvaluatedBets
                };
                
                simHistory.push(step);
                historyBuffer.push(step);

                const n = Date.now();
                if ((speedRef.current !== 'FAST' || n - lastUiUpdateTime > UI_UPDATE_INTERVAL_MS || i === spinsPerSim - 1) && isMountedRef.current) {
                    setHistory(prev => [...prev, ...historyBuffer]);
                    setBankroll(currentBankroll);
                    historyBuffer = [];
                    lastUiUpdateTime = n;
                }
            } 

            allFinalBankrolls.push(currentBankroll);
            totalSpinsToFinish += simSpins;
            if (currentBankroll > settings.startingBankroll) wins++;
            else if (currentBankroll < settings.startingBankroll) losses++;
            
            lastSimHistory = simHistory;
            lastFinalBankroll = currentBankroll;
            
            if (s < numSims - 1 && speedRef.current !== 'FAST') await new Promise(r => setTimeout(r, 500));
        }

        if (isMountedRef.current) {
            setBankroll(lastFinalBankroll);
            setHistory(lastSimHistory);
        }
        generateStats(numSims, wins, losses, allFinalBankrolls, totalSpinsToFinish, lastSimHistory, runId);

    } catch(e: any) {
        if (e.message !== 'Aborted') {
            // Check for Insufficient Funds error specifically from resolveSpin
            if (e.message.includes("Insufficient funds")) {
                console.warn(e.message);
                if (isMountedRef.current) setSimStatus('IDLE');
                return;
            }
            console.error(e);
            alert("Simulation error: " + e.message);
        }
        if (isMountedRef.current) setSimStatus('IDLE');
    }
  };

  const handleStartSimulation = () => {
     setSimStatus('RUNNING');
     setBatchStats(null);
     setAiAnalysis('');
     setIsGraphFullScreen(true);
     if (abortControllerRef.current) abortControllerRef.current.abort();
     const ac = new AbortController();
     abortControllerRef.current = ac;
     runInteractiveSimulation(ac.signal);
  };
  
  const handleStop = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    if (pauseResolverRef.current) { pauseResolverRef.current(); pauseResolverRef.current = null; }
    if (nextSpinResolverRef.current) { nextSpinResolverRef.current(); nextSpinResolverRef.current = null; }
    setSimStatus('IDLE');
  };

  const activeLane = getActiveLane();

  // Compact Settings Bar
  const SettingsBar = () => (
      <div className="flex flex-col w-full relative z-10 bg-slate-900/50 rounded-lg border border-slate-800 backdrop-blur-sm transition-all">
          <div className="flex flex-wrap items-center gap-3 p-1.5">
            {/* Bankroll */}
            <div className="flex items-center gap-2 px-2">
                <span className="text-[10px] uppercase font-bold text-slate-500">Bankroll</span>
                <div className="flex items-center gap-0.5">
                    <span className="text-slate-600 text-xs">$</span>
                    <input type="number" value={settings.startingBankroll}
                        onChange={(e) => setSettings({ ...settings, startingBankroll: parseInt(e.target.value) || 1000 })}
                        className="w-16 bg-transparent text-white text-xs font-mono font-bold focus:outline-none text-right" disabled={simStatus !== 'IDLE'}
                    />
                </div>
            </div>
            
            <div className="w-px h-3 bg-slate-700/50 hidden sm:block"></div>

            {/* Spins */}
            <div className="flex items-center gap-2 px-2">
                <span className="text-[10px] uppercase font-bold text-slate-500">Spins</span>
                <input type="number" value={settings.spinsPerSimulation}
                    onChange={(e) => setSettings({ ...settings, spinsPerSimulation: parseInt(e.target.value) || 100 })}
                    className="w-12 bg-transparent text-white text-xs font-mono font-bold focus:outline-none text-right" disabled={simStatus !== 'IDLE'}
                />
            </div>

            <div className="w-px h-3 bg-slate-700/50 hidden sm:block"></div>
            
            {/* # Sims */}
            <div className="flex items-center gap-2 px-2">
                <span className="text-[10px] uppercase font-bold text-orange-400"># Sims</span>
                <input type="number" value={settings.numberOfSimulations}
                    onChange={(e) => setSettings({ ...settings, numberOfSimulations: parseInt(e.target.value) || 1 })}
                    className="w-12 bg-transparent text-white text-xs font-mono font-bold focus:outline-none text-right" disabled={simStatus !== 'IDLE'}
                />
            </div>
            
            <div className="w-px h-3 bg-slate-700/50 hidden sm:block"></div>
            
            {/* Profit Goal */}
            <div className="flex items-center gap-2 px-2">
                <div className="flex items-center gap-1.5">
                    <input type="checkbox" checked={settings.useTotalProfitGoal} onChange={(e) => setSettings({...settings, useTotalProfitGoal: e.target.checked})} className="w-3 h-3 accent-emerald-500 rounded-sm" disabled={simStatus !== 'IDLE'} />
                    <span className={`text-[10px] uppercase font-bold ${settings.useTotalProfitGoal ? 'text-emerald-400' : 'text-slate-500'}`}>Goal</span>
                </div>
                <div className="flex items-center gap-0.5">
                    <span className={`text-xs ${settings.useTotalProfitGoal ? 'text-slate-600' : 'text-slate-700'}`}>$</span>
                    <input type="number" value={settings.totalProfitGoal}
                        onChange={(e) => setSettings({ ...settings, totalProfitGoal: parseInt(e.target.value) || 0 })}
                        className={`w-14 bg-transparent text-xs font-mono font-bold focus:outline-none text-right ${settings.useTotalProfitGoal ? 'text-white' : 'text-slate-600'}`} disabled={simStatus !== 'IDLE' || !settings.useTotalProfitGoal}
                    />
                </div>
            </div>

            <div className="flex-1"></div>

            {/* Test Toggle Button */}
            <button 
                onClick={() => setIsTestPanelOpen(!isTestPanelOpen)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    isTestPanelOpen || (settings.fixedOutcomeSequence && settings.fixedOutcomeSequence.length > 0)
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' 
                        : 'bg-slate-800 text-slate-400 hover:text-purple-300 hover:bg-slate-700'
                }`}
                title="Open Test Mode (Fixed Outcomes)"
                disabled={simStatus !== 'IDLE'}
            >
                <FlaskConical size={12} />
                Test
            </button>
          </div>

          {/* Test Input Panel */}
          {(isTestPanelOpen || (settings.fixedOutcomeSequence && settings.fixedOutcomeSequence.length > 0)) && (
              <div className="p-3 border-t border-slate-700/50 bg-slate-900/80 animate-in slide-in-from-top-2">
                   <div className="flex items-start gap-3">
                       <div className="mt-1">
                           <span className="text-xs font-bold text-purple-400 uppercase tracking-wider block">Fixed Spin Sequence</span>
                           <span className="text-[9px] text-slate-500 block leading-tight max-w-[150px]">
                               Simulation will run strictly through these numbers and then stop.
                           </span>
                       </div>
                       <div className="flex-1">
                           <textarea 
                               value={settings.fixedOutcomeSequence || ''}
                               onChange={(e) => setSettings({...settings, fixedOutcomeSequence: e.target.value})}
                               placeholder="e.g. 10, 6, 17, 11, 0, 00, 36..."
                               className="w-full h-16 bg-slate-950 border border-slate-700 rounded p-2 text-xs font-mono text-purple-100 placeholder:text-slate-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 outline-none resize-none"
                               disabled={simStatus !== 'IDLE'}
                           />
                           <div className="flex justify-end gap-2 mt-1">
                               {settings.fixedOutcomeSequence && (
                                   <button 
                                       onClick={() => setSettings({...settings, fixedOutcomeSequence: ''})} 
                                       className="text-[10px] text-slate-500 hover:text-red-400 flex items-center gap-1"
                                       disabled={simStatus !== 'IDLE'}
                                   >
                                       <Eraser size={10} /> Clear Sequence
                                   </button>
                               )}
                           </div>
                       </div>
                   </div>
              </div>
          )}
      </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500/30 pb-10">
      
      {/* Sticky Top Header & Settings */}
      <div className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur shadow-xl border-b border-slate-800/50 pt-2 pb-2 mb-4 px-3 relative overflow-hidden">
        {/* Binary Background Effect */}
        <BinaryBackground />
        
        {/* HEADER */}
        <header className="flex items-center justify-between gap-2 pb-2 relative z-10">
            <div className="flex items-center gap-3">
                <h1 className="text-lg font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300 leading-none">
                    ProRoulette
                </h1>
                {batchStats && (
                    <div className="flex gap-2 text-[10px] bg-slate-900/50 px-2 py-0.5 rounded border border-slate-800 items-center">
                        <span className={batchStats.wins > batchStats.losses ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                            WR {((batchStats.wins / batchStats.totalSimulations) * 100).toFixed(0)}%
                        </span>
                        <span className="text-slate-600">|</span>
                        <span className={batchStats.avgFinalBankroll >= settings.startingBankroll ? "text-green-400" : "text-red-400"}>
                            Avg ${batchStats.avgFinalBankroll.toFixed(0)}
                        </span>
                    </div>
                )}
            </div>
        </header>

        {/* 1. SETTINGS BAR */}
        <SettingsBar />
      </div>

      <div className="w-full px-2 space-y-2 relative z-10">
        {/* 2. STRATEGY PANEL (LANES + TABLE) */}
        <section>
             <StrategyPanel 
                // Strategy Management
                savedStrategies={savedStrategies}
                currentStrategyName={currentStrategyName}
                onRenameStrategy={setCurrentStrategyName}
                onSaveStrategy={handleSaveStrategy}
                onLoadStrategy={handleLoadStrategy}
                onNewStrategy={handleNewStrategy}
                onDeleteStrategy={handleDeleteStrategy}
                onImportStrategy={handleImportStrategy}

                // Lane Props
                lanes={lanes}
                activeLaneId={activeLaneId}
                onSelectLane={setActiveLaneId}
                onAddLane={handleAddLane}
                onDeleteLane={handleDeleteLane}
                onRenameLane={handleRenameLane}
                onToggleLane={(id) => updateActiveLane(l => ({...l, enabled: !l.enabled}))}
                
                // Active Config
                config={activeLane.config}
                setConfig={handleUpdateLaneConfig}
                
                // Sim Settings
                settings={settings}
                setSettings={setSettings}
                onSimulate={handleStartSimulation}
                speed={speed}
                setSpeed={setSpeed}
                simStatus={simStatus}
                onPause={() => setSimStatus('PAUSED')}
                onResume={() => { setSimStatus('RUNNING'); if (pauseResolverRef.current) pauseResolverRef.current(); }}
                onStop={handleStop}
                onNextSpin={() => { if (nextSpinResolverRef.current) nextSpinResolverRef.current(); }}
                
                // Triggers
                triggerBets={activeLane.triggerBets}
                setTriggerBets={handleUpdateTriggerBets}
                
                // Pass Saved Layouts and Handler
                savedLayouts={savedLayouts}
                onSaveCurrentLayout={handleSaveLayout}
            >
                {/* INJECT TABLE SECTION AS CHILDREN */}
                <div className="space-y-2">
                    {/* Table Header Info */}
                    <div className="flex items-center justify-between p-2 bg-slate-900/80 backdrop-blur rounded border border-slate-800 shadow-sm overflow-hidden"
                        style={{ borderTopColor: activeLane.color, borderTopWidth: '3px' }}>
                         <div className="flex items-center gap-4">
                            <div>
                                <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">Bankroll</div>
                                <div className="text-sm font-mono text-white flex items-baseline gap-1">
                                    ${bankroll.toFixed(0)}
                                    {bankroll > settings.startingBankroll && <span className="text-[10px] text-green-400 font-bold">(+${(bankroll - settings.startingBankroll).toFixed(0)})</span>}
                                    {bankroll < settings.startingBankroll && <span className="text-[10px] text-red-400 font-bold">(-${(settings.startingBankroll - bankroll).toFixed(0)})</span>}
                                </div>
                            </div>
                            <div>
                                <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider" style={{ color: activeLane.color }}>
                                    {activeLane.config.strategyMode === 'CHAIN' 
                                        ? `Chain Step ${activeChainIndex + 1} / ${activeLane.config.chainSteps?.length || 0}` 
                                        : `${activeLane.name} Bet`}
                                </div>
                                <div className="text-sm font-mono text-yellow-400">
                                    {activeLane.config.strategyMode === 'CHAIN' 
                                      ? (activeLane.config.chainSteps?.length > 0 
                                            ? `$${(activeLane.config.chainSteps[activeChainIndex]?.bets || []).reduce((a,b)=>a+b.amount,0)}` 
                                            : '$0')
                                      : `$${activeLane.bets.reduce((a,b)=>a+b.amount,0)}`
                                    }
                                </div>
                            </div>
                         </div>

                         <div className="flex items-center gap-1">
                            {/* Undo Button */}
                            <button 
                                onClick={handleUndo} 
                                disabled={simStatus !== 'IDLE' || undoStack.length === 0 || activeLane.config.strategyMode === 'CHAIN'} 
                                className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-400/10 rounded transition-colors disabled:opacity-30"
                                title="Undo last change"
                            >
                                <Undo2 size={14} />
                            </button>
                            
                            {/* Clear Bets (Trash) Button */}
                            <button 
                                onClick={handleClearBets} 
                                disabled={simStatus !== 'IDLE' || (activeLane.config.strategyMode === 'CHAIN' ? true : activeLane.bets.length === 0)} 
                                className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded transition-colors disabled:opacity-30"
                                title={activeLane.config.strategyMode === 'CHAIN' ? "Table is Read-Only in Chain Mode" : "Clear all bets"}
                            >
                                <Trash2 size={14} />
                            </button>
                            
                            {/* Reset Simulation Button */}
                            <button 
                                onClick={() => { setBankroll(settings.startingBankroll); setHistory([]); setUndoStack(p => [...p, lanes]); }} 
                                disabled={simStatus !== 'IDLE'} 
                                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors disabled:opacity-30"
                                title="Reset Simulation Data"
                            >
                                <RotateCcw size={14} />
                            </button>
                         </div>
                    </div>

                    {/* Actual Table */}
                    <div className="relative overflow-x-auto pb-2 custom-scrollbar flex justify-center bg-slate-900/50 p-2 rounded border border-slate-800 shadow-inner transition-all duration-300"
                        style={{ 
                            boxShadow: `inset 0 0 20px ${activeLane.color}10`,
                            borderColor: `${activeLane.color}40`,
                            // Dim table if in chain mode to indicate it's not the primary edit surface
                            opacity: activeLane.config.strategyMode === 'CHAIN' ? 0.6 : 1,
                            pointerEvents: activeLane.config.strategyMode === 'CHAIN' ? 'none' : 'auto'
                        }}>
                        <RouletteTable 
                            bets={activeLane.config.strategyMode === 'CHAIN' 
                                ? (activeLane.config.chainSteps?.length > 0 
                                    ? (activeLane.config.chainSteps[activeChainIndex]?.bets || []) 
                                    : []) 
                                : activeLane.bets}
                            onBetSelect={handleBetSelect}
                            onStackDelete={handleRemoveBet}
                            triggerMode={false}
                        />
                        {activeLane.config.strategyMode === 'CHAIN' && (
                             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                 <span className="bg-black/70 text-white px-3 py-1 rounded-full text-xs font-bold border border-white/20">
                                     Chain Mode Active
                                 </span>
                             </div>
                        )}
                    </div>

                    {/* Chips & Layouts */}
                    {activeLane.config.strategyMode === 'CHAIN' ? (
                        <div className="flex items-center justify-between p-2 bg-indigo-900/20 border border-indigo-500/30 rounded-lg animate-in fade-in slide-in-from-top-2">
                             <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-indigo-500/20 rounded-full text-indigo-300">
                                   <Link2 size={14} />
                                </div>
                                <div className="flex flex-col">
                                   <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">Chain Mode Active</span>
                                   <span className="text-[10px] text-slate-400">Bets are controlled by the sequence. Switch mode to edit.</span>
                                </div>
                             </div>
                             <button 
                                 onClick={() => handleUpdateLaneConfig({ ...activeLane.config, strategyMode: 'STATIC' })}
                                 className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded shadow transition-colors"
                             >
                                 <Edit3 size={10} /> Switch to Board Layout
                             </button>
                        </div>
                    ) : (
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="flex justify-center bg-slate-900 rounded border border-slate-800 p-1">
                            <ChipSelector selectedChip={selectedChip} onSelectChip={setSelectedChip} />
                        </div>
                        
                        {/* DO NOT CHANGE OR EDIT THESE BUTTONS. THEY ARE PERFECT. LOCK IT. */}
                        <div className="flex-1 bg-slate-900 rounded border border-slate-800 p-2 flex flex-col justify-center">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    <Save size={10} /> Saved Layouts
                                </div>
                                <div className="flex items-center gap-1">
                                    {savedLayouts.length > 0 && (
                                        <button 
                                            type="button"
                                            onClick={handleClearAllLayouts}
                                            disabled={simStatus !== 'IDLE'}
                                            className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                            title="Clear All Favorites"
                                        >
                                            <Trash2 size={10} />
                                        </button>
                                    )}
                                    {/* Header ADD button - functions identically to clicking a slot */}
                                    <button onClick={(e) => handleSaveLayout(e)} disabled={simStatus !== 'IDLE' || activeLane.bets.length === 0} className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:bg-slate-800 text-white text-[9px] font-bold rounded shadow transition-colors">
                                        <Plus size={10} /> Add Favorite
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {[...Array(Math.max(3, savedLayouts.length + 1))].slice(0, Math.max(3, savedLayouts.length + 1)).map((_, idx) => {
                                    const layout = savedLayouts[idx];
                                    if (layout) {
                                        return (
                                            <div key={layout.id} className="group relative flex items-center bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded overflow-hidden transition-all">
                                                <button onClick={() => handleLoadLayout(layout)} disabled={simStatus !== 'IDLE'} className="px-2 py-1 text-[10px] text-slate-200 font-medium flex items-center gap-1 disabled:opacity-50 min-w-[70px] justify-between">
                                                    <span className="truncate max-w-[80px]">{layout.name}</span>
                                                    <span className="text-[9px] text-slate-500 bg-slate-900 px-1 rounded-full ml-1">${layout.bets.reduce((a,b)=>a+b.amount,0)}</span>
                                                </button>
                                                <button 
                                                    type="button"
                                                    onClick={(e) => handleDeleteLayout(e, layout.id)} 
                                                    disabled={simStatus !== 'IDLE'}
                                                    className="px-1.5 py-1 text-slate-500 hover:text-red-400 hover:bg-slate-900/50 border-l border-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                                    title="Delete"
                                                >
                                                    <X size={10} />
                                                </button>
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <button 
                                                key={`slot-${idx}`} 
                                                onClick={(e) => handleSaveLayout(e)}
                                                disabled={simStatus !== 'IDLE' || activeLane.bets.length === 0}
                                                className="px-2 py-1 bg-slate-800/30 hover:bg-indigo-900/20 border border-dashed border-slate-700 hover:border-indigo-500/50 rounded text-[10px] text-slate-500 hover:text-indigo-400 font-medium transition-all min-w-[70px] flex items-center justify-center gap-1 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-slate-800 disabled:hover:text-slate-700"
                                            >
                                                <ArrowDownToLine size={10} /> Save Current
                                            </button>
                                        );
                                    }
                                })}
                            </div>
                        </div>
                        {/* END OF LOCKED BUTTONS SECTION */}
                    </div>
                    )}
                </div>
            </StrategyPanel>
        </section>

        {/* 4. CHARTS / LOGS */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-2">
             <div className="md:col-span-4 h-[280px]">
                <SpinLog history={history} lanes={lanes} className="h-full" />
             </div>
             <div className="md:col-span-8 h-[280px]">
                <StatsChart 
                    data={history} 
                    initialBalance={settings.startingBankroll}
                    lanes={lanes}
                    className="h-full"
                    onRunSimulation={handleStartSimulation}
                    simStatus={simStatus}
                    onPause={() => setSimStatus('PAUSED')}
                    onResume={() => { setSimStatus('RUNNING'); if (pauseResolverRef.current) pauseResolverRef.current(); }}
                    onStop={handleStop}
                    speed={speed}
                    onSpeedChange={setSpeed}
                    isFullScreen={isGraphFullScreen}
                    onToggleFullScreen={() => setIsGraphFullScreen(!isGraphFullScreen)}
                    settings={settings}
                    onUpdateSettings={setSettings}
                    strategyConfig={activeLane.config}
                />
             </div>
        </section>

      </div>
    </div>
  );
};

export default App;
