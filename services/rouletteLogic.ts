import { PlacedBet, SpinResult, BetType } from '../types';
import { RED_NUMBERS, PAYOUTS } from '../constants';

export const spinWheel = (): SpinResult => {
  // American Roulette: 1-36, 0, 00 (38 pockets)
  // We represent 00 as -1 for internal calculation in the new board system
  const pocketIndex = Math.floor(Math.random() * 38);
  
  let number: number;
  let display: string;
  let color: 'red' | 'black' | 'green';

  if (pocketIndex === 37) {
    number = -1; // 00
    display = '00';
    color = 'green';
  } else if (pocketIndex === 0) {
    number = 0;
    display = '0';
    color = 'green';
  } else {
    number = pocketIndex;
    display = number.toString();
    color = RED_NUMBERS.includes(number) ? 'red' : 'black';
  }

  // The result logic uses the display string and color for UI, 
  // but we return the raw number for win calculation logic
  return { number: display, color };
};

export const calculateWinnings = (bets: PlacedBet[], result: SpinResult): number => {
  let totalWinnings = 0;
  
  // Convert result '00' string back to -1 for matching our logic
  const resultNum = result.number === '00' ? -1 : Number(result.number);

  bets.forEach((bet) => {
    let win = false;
    
    // Check if the result number is in the bet's covered numbers
    if (bet.placement.numbers.includes(resultNum)) {
      win = true;
    }

    if (win) {
      // Get payout ratio
      let payoutRatio = PAYOUTS[bet.placement.type];
      
      // Fallback calculation if type not found (Standard Roulette Formula)
      if (payoutRatio === undefined) {
         const count = bet.placement.numbers.length;
         if (count > 0) {
            payoutRatio = (36 / count) - 1;
         } else {
            payoutRatio = 0;
         }
      }

      // Return original bet + profit
      totalWinnings += bet.amount + (bet.amount * payoutRatio);
    }
  });

  return totalWinnings;
};