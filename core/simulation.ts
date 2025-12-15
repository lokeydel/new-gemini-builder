
// CORE — DO NOT MODIFY WITHOUT INTENT
import { Bet, BetPlacement, ProgressionConfig, SimulationSettings, SimulationStep, RuntimeLane, SpinResult, ProgressionAction } from './types';
import { PAYOUTS, FIB_SEQUENCE } from './constants';

export function prepareLaneForSpin(
    lane: RuntimeLane,
    settings: SimulationSettings,
    history: SimulationStep[],
    precalculatedSequence: BetPlacement[]
): {
    bets: Bet[];
    wager: number;
    activeTriggers: string[];
    updatedLaneState: RuntimeLane;
} {
    const nextLane = { ...lane };
    const laneSpinBets: Bet[] = [];
    const activeTriggers: string[] = [];

    // 1. Session Profit Reset
    if (nextLane.config.useResetOnSessionProfit && nextLane.config.resetOnSessionProfit > 0) {
        if (nextLane.sessionProfit >= nextLane.config.resetOnSessionProfit) {
            nextLane.multiplier = 1;
            nextLane.progressionIndex = 0;
            nextLane.rotatingIndex = 0;
            nextLane.rotatingUnits = 1;
            nextLane.sessionProfit = 0;
            nextLane.chainIndex = 0;
        }
    }

    // 2. Base Bets
    if (nextLane.config.strategyMode === 'STATIC') {
        let mult = nextLane.multiplier;
        const baseWager = nextLane.bets.reduce((s, b) => s + b.amount, 0);
        
        if (baseWager > 0) {
            if (baseWager * mult > settings.tableMax) mult = settings.tableMax / baseWager;
            nextLane.bets.forEach(b => {
                laneSpinBets.push({
                    ...b,
                    amount: Math.max(1, Math.floor(b.amount * mult))
                });
            });
        }
    } else if (nextLane.config.strategyMode === 'CHAIN') {
        // CHAIN MODE
        const steps = nextLane.config.chainSteps || [];
        // Safety check for empty chain
        if (steps.length > 0) {
            // Ensure index is valid
            if (nextLane.chainIndex >= steps.length) nextLane.chainIndex = 0;
            
            const step = steps[nextLane.chainIndex];
            if (step && step.bets) {
                // Clone bets to avoid mutating the source
                step.bets.forEach(b => {
                    laneSpinBets.push({
                        ...b,
                        // Unique ID for this specific bet instance
                        id: `chain-${nextLane.id}-${nextLane.chainIndex}-${b.id}`
                    });
                });
            }
        }
    } else {
        // ROTATING
        if (precalculatedSequence.length > 0) {
            const placement = precalculatedSequence[nextLane.rotatingIndex];
            let amount = Math.floor(nextLane.rotatingUnits * nextLane.config.baseUnit);
            amount = Math.min(settings.tableMax, Math.max(settings.tableMin, amount));
            laneSpinBets.push({
                id: `rot-${nextLane.id}-${history.length}`,
                placement,
                amount
            });
        }
    }

    // 3. Trigger Bets
    nextLane.triggerBets.forEach(tb => {
        if (!tb.active) return;
        
        let met = false;
        let streak = 0;
        
        // Check history backwards
        for (let k = history.length - 1; k >= 0; k--) {
            const step = history[k];
            const stepNum = step.result.number === '00' ? -1 : Number(step.result.number);
            const matchesTarget = tb.triggerPlacement.numbers.includes(stepNum);
            
            if (tb.rule === 'MISS_STREAK') {
                if (!matchesTarget) streak++; else break;
            } else if (tb.rule === 'HIT_STREAK') {
                if (matchesTarget) streak++; else break;
            }
        }
        
        if (streak >= tb.threshold) met = true;
        
        if (met) {
            activeTriggers.push(`Trigger: ${tb.rule === 'MISS_STREAK' ? 'Miss' : 'Hit'} ${tb.triggerPlacement.displayName} (${streak})`);
            laneSpinBets.push({ 
                id: `trig-${nextLane.id}-${tb.id}-${history.length}`, 
                placement: tb.betPlacement, 
                amount: tb.betAmount 
            });
        }
    });

    const wager = laneSpinBets.reduce((s, b) => s + b.amount, 0);

    return {
        bets: laneSpinBets,
        wager,
        activeTriggers,
        updatedLaneState: nextLane
    };
}

