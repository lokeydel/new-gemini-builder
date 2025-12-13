
export enum BetType {
  STRAIGHT_UP = 'STRAIGHT_UP',
  SPLIT = 'SPLIT',
  STREET = 'STREET',
  CORNER = 'CORNER',
  SIX_LINE = 'SIX_LINE',
  BASKET = 'BASKET', // Top line 0,00,1,2,3
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

export interface SpinResult {
  number: number | string; // '00' is a string
  color: 'red' | 'black' | 'green';
}

export interface SimulationStep {
  spinIndex: number;
  result: SpinResult;
  betAmount: number;
  outcome: number; // Positive for win, negative for loss
  bankroll: number;
}

export enum ProgressionAction {
  RESET = 'RESET',
  MULTIPLY = 'MULTIPLY',
  ADD_UNITS = 'ADD_UNITS',
  SUBTRACT_UNITS = 'SUBTRACT_UNITS',
  DO_NOTHING = 'DO_NOTHING'
}

export interface ProgressionConfig {
  onWinAction: ProgressionAction;
  onWinValue: number; // e.g., multiplier 2, or add 1 unit
  onLossAction: ProgressionAction;
  onLossValue: number;
  stopLoss: number; // The max amount you are willing to lose before quitting
  totalProfitGoal: number; // The target amount to walk away with (e.g., $1000)
  useTotalProfitGoal: boolean; // Checkbox to enable/disable profit goal
  resetOnSessionProfit: number; // Logic: if session profit > 150, reset progression
  useResetOnSessionProfit: boolean; // Checkbox to enable/disable session reset
  baseUnit: number;
}

export interface SimulationSettings {
  startingBankroll: number;
  tableMin: number;
  tableMax: number;
  spinsPerSimulation: number;
  numberOfSimulations: number;
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

export type SimulationSpeed = 'FAST' | 'MEDIUM' | 'SLOW';
export type SimulationStatus = 'IDLE' | 'RUNNING' | 'PAUSED';