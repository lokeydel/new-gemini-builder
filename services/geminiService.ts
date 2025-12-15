import { ProgressionConfig, BatchStats } from '../core/types';

// AI Integration removed to avoid costs.
// These functions now return basic formatted strings or null.

export const generateStrategyFromDescription = async (description: string): Promise<ProgressionConfig | null> => {
  // Feature disabled
  console.warn("AI Strategy Generation is disabled.");
  return null;
};

export const analyzeSimulationResults = async (initialBalance: number, finalBalance: number, totalSpins: number, history: any[]): Promise<string> => {
  const profit = finalBalance - initialBalance;
  const winRate = totalSpins > 0 ? (history.filter(h => h.outcome > 0).length / totalSpins) : 0;
  
  return `Simulation Complete.
  Final Balance: $${finalBalance}
  Total P/L: $${profit > 0 ? '+' : ''}${profit}
  Win Rate: ${(winRate * 100).toFixed(2)}%`;
};

export const analyzeBatchResults = async (stats: BatchStats): Promise<string> => {
  const winRate = stats.totalSimulations > 0 ? (stats.wins / stats.totalSimulations) * 100 : 0;
  return `Batch Analysis:
  Sessions: ${stats.totalSimulations}
  Win Rate: ${winRate.toFixed(1)}%
  Avg End Balance: $${stats.avgFinalBankroll.toFixed(0)}
  Best Run: $${stats.bestRun} | Worst Run: $${stats.worstRun}`;
};
