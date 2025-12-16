
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Bet, BetPlacement, ProgressionConfig, ProgressionAction, 
  SimulationSettings, SimulationStep, SimulationSpeed, SimulationStatus, 
  BatchStats, TriggerBet, SavedLayout, Lane, SavedStrategy, RuntimeLane, EvaluatedBet, SpinResult, LaneLogDetail, BatchSession
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
import SimulationHistory from './components/SimulationHistory';
import { RotateCcw, Trash2, Undo2, Save, Download, Plus, X, Settings, ArrowDownToLine, Eraser, Edit3, Link2, FlaskConical, History, ChevronLeft, ChevronRight } from 'lucide-react';

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

  // --- Chip Interaction State ---
  const [moveSourceId, setMoveSourceId] = useState<string | null>(null);
  const [draggingStackId, setDraggingStackId] = useState<string | null>(null);

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
  const [batches, setBatches] = useState<BatchSession[]>(() => {
      try {
        const saved = localStorage.getItem('roulette_batches');
        return saved ? JSON.parse(saved) : [];
      } catch { return []; }
  });

  // Persist Batches
  useEffect(() => {
      try {
        localStorage.setItem('roulette_batches', JSON.stringify(batches));
      } catch (e) { console.error("Failed to save batches", e); }
  }, [batches]);

  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  // Auto-select last batch on load if none selected
  useEffect(() => {
      if (!activeBatchId && batches.length > 0) {
          setActiveBatchId(batches[batches.length - 1].id);
      }
  }, []);

  // Derived state for current view with MEMOIZATION to fix Error #185
  const activeBatch = useMemo(() => batches.find(b => b.id === activeBatchId), [batches, activeBatchId]);
  const currentBatchHistories = useMemo(() => activeBatch?.runs || [], [activeBatch]);
  const currentBatchStats = activeBatch?.stats || null;

  const [currentSimIndex, setCurrentSimIndex] = useState(0);
  // View data: either the live running history OR the selected history from batch
  const [displayHistory, setDisplayHistory] = useState<SimulationStep[]>([]);

  // Refs
  const simStatusRef = useRef<SimulationStatus>('IDLE');
  const speedRef = useRef<SimulationSpeed>('FAST');
  const pauseResolverRef = useRef<((value: void | PromiseLike<void>) => void) | null>(null);
  const nextSpinResolverRef = useRef<((value: void | PromiseLike<void>) => void) | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const analysisIdRef = useRef<number>(0);

  const [simStatus, setSimStatus] = useState<SimulationStatus>('IDLE');

  // Sync displayHistory when navigation changes
  useEffect(() => {
      if (simStatusRef.current === 'RUNNING') return; // Don't sync during run, let run loop handle it
      if (currentBatchHistories.length > 0 && currentSimIndex < currentBatchHistories.length) {
          setDisplayHistory(currentBatchHistories[currentSimIndex]);
          const last = currentBatchHistories[currentSimIndex][currentBatchHistories[currentSimIndex].length - 1];
          if(last) setBankroll(last.bankroll);
          else setBankroll(activeBatch?.settings.startingBankroll || 1000);
      } else {
          // If already empty, don't set to new empty array to prevent infinite loops if dependencies are unstable
          setDisplayHistory(prev => prev.length === 0 ? prev : []);
          setBankroll(settings.startingBankroll);
      }
  }, [activeBatchId, currentSimIndex, currentBatchHistories, settings.startingBankroll, activeBatch]);

  const [selectedChip, setSelectedChip] = useState(5);
  const [speed, setSpeed] = useState<SimulationSpeed>('FAST');
  const [batchStats, setBatchStats] = useState<BatchStats | null>(null); // Kept for backwards compatibility logic
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isGraphFullScreen, setIsGraphFullScreen] = useState(false);
  const [isTestPanelOpen, setIsTestPanelOpen] = useState(false);

  useEffect(() => { simStatusRef.current = simStatus; }, [simStatus]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { return () => { isMountedRef.current = false; }; }, []);

  // --- Derived State Helpers ---
  const activeLane = useMemo(() => lanes.find(l => l.id === activeLaneId) || lanes[0], [lanes, activeLaneId]);
  
  const updateActiveLane = (updater: (lane: Lane) => Lane) => {
      setLanes(prev => {
          if(simStatus === 'IDLE') setUndoStack(s => [...s, prev]);
          return prev.map(l => l.id === activeLaneId ? updater(l) : l);
      });
  };

  // --- Helper to get the correct bets for display (fixing the visual bug) ---
  const getActiveChainIndex = (laneId: string) => {
      // If idle, show step 0 (editing)
      if (simStatus === 'IDLE' || displayHistory.length === 0) return 0;
      
      // If running/paused, show the 'next' step logic, which is stored in the last history update
      const lastStep = displayHistory[displayHistory.length - 1];
      const detail = lastStep.laneDetails?.find(d => d.laneId === laneId);
      return 0; // TODO: Implement reading precise chain state from history if needed visually
  };
  
  const activeChainIndex = getActiveChainIndex(activeLaneId);

  // --- Strategy Persistence Functions ---
  const handleSaveStrategy = () => {
      // IMPORTANT: Include savedLayouts (Favorites) AND history (logs) in the strategy file
      const strategyConfig: SavedStrategy = {
          id: Date.now().toString(),
          name: currentStrategyName,
          lanes: lanes,
          settings: settings,
          savedLayouts: savedLayouts,
          history: displayHistory // Include logs of current view
      };

      const fullExport = {
          ...strategyConfig,
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
      
      // Merge Settings
      if (strategy.settings) setSettings(prev => ({...prev, ...strategy.settings}));
      
      // Load favorites from strategy
      if (strategy.savedLayouts) {
        setSavedLayouts(strategy.savedLayouts);
      }
      
      setCurrentStrategyName(strategy.name);
      
      // Clear current session
      setBatches([]);
      setActiveBatchId(null);
      setDisplayHistory([]);
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
      
      const newId = `lane-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      setLanes([{
          id: newId,
          name: 'Lane 1',
          color: LANE_COLORS[0],
          bets: [],
          triggerBets: [],
          config: createDefaultConfig(),
          enabled: true
      }]);
      setActiveLaneId(newId); 
      setCurrentStrategyName("New Strategy");
      setBatches([]);
      setActiveBatchId(null);
      setDisplayHistory([]);
      setCurrentSimIndex(0);
      setBankroll(settings.startingBankroll);

      // Start fresh with no favorites for a new strategy
      setSavedLayouts([]);
  };

  // --- Lane Management ---
  const handleAddLane = () => {
      const active = activeLane;
      const nextIndex = lanes.length;
      const color = LANE_COLORS[nextIndex % LANE_COLORS.length];
      
      // Generate a truly unique ID to prevent React key collision or graph merging issues
      const newId = `lane-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      const newLane: Lane = {
          ...active,
          id: newId,
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

  // --- Chips Movement Logic ---
  const handleStackMove = (from: BetPlacement, to: BetPlacement, moveAll: boolean) => {
      if (simStatus !== 'IDLE') return;
      
      updateActiveLane(lane => {
          const fromId = getPlacementIdentifier(from);
          const toId = getPlacementIdentifier(to);
          
          if (fromId === toId) return lane;

          const fromBetIndex = lane.bets.findIndex(b => getPlacementIdentifier(b.placement) === fromId);
          if (fromBetIndex === -1) return lane;

          const fromBet = lane.bets[fromBetIndex];
          // If moving stack, move all. If moving single, move selected chip amount (capped at total)
          const amountToMove = moveAll ? fromBet.amount : Math.min(fromBet.amount, selectedChip);

          if (amountToMove <= 0) return lane;

          let newBets = [...lane.bets];

          // 1. Reduce Source
          if (fromBet.amount <= amountToMove) {
              newBets = newBets.filter((_, i) => i !== fromBetIndex);
          } else {
              newBets[fromBetIndex] = { ...fromBet, amount: fromBet.amount - amountToMove };
          }

          // 2. Add to Target
          const toBetIndex = newBets.findIndex(b => getPlacementIdentifier(b.placement) === toId);
          if (toBetIndex > -1) {
              newBets[toBetIndex] = { ...newBets[toBetIndex], amount: newBets[toBetIndex].amount + amountToMove };
          } else {
               newBets.push({
                   id: Date.now().toString() + Math.random(),
                   placement: to,
                   amount: amountToMove
               });
          }

          return { ...lane, bets: newBets };
      });
      // Clear move source if it was a click-move
      setMoveSourceId(null);
  };

  const handleStackSelectForMove = (placement: BetPlacement | null) => {
      if (simStatus !== 'IDLE') return;
      setMoveSourceId(placement ? getPlacementIdentifier(placement) : null);
  };

  const handleStackDragStart = (placement: BetPlacement, mode: 'single' | 'stack') => {
      if (simStatus !== 'IDLE') return;
      setDraggingStackId(getPlacementIdentifier(placement));
  };

  const handleStackDragEnd = () => {
      setDraggingStackId(null);
  };

  // --- Layout Helpers ---
  const handleSaveLayout = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    const active = activeLane;
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

  const finishBatch = (collectedHistories: SimulationStep[][], finalStats: BatchStats, runId: number) => {
      if (!isMountedRef.current) return;
      
      const newBatch: BatchSession = {
          id: runId.toString(),
          label: `Batch ${batches.length + 1}`,
          timestamp: Date.now(),
          runs: collectedHistories,
          stats: finalStats,
          settings: { ...settings }
      };

      setBatches(prev => [...prev, newBatch]);
      setActiveBatchId(newBatch.id);
      setCurrentSimIndex(0);
      setSimStatus('IDLE');
      
      // Auto-load analysis
      const analysisPromise = (newBatch.runs.length === 1 && newBatch.runs[0].length > 0)
        ? analyzeSimulationResults(settings.startingBankroll, newBatch.runs[0][newBatch.runs[0].length-1].bankroll, newBatch.runs[0].length, newBatch.runs[0])
        : analyzeBatchResults(finalStats);

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
    
    // Immutable Precalculation of sequences (read-only)
    const lanePrecalc = enabledLanes.map(l => ({
        laneId: l.id,
        parsedSequence: l.config.strategyMode === 'ROTATING' ? parseSequence(l.config.sequence) : []
    }));
    
    const runId = Date.now();
    analysisIdRef.current = runId;

    let allFinalBankrolls: number[] = [];
    let collectedHistories: SimulationStep[][] = [];
    let wins = 0, losses = 0, totalSpinsToFinish = 0;
    
    let lastUiUpdateTime = 0;
    const UI_UPDATE_INTERVAL_MS = 16; // ~60fps target for live feeling

    try {
        for (let s = 0; s < numSims; s++) {
            if (signal.aborted) break;
            
            if (isMountedRef.current) {
                // Clear display history for fresh visual start of this run
                setDisplayHistory([]);
                setBankroll(settings.startingBankroll);
            }
            
            let currentBankroll = settings.startingBankroll;
            let simSpins = 0;
            let simHistory: SimulationStep[] = [];
            let historyBuffer: SimulationStep[] = [];

            // Initialize Balances (Immutable Map)
            const laneRunningBalances: Record<string, number> = {};
            const startPerLane = settings.startingBankroll; 
            enabledLanes.forEach(l => {
                laneRunningBalances[l.id] = startPerLane;
            });

            // Initialize Runtime State (Immutable Array)
            // We use 'let' because we will replace this array entirely on every spin to ensure strict immutability.
            let currentRuntimeLanes: RuntimeLane[] = enabledLanes.map(l => ({
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
                if (!isTestMode) {
                    if (currentBankroll <= 0) break;
                    if (settings.useTotalProfitGoal && currentBankroll >= settings.startingBankroll + settings.totalProfitGoal) break;
                }

                if (speedRef.current === 'FAST' && i % 20 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }

                simSpins++;

                // Capture Start Balance BEFORE spin
                const startBalanceForStep = currentBankroll;

                // --- PHASE 1: PREPARE & WAGER ---
                // We map current lanes to prepared data, keeping everything immutable.
                const preparedStepData = currentRuntimeLanes.map(lane => {
                   return prepareLaneForSpin(
                        lane, 
                        settings, 
                        simHistory, 
                        lanePrecalc.find(p => p.laneId === lane.id)?.parsedSequence || []
                   );
                });

                // Calculate total wager from all lanes
                const totalSpinWager = preparedStepData.reduce((sum, d) => sum + d.wager, 0);
                
                // Aggregate debug info
                const activeTriggersForStep = preparedStepData.flatMap(d => d.activeTriggers);
                const stepBetDescriptions = preparedStepData
                    .filter(d => d.bets.length > 0)
                    .map(d => `${d.updatedLaneState.name}: ${d.bets.map(b => `${b.placement.displayName} ($${b.amount})`).join(', ')}`);

                // --- STRICT BANKROLL GUARDRAIL ---
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
                        betDescriptions: ['Bankruptcy Protection: Bet exceeded balance'],
                        laneDetails: []
                     });
                     
                     if (isMountedRef.current) {
                         setDisplayHistory(prev => [...prev, ...historyBuffer, simHistory[simHistory.length - 1]]);
                         setBankroll(currentBankroll);
                     }
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
                
                // --- PHASE 2: RESOLVE & UPDATE ---
                // Use the state returned by prepare (because prepare might have reset session profits, etc.)
                const nextRuntimeLanes: RuntimeLane[] = [];
                const laneLogDetails: LaneLogDetail[] = [];
                const allEvaluatedBets: EvaluatedBet[] = [];
                let netPL = 0;
                let globalWagerConfirmed = 0;

                // Iterate over the PREPARED data to resolve outcomes
                // This ensures we are using the exact state that placed the bets.
                preparedStepData.forEach((prepData, idx) => {
                    const laneStateAfterPrepare = prepData.updatedLaneState;
                    const betsPlaced = prepData.bets;

                    const balanceBefore = laneRunningBalances[laneStateAfterPrepare.id];

                    // Resolve
                    const updateResult = updateLaneAfterSpin(
                        laneStateAfterPrepare,
                        betsPlaced,
                        result,
                        laneStateAfterPrepare.config,
                        lanePrecalc.find(p => p.laneId === laneStateAfterPrepare.id)?.parsedSequence || [],
                        Number.MAX_SAFE_INTEGER // Virtual check only, global check done above
                    );

                    // Collect Immutable Result Data
                    nextRuntimeLanes.push(updateResult.updatedLaneState);
                    
                    if (updateResult.evaluatedBets) {
                        allEvaluatedBets.push(...updateResult.evaluatedBets);
                    }
                    
                    globalWagerConfirmed += updateResult.wager;
                    netPL += updateResult.profit;

                    // Update local balance map
                    const balanceAfter = balanceBefore + updateResult.profit;
                    laneRunningBalances[laneStateAfterPrepare.id] = balanceAfter;

                    laneLogDetails.push({ 
                        laneId: laneStateAfterPrepare.id,
                        laneName: laneStateAfterPrepare.name,
                        wager: updateResult.wager,
                        profit: updateResult.profit,
                        balanceBefore: balanceBefore,
                        balanceAfter: balanceAfter,
                        progressionLabel: updateResult.progressionLabel,
                        wasReset: updateResult.wasReset
                    });
                });

                // UPDATE STATE POINTER FOR NEXT LOOP (Immutable Replacement)
                currentRuntimeLanes = nextRuntimeLanes;

                // Finalize Step Data
                currentBankroll = startBalanceForStep + netPL;
                if (currentBankroll < 0) currentBankroll = 0;

                const step: SimulationStep = {
                    spinIndex: i + 1,
                    result,
                    startingBankroll: startBalanceForStep, 
                    betAmount: globalWagerConfirmed,
                    outcome: netPL,
                    bankroll: currentBankroll,
                    laneDetails: laneLogDetails,
                    laneBankrolls: { ...laneRunningBalances }, // Snapshot copy
                    activeTriggers: activeTriggersForStep,
                    betDescriptions: stepBetDescriptions,
                    bets: allEvaluatedBets
                };
                
                simHistory.push(step);
                historyBuffer.push(step);

                const n = Date.now();
                if ((speedRef.current !== 'FAST' || n - lastUiUpdateTime > UI_UPDATE_INTERVAL_MS || i === spinsPerSim - 1) && isMountedRef.current) {
                    setDisplayHistory(prev => [...prev, ...historyBuffer]);
                    setBankroll(currentBankroll);
                    historyBuffer = [];
                    lastUiUpdateTime = n;
                }
            } 

            collectedHistories.push(simHistory);
            allFinalBankrolls.push(currentBankroll);
            totalSpinsToFinish += simSpins;
            if (currentBankroll > settings.startingBankroll) wins++;
            else if (currentBankroll < settings.startingBankroll) losses++;
            
            if (s < numSims - 1 && speedRef.current !== 'FAST') await new Promise(r => setTimeout(r, 500));
        }

        const stats: BatchStats = {
            totalSimulations: numSims,
            wins, losses,
            avgFinalBankroll: allFinalBankrolls.reduce((a, b) => a + b, 0) / numSims,
            bestRun: Math.max(...allFinalBankrolls),
            worstRun: Math.min(...allFinalBankrolls),
            avgSpinsToFinish: totalSpinsToFinish / numSims
        };

        finishBatch(collectedHistories, stats, runId);

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

  const handleNextSim = () => {
    if (currentSimIndex < currentBatchHistories.length - 1) {
        setCurrentSimIndex(prev => prev + 1);
    }
  };

  const handlePrevSim = () => {
    if (currentSimIndex > 0) {
        setCurrentSimIndex(prev => prev - 1);
    }
  };

  const getActiveBatchIndex = () => batches.findIndex(b => b.id === activeBatchId);

  const handleNextBatch = () => {
      const idx = getActiveBatchIndex();
      if (idx !== -1 && idx < batches.length - 1) {
          setActiveBatchId(batches[idx + 1].id);
          setCurrentSimIndex(0);
      }
  };

  const handlePrevBatch = () => {
      const idx = getActiveBatchIndex();
      if (idx > 0) {
          setActiveBatchId(batches[idx - 1].id);
          setCurrentSimIndex(0);
      }
  };

  const handleDeleteBatch = (id?: string) => {
      // id is optional because the StatsChart calls it without ID for "current"
      const targetId = id || activeBatchId;
      if (!targetId) return;
      
      const newBatches = batches.filter(b => b.id !== targetId);
      setBatches(newBatches);
      
      if (newBatches.length > 0) {
          // If we deleted the active one, switch to another
          if (targetId === activeBatchId) {
             // Try to stay at same index or go to last
             const newActive = newBatches[newBatches.length - 1]; // Simple default: go to latest
             setActiveBatchId(newActive.id);
          }
      } else {
          setActiveBatchId(null);
          setDisplayHistory([]);
          setBankroll(settings.startingBankroll);
      }
      setCurrentSimIndex(0);
  };
  
  const handleClearAllBatches = () => {
      setBatches([]);
      setActiveBatchId(null);
      setDisplayHistory([]);
      setBankroll(settings.startingBankroll);
  };

  const handleRenameBatch = (batchId: string, newLabel: string) => {
      setBatches(prev => prev.map(b => b.id === batchId ? { ...b, label: newLabel } : b));
  };

  // --- Prep Batch List for Dropdown Navigation ---
  const batchList = useMemo(() => batches.map((b, i) => ({
      id: b.id,
      label: b.label || `Batch ${i + 1}`,
      timestamp: b.timestamp,
      winRate: b.stats.totalSimulations > 0 ? b.stats.wins / b.stats.totalSimulations : 0,
      netProfit: b.stats.avgFinalBankroll - b.settings.startingBankroll
  })), [batches]);

  const handleSelectBatch = (index: number) => {
      if (batches[index]) {
          setActiveBatchId(batches[index].id);
          setCurrentSimIndex(0);
      }
  };

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
                {currentBatchStats && (
                    <div className="flex gap-2 text-[10px] bg-slate-900/50 px-2 py-0.5 rounded border border-slate-800 items-center">
                        <span className={currentBatchStats.wins > currentBatchStats.losses ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                            WR {((currentBatchStats.wins / currentBatchStats.totalSimulations) * 100).toFixed(0)}%
                        </span>
                        <span className="text-slate-600">|</span>
                        <span className={currentBatchStats.avgFinalBankroll >= settings.startingBankroll ? "text-green-400" : "text-red-400"}>
                            Avg ${currentBatchStats.avgFinalBankroll.toFixed(0)}
                        </span>
                    </div>
                )}
            </div>
            
            {/* History & Nav Controls */}
            <div className="flex items-center gap-2">
                 {batches.length > 0 && (
                     <div className="hidden sm:flex items-center bg-slate-900/50 rounded-lg border border-slate-800 p-0.5">
                         <button 
                            onClick={handlePrevBatch} 
                            disabled={getActiveBatchIndex() <= 0} 
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800 transition-colors"
                         >
                            <ChevronLeft size={16} />
                         </button>
                         <span className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                             {getActiveBatchIndex() + 1} <span className="text-slate-700">/</span> {batches.length}
                         </span>
                         <button 
                            onClick={handleNextBatch} 
                            disabled={getActiveBatchIndex() >= batches.length - 1} 
                            className="p-1 text-slate-400 hover:text-white disabled:opacity-30 rounded hover:bg-slate-800 transition-colors"
                         >
                            <ChevronRight size={16} />
                         </button>
                     </div>
                 )}

                 <button 
                     onClick={() => setIsHistoryModalOpen(true)}
                     className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/30 rounded-lg text-xs font-bold transition-all shadow-lg"
                 >
                     <History size={14} />
                     <span className="hidden sm:inline">History</span>
                     {batches.length > 0 && (
                        <span className="bg-indigo-500 text-white text-[9px] px-1.5 rounded-full ml-0.5">{batches.length}</span>
                     )}
                 </button>
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
                                onClick={() => { setBankroll(settings.startingBankroll); setDisplayHistory([]); setBatches([]); setActiveBatchId(null); setUndoStack(p => [...p, lanes]); }} 
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
                            // New Props for Movement
                            onStackMove={handleStackMove}
                            onStackSelectForMove={handleStackSelectForMove}
                            moveSourceId={moveSourceId}
                            draggingStackId={draggingStackId}
                            onStackDragStart={handleStackDragStart}
                            onStackDragEnd={handleStackDragEnd}
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
                <SpinLog history={displayHistory} lanes={lanes} activeLaneId={activeLaneId} className="h-full" batchLabel={activeBatch?.label || (batches.length > 0 ? `Batch ${getActiveBatchIndex()+1}` : undefined)} />
             </div>
             <div className="md:col-span-8 h-[280px]">
                <StatsChart 
                    data={displayHistory} 
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
                    
                    // Sim Navigation
                    currentSimIndex={currentSimIndex}
                    totalSims={currentBatchHistories.length || 1}
                    onNextSim={handleNextSim}
                    onPrevSim={handlePrevSim}
                    
                    // Batch Navigation
                    currentBatchIndex={getActiveBatchIndex()}
                    totalBatches={batches.length}
                    onNextBatch={handleNextBatch}
                    onPrevBatch={handlePrevBatch}
                    onDeleteBatch={() => handleDeleteBatch()}
                    onClearAllBatches={handleClearAllBatches} // Pass clear handler
                    
                    // History List for Dropdown
                    batchList={batchList}
                    onSelectBatch={handleSelectBatch}
                    onRenameBatch={handleRenameBatch}
                />
             </div>
        </section>

        {/* History Modal */}
        <SimulationHistory 
            isOpen={isHistoryModalOpen}
            onClose={() => setIsHistoryModalOpen(false)}
            batches={batches}
            activeBatchId={activeBatchId}
            onSelectBatch={(id) => {
                setActiveBatchId(id);
                setCurrentSimIndex(0);
                setIsHistoryModalOpen(false);
            }}
            onDeleteBatch={handleDeleteBatch}
            onClearHistory={handleClearAllBatches}
        />

      </div>
    </div>
  );
};

export default App;
