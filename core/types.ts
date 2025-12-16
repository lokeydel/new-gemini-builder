
// CORE — DO NOT MODIFY WITHOUT INTENT

export enum BetType {
  STRAIGHT_UP = 'STRAIGHT_UP',
  SPLIT = 'SPLIT',
  STREET = 'STREET',
  CORNER = 'CORNER',
  SIX_LINE = 'SIX_LINE',
  TOP_LINE = 'TOP_LINE', // 0, 00, 1, 2, 3 (Pays 6:1)
  BASKET = 'BASKET',     // 0, 1, 2 or 0, 00, 2 (Pays 11:1)
  COLUMN_1ST = 'COLUMN_1ST',
  COLUMN_2ND = 'COLUMN_2ND',
  COLUMN_3RD = 'COLUMN_3RD',
  DOZEN_1ST = 'DOZEN_1ST',
  DOZEN_2ND = 'DOZEN_2ND',
  DOZEN_3RD = 'DOZEN_3RD',
  LOW_1_18 = 'LOW_1_18',
  HIGH_19_36 = 'HIGH_19_36',
  EVEN = 'EVEN',
  ODD = 'ODD',
  RED = 'RED',
  BLACK = 'BLACK'
}

export interface BetPlacement {
  type: BetType;
  numbers: number[];
  displayName: string;
}

export interface PlacedBet {
  id: string; // unique ID for the bet instance
  placement: BetPlacement;
  amount: number;
}

// Alias for the component compatibility
export type Bet = PlacedBet;

export interface EvaluatedBet {
  laneId: string;
  laneName: string; // Snapshot of lane name
  placement: BetPlacement;
  amount: number;
  payout: number; // Total returned (Stake + Profit)
  netProfit: number; // Payout - Amount
}

export interface SavedLayout {
  id: string;
  name: string;
  bets: Bet[];
}

export interface SpinResult {
  value: number;   // Normalized: -1 for 00, 0-36 for others
  display: string; // "00", "0", "1", etc.
  color: 'red' | 'black' | 'green';
}

export interface LaneLogDetail {
  laneId: string; 
  laneName: string;
  wager: number;
  profit: number; 
  balanceBefore: number; // Lane specific balance
  balanceAfter: number;  // Lane specific balance
  progressionLabel: string; // e.g. "Step 2 (x4)"
  wasReset?: boolean;
}

export interface SimulationStep {
  spinIndex: number;
  result: SpinResult;
  startingBankroll: number; // Audit anchor: The GLOBAL balance BEFORE this spin
  betAmount: number;
  outcome: number; // Positive for win, negative for loss
  bankroll: number; // Global Total AFTER this spin
  laneDetails: LaneLogDetail[]; 
  laneBankrolls: Record<string, number>; // Individual running balance per lane
  activeTriggers?: string[]; // Debug info: which triggers fired this step
  bets?: EvaluatedBet[]; // Structured bet data
  betDescriptions?: string[]; // Legacy/Simple descriptions
}

export enum ProgressionAction {
  RESET = 'RESET',
  MULTIPLY = 'MULTIPLY',
  ADD_UNITS = 'ADD_UNITS',
  SUBTRACT_UNITS = 'SUBTRACT_UNITS',
  DO_NOTHING = 'DO_NOTHING',
  FIBONACCI = 'FIBONACCI',
  // Chain Actions
  NEXT_CHAIN_STEP = 'NEXT_CHAIN_STEP',
  PREV_CHAIN_STEP = 'PREV_CHAIN_STEP',
  RESTART_CHAIN = 'RESTART_CHAIN'
}

export type StrategyMode = 'STATIC' | 'ROTATING' | 'CHAIN';

export interface ProgressionConfig {
  // Common
  strategyMode: StrategyMode;
  baseUnit: number;
  
  // Static Mode
  onWinAction: ProgressionAction;
  onWinValue: number; // e.g., multiplier 2, or add 1 unit
  onLossAction: ProgressionAction;
  onLossValue: number;
  resetOnSessionProfit: number; // Logic: if session profit > 150, reset progression
  useResetOnSessionProfit: boolean; // Checkbox to enable/disable session reset
  
  // Rotating Mode
  sequence: string; // e.g. "red, black, even"
  onWinUnits: number; // e.g. -1 (subtract 1 unit)
  onLossUnits: number; // e.g. +1 (add 1 unit)
  minUnits: number; // e.g. 1
  rotateOnWin: boolean;
  rotateOnLoss: boolean;
  
  // Chain Mode
  chainSteps: SavedLayout[]; // The sequence of layouts to play
  chainOnWin: ProgressionAction; // Usually RESTART_CHAIN or NEXT_CHAIN_STEP
  chainOnLoss: ProgressionAction; // Usually NEXT_CHAIN_STEP
  chainLoop: boolean; // If true, goes back to step 0 after last step. If false, stays on last step.
}

export interface SimulationSettings {
  startingBankroll: number;
  tableMin: number;
  tableMax: number;
  spinsPerSimulation: number;
  numberOfSimulations: number;
  stopLoss: number; // Global Stop Loss
  totalProfitGoal: number; // Global Take Profit
  useTotalProfitGoal: boolean;
  fixedOutcomeSequence?: string; // New field for Test Mode
}

export interface BatchStats {
  totalSimulations: number;
  wins: number; // Reached take profit or ended positive
  losses: number; // Busted or hit stop loss
  avgFinalBankroll: number;
  bestRun: number;
  worstRun: number;
  avgSpinsToFinish: number;
}

export interface BatchSession {
  id: string;
  label?: string; // User-defined name for this batch
  timestamp: number;
  runs: SimulationStep[][];
  stats: BatchStats;
  settings: SimulationSettings;
}

export type SimulationSpeed = 'FAST' | 'MEDIUM' | 'SLOW';
export type SimulationStatus = 'IDLE' | 'RUNNING' | 'PAUSED';

export type TriggerRule = 'MISS_STREAK' | 'HIT_STREAK';

export interface TriggerBet {
  id: string;
  active: boolean;
  
  // Logic Target
  triggerPlacement: BetPlacement; 
  rule: TriggerRule;
  threshold: number; // e.g. 5
  
  // Execution
  betAmount: number;
  betPlacement: BetPlacement; // Usually same as triggerPlacement, but kept distinct if we expand later
}

export interface Lane {
  id: string;
  name: string;
  color: string;
  bets: Bet[];
  triggerBets: TriggerBet[];
  config: ProgressionConfig;
  enabled: boolean;
}

export interface RuntimeLane extends Lane {
  multiplier: number;
  progressionIndex: number;
  rotatingIndex: number;
  rotatingUnits: number;
  sessionProfit: number;
  chainIndex: number;
}

export interface SavedStrategy {
  id: string;
  name: string;
  lanes: Lane[]; // Saves the entire lane configuration
  settings: Partial<SimulationSettings>;
  savedLayouts?: SavedLayout[]; // Stores the favorites library associated with this strategy
  history?: SimulationStep[]; // Persisted simulation logs
}