export function updateLaneAfterSpin(
    lane: RuntimeLane,
    bets: Bet[],
    wager: number,
    result: SpinResult,
    config: ProgressionConfig,
    precalculatedSequence: BetPlacement[]
): {
    profit: number;
    updatedLaneState: RuntimeLane;
} {
    const nextLane = { ...lane };
    const resultNum = result.number === '00' ? -1 : Number(result.number);
    
    // Calculate P/L by looping through each bet explicitly
    let laneNetProfit = 0;

    for (const bet of bets) {
        let isHit = false;
        if (bet.placement.numbers.includes(resultNum)) {
            isHit = true;
        }

        let winnings = 0;
        if (isHit) {
            let payoutRatio = PAYOUTS[bet.placement.type];
            if (payoutRatio === undefined) {
                 const count = bet.placement.numbers.length;
                 // Standard fallback logic: (36 / n) - 1
                 if (count > 0) {
                    payoutRatio = (36 / count) - 1;
                 } else {
                    payoutRatio = 0;
                 }
            }
            // Return = Original Bet + Profit
            winnings = bet.amount + (bet.amount * payoutRatio);
        }

        // Net P/L for this bet = Return - Cost
        const betPL = winnings - bet.amount;
        laneNetProfit += betPL;
    }
    
    nextLane.sessionProfit += laneNetProfit;

    // Determine Win/Loss for Progression
    // A "Win" for progression purposes is defined as ending the spin with non-negative profit.
    const isWin = laneNetProfit >= 0;

    if (config.strategyMode === 'STATIC') {
        const next = getNextProgressionState(nextLane.multiplier, nextLane.progressionIndex, isWin, config);
        nextLane.multiplier = next.m;
        nextLane.progressionIndex = next.i;
    } else if (config.strategyMode === 'CHAIN') {
        const action = isWin ? config.chainOnWin : config.chainOnLoss;
        const steps = config.chainSteps || [];
        const maxIndex = steps.length > 0 ? steps.length - 1 : 0;
        
        if (action === ProgressionAction.RESTART_CHAIN) {
            nextLane.chainIndex = 0;
        } else if (action === ProgressionAction.PREV_CHAIN_STEP) {
             nextLane.chainIndex = Math.max(0, nextLane.chainIndex - 1);
        } else if (action === ProgressionAction.NEXT_CHAIN_STEP) {
            // Advancing
            if (nextLane.chainIndex < maxIndex) {
                nextLane.chainIndex++;
            } else {
                // End of chain reached
                if (config.chainLoop) {
                    nextLane.chainIndex = 0;
                } else {
                    // Stay on last step
                    nextLane.chainIndex = maxIndex;
                }
            }
        }
        // DO_NOTHING keeps index same
    } else {
        // ROTATING
        if (isWin) {
            nextLane.rotatingUnits = Math.max(config.minUnits, nextLane.rotatingUnits + config.onWinUnits);
            if (config.rotateOnWin) nextLane.rotatingIndex = (nextLane.rotatingIndex + 1) % (precalculatedSequence.length || 1);
        } else {
            nextLane.rotatingUnits = Math.max(config.minUnits, nextLane.rotatingUnits + config.onLossUnits);
            if (config.rotateOnLoss) nextLane.rotatingIndex = (nextLane.rotatingIndex + 1) % (precalculatedSequence.length || 1);
        }
    }

    return {
        profit: laneNetProfit,
        updatedLaneState: nextLane
    };
}

function getNextProgressionState(
    currMult: number, 
    currIdx: number, 
    win: boolean, 
    cfg: ProgressionConfig
) {
     const act = win ? cfg.onWinAction : cfg.onLossAction;
     const val = win ? cfg.onWinValue : cfg.onLossValue;
     let nm = currMult, ni = currIdx;
     
     if (act === 'RESET') { nm = 1; ni = 0; }
     else if (act === 'MULTIPLY') nm *= val;
     else if (act === 'ADD_UNITS') nm += val;
     else if (act === 'SUBTRACT_UNITS') nm = Math.max(1, nm - val);
     else if (act === 'FIBONACCI') {
         if (win) ni = Math.max(0, ni - (val || 2));
         else ni = Math.min(FIB_SEQUENCE.length-1, ni + (val || 1));
         nm = FIB_SEQUENCE[ni];
     }
     return { m: Math.max(1, Math.floor(nm)), i: ni };
}
