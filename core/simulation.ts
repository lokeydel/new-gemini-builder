
// CORE — DO NOT MODIFY WITHOUT INTENT
import { Bet, BetPlacement, ProgressionConfig, SimulationSettings, SimulationStep, RuntimeLane, SpinResult, ProgressionAction, EvaluatedBet, BetType } from './types';
import { PAYOUTS, FIB_SEQUENCE, OUTSIDE_BET_TYPES } from './constants';

/**
 * THE CANONICAL PAYOUT FUNCTION
 * This is the single source of truth for all math in the simulator.
 */
export function resolveSpin(
    startingBalance: number,
    bets: Bet[],
    result: SpinResult
): {
    finalBalance: number;
    totalWager: number;
    totalPayout: number;
    netProfit: number;
    evaluatedBets: EvaluatedBet[];
} {
    let totalWager = 0;
    let totalPayout = 0;
    const evaluatedBets: EvaluatedBet[] = [];
    
    // Internal representation of numbers for checking (Normalized Value)
    const resultNum = result.value;

    // 1. Calculate Total Wager & Validate Affordability
    for (const bet of bets) {
        if (bet.amount < 0) continue; // Sanity check
        totalWager += bet.amount;
    }

    if (totalWager > startingBalance) {
        throw new Error(`Insufficient funds: Bet $${totalWager} > Balance $${startingBalance}`);
    }

    // 2. Resolve Each Bet Independently
    for (const bet of bets) {
        let isWin = false;

        // CRITICAL RULE: Outside bets lose on 0/00 explicitly.
        if ((resultNum === 0 || resultNum === -1) && OUTSIDE_BET_TYPES.has(bet.placement.type)) {
            isWin = false;
        } else {
            isWin = bet.placement.numbers.includes(resultNum);
        }

        let returnAmount = 0;

        if (isWin) {
             // Get standard odds
             let odds = PAYOUTS[bet.placement.type];
             
             // Fallback/Calculation for custom placements
             if (odds === undefined) {
                 const count = Math.max(1, bet.placement.numbers.length);
                 odds = (36 / count) - 1;
             }

             // CASINO MATH: Return/Payout = Stake + (Stake * Odds)
             returnAmount = bet.amount + (bet.amount * odds);
        }

        totalPayout += returnAmount;

        evaluatedBets.push({
            laneId: '', // Filled by wrapper
            laneName: '', // Filled by wrapper
            placement: bet.placement,
            amount: bet.amount,
            payout: returnAmount, // Correct field name matching interface
            netProfit: returnAmount - bet.amount
        });
    }

    // 3. Final Reconciliation
    // Net Profit = All Money Returned (Payout) - All Money Bet
    const netProfit = totalPayout - totalWager;
    const finalBalance = startingBalance + netProfit;

    return {
        finalBalance,
        totalWager,
        totalPayout,
        netProfit,
        evaluatedBets
    };
}

/**
 * Prepares the bets for a lane BEFORE the spin occurs.
 */
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
        if (steps.length > 0) {
            if (nextLane.chainIndex >= steps.length) nextLane.chainIndex = 0;
            const step = steps[nextLane.chainIndex];
            if (step && step.bets) {
                step.bets.forEach(b => {
                    laneSpinBets.push({
                        ...b,
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
        
        for (let k = history.length - 1; k >= 0; k--) {
            const step = history[k];
            // Use normalized value
            const stepNum = step.result.value;
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

/**
 * Updates the lane state AFTER the spin result is known.
 */
export function updateLaneAfterSpin(
    lane: RuntimeLane,
    bets: Bet[],
    result: SpinResult,
    config: ProgressionConfig,
    precalculatedSequence: BetPlacement[],
    virtualStartBalance: number // Just for calc, not real bankroll check here (already checked globally)
): {
    profit: number;
    wager: number;
    totalPayout: number; // Renamed from winnings
    updatedLaneState: RuntimeLane;
    wasReset: boolean;
    evaluatedBets: EvaluatedBet[];
} {
    const nextLane = { ...lane };
    let wasReset = false;

    // DELEGATE TO CANONICAL RESOLVER
    const resolution = resolveSpin(Number.MAX_SAFE_INTEGER, bets, result);

    // Decorate evaluated bets with lane info
    const decoratedBets = resolution.evaluatedBets.map(b => ({
        ...b,
        laneId: lane.id,
        laneName: lane.name
    }));

    nextLane.sessionProfit += resolution.netProfit;

    // Progression Logic
    const isWin = resolution.netProfit >= 0;

    if (config.strategyMode === 'STATIC') {
        const next = getNextProgressionState(nextLane.multiplier, nextLane.progressionIndex, isWin, config);
        nextLane.multiplier = next.m;
        nextLane.progressionIndex = next.i;
        
        const action = isWin ? config.onWinAction : config.onLossAction;
        if (action === ProgressionAction.RESET) {
            wasReset = true;
        }

    } else if (config.strategyMode === 'CHAIN') {
        const action = isWin ? config.chainOnWin : config.chainOnLoss;
        const steps = config.chainSteps || [];
        const maxIndex = steps.length > 0 ? steps.length - 1 : 0;
        
        if (action === ProgressionAction.RESTART_CHAIN) {
            nextLane.chainIndex = 0;
            wasReset = true;
        } else if (action === ProgressionAction.PREV_CHAIN_STEP) {
             nextLane.chainIndex = Math.max(0, nextLane.chainIndex - 1);
        } else if (action === ProgressionAction.NEXT_CHAIN_STEP) {
            if (nextLane.chainIndex < maxIndex) {
                nextLane.chainIndex++;
            } else {
                if (config.chainLoop) {
                    nextLane.chainIndex = 0;
                } else {
                    nextLane.chainIndex = maxIndex;
                }
            }
        }
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
        profit: resolution.netProfit,
        wager: resolution.totalWager,
        totalPayout: resolution.totalPayout, // Renamed
        updatedLaneState: nextLane,
        wasReset,
        evaluatedBets: decoratedBets
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
